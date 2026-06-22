/**
 * Smart contact matching for résumé/career updates.
 * Uses AI when available; falls back to thematic alignment (not keyword-in-update matching).
 */

const { tokenize } = require("./relevance")

const STOP = new Set([
  "about",
  "their",
  "would",
  "could",
  "which",
  "there",
  "where",
  "being",
  "other",
  "have",
  "with",
  "from",
  "this",
  "that",
  "when",
  "your",
  "will",
  "been",
  "were",
  "they",
  "them",
  "these",
  "those",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "more",
  "most",
  "some",
  "such",
  "only",
  "also",
  "just",
  "than",
  "very",
  "can",
  "may",
  "might",
  "should",
  "share",
  "update",
  "recent",
  "recently",
  "added",
  "completed",
  "finished",
  "started",
  "working",
  "worked",
])

const THEME_KEYWORDS = {
  software: [
    "software",
    "engineer",
    "engineering",
    "developer",
    "development",
    "programming",
    "fullstack",
    "backend",
    "frontend",
    "full stack",
    "web",
    "mobile",
    "ios",
    "android",
    "devops",
    "cloud",
    "api",
    "saas",
  ],
  ml: [
    "machine learning",
    "deep learning",
    "artificial intelligence",
    "data science",
    "nlp",
    "computer vision",
    "neural",
    "llm",
    "model training",
    "ml",
    " ai ",
  ],
  data: ["data", "analytics", "sql", "database", "warehouse", "bi", "tableau", "metrics", "pipeline"],
  product: ["product", "product manager", "roadmap", "user research", "ux", "ui", "design", "pm"],
  finance: ["finance", "banking", "investment", "capital", "trading", "analyst", "private equity", "vc", "venture"],
  consulting: ["consulting", "consultant", "strategy", "advisory", "client"],
  research: ["research", "lab", "thesis", "publication", "academic", "phd", "professor"],
  leadership: ["lead", "leader", "manager", "director", "head of", "founder", "ceo", "cto", "vp"],
  internship: ["intern", "internship", "co-op", "coop", "new grad", "entry level"],
  healthcare: ["health", "medical", "clinical", "biotech", "pharma", "hospital", "patient"],
  marketing: ["marketing", "growth", "brand", "content", "seo", "campaign", "social media"],
  sales: ["sales", "account executive", "business development", "partnerships", "revenue"],
}

const THEME_LABELS = {
  software: "software engineering",
  ml: "machine learning / AI",
  data: "data & analytics",
  product: "product",
  finance: "finance",
  consulting: "consulting",
  research: "research",
  leadership: "leadership",
  internship: "internships & early career",
  healthcare: "healthcare / life sciences",
  marketing: "marketing & growth",
  sales: "sales & partnerships",
}

function significantTokens(text) {
  return [...new Set(tokenize(text))].filter((w) => w.length >= 4 && !STOP.has(w))
}

function detectThemes(text) {
  const padded = ` ${String(text).toLowerCase()} `
  const themes = new Set()
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    for (const kw of keywords) {
      if (padded.includes(kw.startsWith(" ") ? kw : ` ${kw} `) || padded.includes(kw)) {
        themes.add(theme)
        break
      }
    }
  }
  return [...themes]
}

function normalizeUpdate(update) {
  if (typeof update === "string") {
    return { title: "", details: update, effectiveDate: "" }
  }
  return {
    title: String(update?.title || "").trim(),
    details: String(update?.details || "").trim(),
    effectiveDate: String(update?.effectiveDate || "").trim(),
  }
}

function buildUpdateContext(update, context = {}) {
  const u = normalizeUpdate(update)
  const parts = [u.title, u.details]
  if (context.careerGoals) parts.push(context.careerGoals)
  if (context.resumeText) parts.push(String(context.resumeText).slice(0, 2500))
  return parts.filter(Boolean).join("\n")
}

function buildContactContext(contact) {
  return [contact.name, contact.company, contact.role, contact.notes].filter(Boolean).join(" ")
}

function formatContactRow(contact, reasons) {
  return {
    contactId: contact.id,
    name: contact.name,
    company: contact.company || "",
    role: contact.role || "",
    reasons: [...new Set(reasons)].slice(0, 3),
  }
}

function buildThematicReason(contact, sharedThemes, sharedTokens) {
  const role = String(contact.role || "").trim()
  const company = String(contact.company || "").trim()
  const who = role && company ? `${role} at ${company}` : role || company || "their background"

  if (sharedThemes.length > 0) {
    const labels = sharedThemes.slice(0, 2).map((t) => THEME_LABELS[t] || t)
    return `This update fits what ${contact.name} is doing (${who}) — you both touch ${labels.join(" and ")}.`
  }

  if (sharedTokens.length >= 2) {
    const sample = sharedTokens.slice(0, 3).join(", ")
    return `Your update aligns with ${contact.name}'s work (${who}) through shared focus areas like ${sample}.`
  }

  if (role || company) {
    return `Based on ${contact.name}'s role (${who}), this career update is likely relevant to share with them.`
  }

  return `This update may be worth sharing with ${contact.name} given what you know about them.`
}

