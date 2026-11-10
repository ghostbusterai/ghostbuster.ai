/**
 * Vector embeddings for Ask GhostBuster's hybrid retrieval.
 *
 * Provider: Google Vertex AI text embeddings (text-embedding-005, 768 dimensions), called over REST
 * with a service account. Configure with:
 *   GCP_PROJECT_ID              Google Cloud project with the Vertex AI API enabled
 *   GCP_LOCATION                region, default us-central1
 *   GCP_SERVICE_ACCOUNT_JSON    the service-account key JSON (for Render), or
 *   GOOGLE_APPLICATION_CREDENTIALS  path to the key file (for local runs)
 *   VERTEX_EMBEDDING_MODEL      optional, default text-embedding-005
 *
 * Storage: one document per record in the Mongo `recordEmbeddings` collection
 * ({ userId, recordId, hash, model, embedding }). A record is re-embedded only when its text hash
 * changes. Search uses an Atlas Vector Search index (ATLAS_VECTOR_INDEX, filtered by userId) when
 * configured, and otherwise cosine similarity in memory over the user's vectors.
 *
 * Without credentials everything here is a no-op and Ask falls back to keyword retrieval.
 */
const crypto = require("node:crypto")

const MODEL = process.env.VERTEX_EMBEDDING_MODEL || "text-embedding-005"
const LOCATION = process.env.GCP_LOCATION || "us-central1"
const BATCH = 25 // instances per Vertex request (keeps each request well under the token limit)
const MAX_CHARS = 6000 // per text; Vertex truncates long inputs anyway

let authClient = null

function projectId() {
  if (process.env.GCP_PROJECT_ID) return process.env.GCP_PROJECT_ID
  try {
    return JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON || "{}").project_id || null
  } catch {
    return null
  }
}

let customEmbedder = null // tests can swap in a fake embedder with setEmbedder()

function setEmbedder(fn) {
  customEmbedder = fn
}

function isConfigured() {
  if (customEmbedder) return true
  return Boolean(
    projectId() && (process.env.GCP_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS)
  )
}

async function getAuth() {
  if (authClient) return authClient
  const { google } = require("googleapis")
  const scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  const auth = process.env.GCP_SERVICE_ACCOUNT_JSON
    ? new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON), scopes })
    : new google.auth.GoogleAuth({ scopes })
  authClient = await auth.getClient()
  return authClient
}

/** Embed texts with Vertex AI. taskType: RETRIEVAL_DOCUMENT for records, RETRIEVAL_QUERY for questions. */
async function embedTexts(texts, taskType = "RETRIEVAL_DOCUMENT") {
  if (!texts.length) return []
  if (customEmbedder) return customEmbedder(texts, taskType)
  const client = await getAuth()
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId()}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`
  const out = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const instances = texts.slice(i, i + BATCH).map((t) => ({ content: String(t).slice(0, MAX_CHARS), task_type: taskType }))
    const res = await client.request({ url, method: "POST", data: { instances } })
    for (const p of res.data?.predictions || []) out.push(p.embeddings?.values || [])
  }
  if (out.length !== texts.length) throw new Error("Vertex AI returned the wrong number of embeddings")
  return out
}

const hashText = (t) => crypto.createHash("sha256").update(`${MODEL}\n${t}`).digest("hex").slice(0, 32)

function cosine(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/*
 * Where vectors live. Mongo when the app has a database; otherwise (local JSON mode, evals) a Map.
 */
let getDb = null
function useMongo(getDbFn) {
  getDb = getDbFn
}
const memory = new Map() // `${uid}\n${recordId}` -> { hash, embedding }

async function loadExisting(uid) {
  if (getDb) {
    const rows = await getDb()
      .collection("recordEmbeddings")
      .find({ userId: String(uid), model: MODEL }, { projection: { _id: 0, recordId: 1, hash: 1, embedding: 1 } })
      .toArray()
    return new Map(rows.map((r) => [r.recordId, r]))
  }
  const prefix = `${uid}\n`
  const m = new Map()
  for (const [k, v] of memory) if (k.startsWith(prefix)) m.set(k.slice(prefix.length), { recordId: k.slice(prefix.length), ...v })
  return m
}

async function saveMany(uid, rows) {
  if (!rows.length) return
  if (getDb) {
    const now = new Date()
    await getDb()
      .collection("recordEmbeddings")
      .bulkWrite(
        rows.map((r) => ({
          updateOne: {
            filter: { userId: String(uid), recordId: r.recordId },
            update: { $set: { model: MODEL, hash: r.hash, embedding: r.embedding, updatedAt: now } },
            upsert: true,
          },
        })),
        { ordered: false }
      )
    return
  }
  for (const r of rows) memory.set(`${uid}\n${r.recordId}`, { hash: r.hash, embedding: r.embedding })
}

async function deleteMany(uid, recordIds) {
  if (!recordIds.length) return
  if (getDb) {
    await getDb().collection("recordEmbeddings").deleteMany({ userId: String(uid), recordId: { $in: recordIds } })
    return
  }
  for (const id of recordIds) memory.delete(`${uid}\n${id}`)
}

/**
 * Make sure every record has a current embedding. Embeds only new or changed records, removes vectors
 * for deleted ones, and returns Map(recordId -> embedding). Returns null when not configured.
 */
async function syncEmbeddings(uid, records) {
  if (!isConfigured()) return null
  const existing = await loadExisting(uid)
  const want = records.map((r) => ({ recordId: r.id, text: r.text, hash: hashText(r.text) }))
  const stale = want.filter((w) => existing.get(w.recordId)?.hash !== w.hash)
  if (stale.length) {
    const vectors = await embedTexts(stale.map((s) => s.text), "RETRIEVAL_DOCUMENT")
    stale.forEach((s, i) => (s.embedding = vectors[i]))
    await saveMany(uid, stale)
  }
  const keep = new Set(want.map((w) => w.recordId))
  await deleteMany(uid, [...existing.keys()].filter((id) => !keep.has(id)))

  const byId = new Map()
  for (const w of want) byId.set(w.recordId, w.embedding || existing.get(w.recordId).embedding)
  return { vectors: byId, embedded: stale.length }
}

/**
 * Record ids ordered by semantic similarity to the question.
 * Atlas Vector Search when ATLAS_VECTOR_INDEX is set (and Mongo is in use); otherwise in memory.
 */
async function vectorRank(uid, question, vectors, limit = 50) {
  const [q] = await embedTexts([question], "RETRIEVAL_QUERY")
  const index = process.env.ATLAS_VECTOR_INDEX
  if (getDb && index) {
    const rows = await getDb()
      .collection("recordEmbeddings")
      .aggregate([
        {
          $vectorSearch: {
            index,
            path: "embedding",
            queryVector: q,
            numCandidates: Math.max(100, limit * 4),
            limit,
            filter: { userId: String(uid), model: MODEL },
          },
        },
        { $project: { _id: 0, recordId: 1, score: { $meta: "vectorSearchScore" } } },
      ])
      .toArray()
    return rows.map((r) => ({ id: r.recordId, score: r.score }))
  }
  return [...vectors.entries()]
    .map(([id, v]) => ({ id, score: cosine(q, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

async function deleteUserEmbeddings(uid) {
  if (getDb) await getDb().collection("recordEmbeddings").deleteMany({ userId: String(uid) })
  for (const k of [...memory.keys()]) if (k.startsWith(`${uid}\n`)) memory.delete(k)
}

module.exports = {
  isConfigured,
  setEmbedder,
  useMongo,
  embedTexts,
  syncEmbeddings,
  vectorRank,
  deleteUserEmbeddings,
  cosine,
  MODEL,
}
