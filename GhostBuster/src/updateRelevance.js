/**
 * Client-side contact matching for résumé updates (offline / API fallback).
 * Thematic alignment — does not require the update to mention a contact's company or role.
 * Keep themes in sync with ghostbuster-server/contactRelevance.js
 */

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

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
  "share",
  "update",
  "recent",
  "recently",
  "added",
  "completed",
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
    return { title: "", details: update }
  }
  return {
    title: String(update?.title || "").trim(),
    details: String(update?.details || "").trim(),
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

function buildThematicReason(contact, sharedThemes, sharedTokens) {
  const role = String(contact.role || "").trim()
  const company = String(contact.company || "").trim()
  const who = role && company ? `${role} at ${company}` : role || company || "their background"

  if (sharedThemes.length > 0) {
    const labels = sharedThemes.slice(0, 2).map((t) => THEME_LABELS[t] || t)
    return `This update fits what ${contact.name} is doing (${who}). You both touch ${labels.join(" and ")}.`
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

/**
 * @param {Array} contacts
 * @param {object|string} update — { title, details } or legacy haystack string
 * @param {{ careerGoals?: string, resumeText?: string }} context
 */
export function suggestContactsForUpdate(contacts, update, context = {}) {
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
      scored.push({ contact: c, score, sharedThemes, sharedTokens })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 8).map(({ contact, sharedThemes, sharedTokens }) => ({
    contactId: contact.id,
    name: contact.name,
    company: contact.company || "",
    role: contact.role || "",
    reasons: [buildThematicReason(contact, sharedThemes, sharedTokens)],
  }))
}