function suggestContactsThematically(contacts, update, context = {}) {
  const updateContext = buildUpdateContext(update, context)
  if (!updateContext.trim() || !Array.isArray(contacts) || contacts.length === 0) return []

  const updateThemes = detectThemes(updateContext)
  const updateTokens = significantTokens(updateContext)
  const scored = []

  for (const c of contacts) {
    const contactContext = buildContactContext(c)
    if (!contactContext.trim()) continue

    const contactThemes = detectThemes(contactContext)
    const contactTokens = significantTokens(contactContext)
    const sharedThemes = updateThemes.filter((t) => contactThemes.includes(t))
    const sharedTokens = updateTokens.filter((t) => contactTokens.includes(t))

    let score = sharedThemes.length * 5 + sharedTokens.length * 2

    if (updateThemes.length > 0 && (c.role || c.notes)) {
      const roleNotes = `${c.role || ""} ${c.notes || ""}`.toLowerCase()
      for (const theme of updateThemes) {
        const kws = THEME_KEYWORDS[theme] || []
        if (kws.some((kw) => roleNotes.includes(kw.trim()))) score += 3
      }
    }

    if (context.careerGoals && (c.role || c.company)) {
      const goalsThemes = detectThemes(context.careerGoals)
      const goalContactOverlap = goalsThemes.filter((t) => contactThemes.includes(t))
      if (goalContactOverlap.length > 0 && updateThemes.some((t) => contactThemes.includes(t))) {
        score += 2
      }
    }

    if (score >= 3) {
      scored.push({
        contact: c,
        score,
        sharedThemes,
        sharedTokens,
      })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 8).map(({ contact, sharedThemes, sharedTokens }) =>
    formatContactRow(contact, [buildThematicReason(contact, sharedThemes, sharedTokens)])
  )
}

function buildAiPrompt(update, contacts, profile, fullResume) {
  const u = normalizeUpdate(update)
  const resumeSnippet =
    typeof fullResume?.text === "string" ? fullResume.text.trim().slice(0, 4000) : ""
  const contactList = contacts.slice(0, 50).map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company || "",
    role: c.role || "",
    notes: String(c.notes || "").slice(0, 400),
  }))

  return `You are a networking assistant. A user logged a career/résumé update. Recommend which contacts they should share it with.

IMPORTANT:
- The user should NOT have to mention a contact's company or name in the update.
- Infer relevance from what each contact does (role, company, notes) vs what the update is about.
- Only recommend contacts where sharing this update would feel natural and useful (not random).
- Return 0–5 matches. Quality over quantity. Skip weak fits.

User career goals:
${typeof profile?.careerGoals === "string" && profile.careerGoals.trim() ? profile.careerGoals.trim() : "Not provided"}

Résumé update:
Title: ${u.title}
Details: ${u.details}
Effective: ${u.effectiveDate || "unspecified"}

${resumeSnippet ? `Résumé on file (excerpt):\n${resumeSnippet}\n` : ""}

Contacts (JSON):
${JSON.stringify(contactList, null, 2)}

Return ONLY valid JSON (no markdown):
{
  "matches": [
    {
      "contactId": <number>,
      "relevanceScore": <0-100>,
      "reasons": ["One clear sentence: why this update fits what this contact is doing / would care about"]
    }
  ]
}

Rules:
- relevanceScore >= 65 only for genuine fits.
- reasons[0] should read like: "This fits well with [Name] because …" referencing their role/work.
- Do not invent facts about contacts not in the JSON.
- Order matches by relevanceScore descending.`
}

function parseAiMatches(text, contacts) {
  const trimmed = String(text || "").trim()
  if (!trimmed) throw new Error("Empty response from model")

  let raw = trimmed
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) raw = fenced[1].trim()

  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("Model did not return JSON")
  raw = raw.slice(start, end + 1)

  const parsed = JSON.parse(raw)
  if (!parsed || !Array.isArray(parsed.matches)) throw new Error("Invalid matches format")

  const byId = new Map(contacts.map((c) => [c.id, c]))
  const out = []

  for (const m of parsed.matches) {
    const id = Number(m.contactId)
    const contact = byId.get(id)
    if (!contact) continue
    const score = Number(m.relevanceScore)
    if (Number.isFinite(score) && score < 65) continue

    const reasons = Array.isArray(m.reasons)
      ? m.reasons.map((r) => String(r).trim()).filter(Boolean)
      : []
    if (reasons.length === 0) {
      reasons.push(buildThematicReason(contact, [], []))
    }

    out.push(formatContactRow(contact, reasons))
  }

  return out.slice(0, 5)
}

async function suggestContactsWithAI(anthropic, contacts, update, profile, fullResume) {
  if (!anthropic || contacts.length === 0) return []

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    messages: [{ role: "user", content: buildAiPrompt(update, contacts, profile, fullResume) }],
  })

  const textBlock = Array.isArray(message.content)
    ? message.content.find((b) => b.type === "text")
    : null
  const text = textBlock?.text ?? ""
  return parseAiMatches(text, contacts)
}

async function suggestContactsForUpdateSmart({
  anthropic,
  contacts,
  update,
  profile = {},
  fullResume = null,
}) {
  const list = Array.isArray(contacts) ? contacts.filter((c) => c?.name) : []
  const context = {
    careerGoals: typeof profile?.careerGoals === "string" ? profile.careerGoals.trim() : "",
    resumeText: typeof fullResume?.text === "string" ? fullResume.text : "",
  }

  if (list.length === 0) return []

  if (anthropic) {
    try {
      const aiMatches = await suggestContactsWithAI(anthropic, list, update, profile, fullResume)
      if (aiMatches.length > 0) return aiMatches
    } catch (err) {
      console.warn("AI contact relevance failed, using thematic fallback:", err.message)
    }
  }

  return suggestContactsThematically(list, update, context)
}

module.exports = {
  suggestContactsForUpdateSmart,
  suggestContactsThematically,
  detectThemes,
  buildThematicReason,
}
