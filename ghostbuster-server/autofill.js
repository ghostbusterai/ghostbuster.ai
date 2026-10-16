/**
 * Autofill profile (the answers the browser extension types into Workday / Greenhouse / Lever / Ashby forms)
 * and the fill-status fields stored on each application.
 */

const AUTOFILL_FIELDS = [
  "firstName",
  "lastName",
  "preferredName",
  "email",
  "phone",
  "addressLine1",
  "city",
  "state",
  "postalCode",
  "country",
  "linkedin",
  "github",
  "website",
  "school",
  "degree",
  "major",
  "graduationDate",
  "gpa",
  "currentCompany",
  "currentTitle",
  "workAuthorized",
  "needsSponsorship",
  "gender",
  "ethnicity",
  "veteran",
  "disability",
]

const MAX_FIELD_LENGTH = 300

function sanitizeAutofill(raw) {
  const src = raw && typeof raw === "object" ? raw : {}
  const out = {}
  for (const key of AUTOFILL_FIELDS) {
    const v = src[key]
    out[key] = typeof v === "string" ? v.trim().slice(0, MAX_FIELD_LENGTH) : ""
  }
  return out
}

/** Fill blanks from what GhostBuster already knows (profile name, Google account email). */
function withAutofillDefaults(autofill, { name = "", email = "" } = {}) {
  const out = sanitizeAutofill(autofill)
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean)
  if (!out.firstName && parts.length) out.firstName = parts[0]
  if (!out.lastName && parts.length > 1) out.lastName = parts.slice(1).join(" ")
  if (!out.email && email) out.email = email
  return out
}

const FILL_STATUSES = new Set(["", "needs_review", "needs_input", "reviewed"])

function fillStatus(value, fallback = "") {
  const s = String(value ?? fallback)
  return FILL_STATUSES.has(s) ? s : fallback
}

function fillQuestions(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((q) => String(q || "").trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 20)
}

module.exports = {
  AUTOFILL_FIELDS,
  sanitizeAutofill,
  withAutofillDefaults,
  fillStatus,
  fillQuestions,
}
