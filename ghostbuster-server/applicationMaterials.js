/**
 * Role kits: reuse cover letters and written answers across applications (same role type, different companies).
 */

const MAX_KITS = 16
const MAX_ANSWERS = 24
const MAX_COVER = 12000
const MAX_ANSWER = 8000
const MAX_PROMPT = 240
const MAX_KIT_NAME = 120
const MAX_KEYWORDS = 200

function sanitizeAnswers(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      const prompt = typeof row?.prompt === "string" ? row.prompt.trim().slice(0, MAX_PROMPT) : ""
      const answer = typeof row?.answer === "string" ? row.answer.trim().slice(0, MAX_ANSWER) : ""
      if (!prompt || !answer) return null
      return { prompt, answer }
    })
    .filter(Boolean)
    .slice(0, MAX_ANSWERS)
}

function sanitizeKit(raw) {
  if (!raw || typeof raw !== "object") return null
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 64) : ""
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, MAX_KIT_NAME) : ""
  if (!id || !name) return null
  return {
    id,
    name,
    roleKeywords:
      typeof raw.roleKeywords === "string" ? raw.roleKeywords.trim().slice(0, MAX_KEYWORDS) : "",
    coverLetter: typeof raw.coverLetter === "string" ? raw.coverLetter.trim().slice(0, MAX_COVER) : "",
    answers: sanitizeAnswers(raw.answers),
  }
}

function sanitizeApplicationKits(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const row of raw) {
    const kit = sanitizeKit(row)
    if (!kit || seen.has(kit.id)) continue
    seen.add(kit.id)
    out.push(kit)
    if (out.length >= MAX_KITS) break
  }
  return out
}

function sanitizeAppMaterials(body) {
  const out = {}
  if (body?.kitId !== undefined) {
    out.kitId = typeof body.kitId === "string" ? body.kitId.trim().slice(0, 64) : ""
  }
  if (body?.coverLetter !== undefined) {
    out.coverLetter = typeof body.coverLetter === "string" ? body.coverLetter.trim().slice(0, MAX_COVER) : ""
  }
  if (body?.writtenAnswers !== undefined) {
    out.writtenAnswers = sanitizeAnswers(body.writtenAnswers)
  }
  return out
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function substituteTemplate(text, { company = "", role = "" } = {}) {
  if (!text) return ""
  const c = String(company || "").trim()
  const r = String(role || "").trim()
  return text
    .replace(/\{\{\s*company\s*\}\}/gi, c)
    .replace(/\{\{\s*role\s*\}\}/gi, r)
    .replace(/\{\{\s*Company\s*\}\}/g, c)
    .replace(/\{\{\s*Role\s*\}\}/g, r)
}

function mergeAnswers(kitAnswers, appAnswers) {
  const map = new Map()
  for (const row of kitAnswers || []) map.set(norm(row.prompt), { ...row })
  for (const row of appAnswers || []) map.set(norm(row.prompt), { ...row })
  return [...map.values()]
}

function resolveMaterials(application, kits) {
  const app = application && typeof application === "object" ? application : {}
  const list = sanitizeApplicationKits(kits)
  const kit = list.find((k) => k.id === app.kitId) || null
  const kitCover = kit?.coverLetter || ""
  const appCover = app.coverLetter || ""
  const coverTemplate = appCover || kitCover
  const company = app.company || ""
  const role = app.role || ""
  const writtenAnswers = mergeAnswers(kit?.answers, app.writtenAnswers)
  return {
    kitId: kit?.id || app.kitId || "",
    kitName: kit?.name || "",
    coverLetter: substituteTemplate(coverTemplate, { company, role }),
    writtenAnswers,
  }
}

function kitMatchesRole(kit, role) {
  const r = norm(role)
  if (!r || !kit) return false
  const keys = String(kit.roleKeywords || "")
    .split(/[,;|\n]+/)
    .map((s) => norm(s))
    .filter(Boolean)
  if (!keys.length) return norm(kit.name) && r.includes(norm(kit.name))
  return keys.some((k) => r.includes(k) || k.split(" ").every((w) => w.length > 2 && r.includes(w)))
}

function suggestKitId(role, kits) {
  const list = sanitizeApplicationKits(kits)
  for (const kit of list) {
    if (kitMatchesRole(kit, role)) return kit.id
  }
  return ""
}

module.exports = {
  sanitizeApplicationKits,
  sanitizeAppMaterials,
  sanitizeAnswers,
  resolveMaterials,
  substituteTemplate,
  kitMatchesRole,
  suggestKitId,
}