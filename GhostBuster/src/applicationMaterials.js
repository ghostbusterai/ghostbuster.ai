export function normPrompt(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function substituteTemplate(text, { company = "", role = "" } = {}) {
  if (!text) return ""
  const c = String(company || "").trim()
  const r = String(role || "").trim()
  return text
    .replace(/\{\{\s*company\s*\}\}/gi, c)
    .replace(/\{\{\s*role\s*\}\}/gi, r)
    .replace(/\{\{\s*Company\s*\}\}/g, c)
    .replace(/\{\{\s*Role\s*\}\}/g, r)
}

export function mergeWrittenAnswers(kitAnswers, appAnswers) {
  const map = new Map()
  for (const row of kitAnswers || []) {
    if (row?.prompt && row?.answer) map.set(normPrompt(row.prompt), { prompt: row.prompt, answer: row.answer })
  }
  for (const row of appAnswers || []) {
    if (row?.prompt && row?.answer) map.set(normPrompt(row.prompt), { prompt: row.prompt, answer: row.answer })
  }
  return [...map.values()]
}

export function resolveMaterials(application, kits) {
  const kit = (kits || []).find((k) => k.id === application?.kitId) || null
  const coverTemplate = (application?.coverLetter || "").trim() || (kit?.coverLetter || "").trim()
  return {
    kitName: kit?.name || "",
    coverLetter: substituteTemplate(coverTemplate, {
      company: application?.company,
      role: application?.role,
    }),
    writtenAnswers: mergeWrittenAnswers(kit?.answers, application?.writtenAnswers),
  }
}

export function kitMatchesRole(kit, role) {
  const r = normPrompt(role)
  if (!r || !kit) return false
  const keys = String(kit.roleKeywords || "")
    .split(/[,;|\n]+/)
    .map((s) => normPrompt(s))
    .filter(Boolean)
  if (!keys.length) {
    const n = normPrompt(kit.name)
    return n && r.includes(n)
  }
  return keys.some((k) => r.includes(k) || k.split(" ").every((w) => w.length > 2 && r.includes(w)))
}

export function suggestKitId(role, kits) {
  for (const kit of kits || []) {
    if (kitMatchesRole(kit, role)) return kit.id
  }
  return ""
}

export function newKitId() {
  return `kit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyKit() {
  return { id: newKitId(), name: "", roleKeywords: "", coverLetter: "", answers: [] }
}