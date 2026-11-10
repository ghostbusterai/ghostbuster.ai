#!/usr/bin/env node
/**
 * Evaluates Ask GhostBuster on the fixed dataset in evals/dataset.js. Uses an in-memory store, so it
 * never touches a real database.
 *
 *   node evals/ask-eval.js            retrieval only (free): recall@5, recall@10, MRR per question kind
 *   node evals/ask-eval.js --llm      also asks Claude (costs a few cents): citation precision/recall,
 *                                     abstention accuracy, latency, cost. Uses ANTHROPIC_API_KEY from .env.
 *   --budget=N                        context budget in characters for --llm (default 3000, small enough
 *                                     that retrieval has to choose; production uses 60000)
 *   --label=NAME                      tag for the results file (e.g. "keyword-baseline")
 *   --keyword-only                    ignore embeddings even when Google Cloud credentials are set
 *
 * Retrieval is hybrid (keyword + Vertex AI vectors) when GCP credentials are in .env, else keyword.
 *
 * Results are written to evals/results/<date>-<label>.json.
 */
const fs = require("node:fs")
const path = require("node:path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true })

const { getRecords, rankRecords, hybridRank, askGhostBuster } = require("../ask")
const embeddings = require("../embeddings")
const { store, questions } = require("./dataset")
const { estimateCost } = require("../aiLog")

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=")
    return [k, v ?? true]
  })
)
const USE_LLM = Boolean(args.llm)
const BUDGET = Number(args.budget) || 3000
const HYBRID = embeddings.isConfigured() && !args["keyword-only"]
const RETRIEVER = HYBRID ? "hybrid" : "keyword"
const LABEL = String(args.label || `${RETRIEVER}${USE_LLM ? "-llm" : ""}`)
if (!HYBRID) {
  // keep askGhostBuster keyword-only too
  process.env.GCP_SERVICE_ACCOUNT_JSON = ""
  process.env.GOOGLE_APPLICATION_CREDENTIALS = ""
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const round = (x) => Math.round(x * 1000) / 1000

function retrievalScores(ranked, expected) {
  const ids = ranked.map((r) => r.id)
  const recallAt = (k) => expected.filter((id) => ids.slice(0, k).includes(id)).length / expected.length
  const first = ids.findIndex((id) => expected.includes(id))
  return { recall5: recallAt(5), recall10: recallAt(10), mrr: first === -1 ? 0 : 1 / (first + 1) }
}

// Unanswerable questions: correct when the answer says the information isn't there. Citing a related
// record ("no phone number on file for Priya [[contact-1]]") is fine.
const NOT_FOUND =
  /\b(don'?t|do not|doesn'?t|does not|couldn'?t|could not|can'?t|cannot) (have|see|find|show|include|contain|mention)|\bno (record|records|contacts?|mention|information|info|notes?|applications?)\b|\bnot (in|on) (your|file)|\bnothing (in|about|on)\b|\bisn'?t (in|on)\b|\bthere(?:'s| is| are) no\b/i

function citationScores(sources, expected, answer) {
  const cited = sources.map((s) => s.id)
  if (!expected.length) return { abstainedCorrectly: NOT_FOUND.test(answer || "") }
  const hit = cited.filter((id) => expected.includes(id)).length
  return {
    precision: cited.length ? hit / cited.length : 0,
    recall: expected.filter((id) => cited.includes(id)).length / expected.length,
  }
}

function summarizeByKind(rows, fields) {
  const kinds = [...new Set(rows.map((r) => r.kind)), "all"]
  const out = {}
  for (const kind of kinds) {
    const list = kind === "all" ? rows : rows.filter((r) => r.kind === kind)
    out[kind] = { n: list.length }
    for (const f of fields) {
      const vals = list.map((r) => r[f]).filter((v) => typeof v === "number")
      if (vals.length) out[kind][f] = round(mean(vals))
    }
  }
  return out
}

async function main() {
  const { records, vectors } = await getRecords(store, "eval-user")
  if (HYBRID && !vectors) throw new Error("Embeddings are configured but failed; see the warning above")
  const rows = []

  for (const item of questions) {
    const row = { q: item.q, kind: item.kind, expected: item.expected }
    if (item.expected.length) {
      const ranked = HYBRID ? await hybridRank("eval-user", records, vectors, item.q) : rankRecords(records, item.q)
      Object.assign(row, retrievalScores(ranked, item.expected), { top5: ranked.slice(0, 5).map((r) => r.id) })
    }
    rows.push(row)
  }

  if (USE_LLM) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("--llm needs ANTHROPIC_API_KEY in ghostbuster-server/.env")
    const Anthropic = require("@anthropic-ai/sdk")
    const ws = String(process.env.ANTHROPIC_WORKSPACE_ID || "").trim()
    const anthropic = new Anthropic.default({
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(ws ? { defaultHeaders: { "anthropic-workspace-id": ws } } : {}),
    })
    const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6"
    const extractText = (c) => (c || []).filter((b) => b.type === "text").map((b) => b.text).join("")
    for (const row of rows) {
      const started = Date.now()
      const out = await askGhostBuster({
        anthropic, model, store, uid: "eval-user", question: row.q, history: [], extractText, budget: BUDGET,
      })
      const c = citationScores(out.sources, row.expected, out.answer)
      Object.assign(row, {
        answer: out.answer,
        cited: out.sources.map((s) => s.id),
        latencyMs: Date.now() - started,
        costUsd: estimateCost(model, out.usage),
        ...(c.abstainedCorrectly !== undefined
          ? { abstainedCorrectly: c.abstainedCorrectly ? 1 : 0 }
          : { citePrecision: c.precision, citeRecall: c.recall }),
      })
      process.stdout.write(".")
    }
    process.stdout.write("\n")
  }

  const fields = ["recall5", "recall10", "mrr"].concat(
    USE_LLM ? ["citePrecision", "citeRecall", "abstainedCorrectly", "latencyMs", "costUsd"] : []
  )
  const summary = summarizeByKind(rows, fields)
  const result = {
    label: LABEL,
    ranAt: new Date().toISOString(),
    retriever: RETRIEVER,
    embeddingModel: HYBRID ? embeddings.MODEL : null,
    llm: USE_LLM ? { model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6", budgetChars: BUDGET } : null,
    records: records.length,
    summary,
    rows,
  }

  const dir = path.join(__dirname, "results")
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${result.ranAt.slice(0, 10)}-${LABEL}.json`)
  fs.writeFileSync(file, JSON.stringify(result, null, 2))

  console.table(summary)
  const misses = rows.filter((r) => r.expected.length && r.recall5 < 1)
  if (misses.length) {
    console.log("\nRetrieval misses (recall@5 < 1):")
    for (const m of misses) console.log(`  [${m.kind}] ${m.q}  expected ${m.expected.join(", ")}  top5 ${m.top5.join(", ")}`)
  }
  console.log(`\nSaved ${path.relative(process.cwd(), file)}`)
}

if (require.main === module) main().catch((e) => {
  console.error(e)
  process.exit(1)
})

module.exports = { NOT_FOUND, summarizeByKind }
