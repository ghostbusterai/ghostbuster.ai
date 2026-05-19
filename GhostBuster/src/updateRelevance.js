/**
 * Heuristic: which contacts might care about this résumé/career update text.
 * Keep in sync with ghostbuster-server/relevance.js
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
])

export function suggestContactsForUpdate(contacts, haystack) {
  const lower = String(haystack).toLowerCase()
  const suggestions = []

  for (const c of contacts) {
    const reasons = []

    const company = String(c.company || "").trim()
    if (company.length >= 2 && lower.includes(company.toLowerCase())) {
      reasons.push(`Your update mentions ${company}, which is on their contact card as employer.`)
    }

    const role = String(c.role || "").trim()
    if (role.length >= 3) {
      const rl = role.toLowerCase()
      if (lower.includes(rl)) {
        reasons.push(`Your update text includes their role (${role}).`)
      } else {
        const parts = role
          .split(/[\s,/&]+/)
          .map((p) => p.trim().toLowerCase())
          .filter((p) => p.length >= 4)
        for (const p of parts) {
          if (lower.includes(p)) {
            reasons.push(`A keyword from their role (${role}) appears in your update.`)
            break
          }
        }
      }
    }

    const fullName = String(c.name || "").trim()
    const first = fullName.split(/\s+/)[0] || ""
    if (first.length >= 4 && lower.includes(first.toLowerCase())) {
      reasons.push(
        `Their first name (${first}) appears in the text — useful only if you meant to reference them personally.`
      )
    }

    const notes = String(c.notes || "").trim()
    if (notes.length >= 5) {
      const sig = [...new Set(tokenize(notes))].filter((w) => w.length >= 5 && !STOP.has(w)).slice(0, 30)
      for (const w of sig) {
        if (lower.includes(w)) {
          reasons.push(`Topic "${w}" appears in both your update and your notes on this contact.`)
          break
        }
      }
    }

    let site = String(c.website || "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split("?")[0]
    site = site.replace(/\.$/, "").trim()
    if (site.length >= 4 && lower.includes(site.toLowerCase())) {
      reasons.push(`Their website domain (${site}) appears in your update.`)
    }

    if (reasons.length) {
      suggestions.push({
        contactId: c.id,
        name: c.name,
        company: c.company || "",
        role: c.role || "",
        reasons: [...new Set(reasons)].slice(0, 5),
      })
    }
  }

  return suggestions.slice(0, 10)
}
