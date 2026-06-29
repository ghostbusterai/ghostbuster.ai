/** Match contacts to role-based résumé buckets using the contact's job role only. */

export const SUGGESTED_BUCKET_NAMES = [
  "Product Management",
  "Software Engineering",
  "Data Science",
  "Consulting",
  "Finance",
  "Marketing",
  "Design",
  "Operations",
]

const ROLE_KEYWORDS = {
  product: ["product", "pm", "product manager"],
  software: ["software", "engineer", "engineering", "developer", "swe", "backend", "frontend", "full stack", "fullstack"],
  data: ["data", "analyst", "analytics", "scientist", "ml", "machine learning"],
  consulting: ["consulting", "consultant", "strategy", "advisory"],
  finance: ["finance", "financial", "banking", "investment", "accounting"],
  marketing: ["marketing", "brand", "growth"],
  design: ["design", "designer", "ux", "ui"],
  operations: ["operations", "ops", "program manager", "project manager"],
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokens(text) {
  return normalize(text).split(" ").filter(Boolean)
}

export function scoreRoleToBucket(roleText, bucketName) {
  const role = normalize(roleText)
  const bucket = normalize(bucketName)
  if (!role || !bucket) return 0
  if (bucket.includes(role) || role.includes(bucket)) return 100

  let score = 0
  const roleToks = tokens(roleText)
  const bucketToks = tokens(bucketName)
  for (const rt of roleToks) {
    for (const bt of bucketToks) {
      if (rt.length < 3 || bt.length < 3) continue
      if (rt === bt || rt.includes(bt) || bt.includes(rt)) score += 10
    }
  }

  for (const keywords of Object.values(ROLE_KEYWORDS)) {
    const bucketHit = keywords.some((k) => bucket.includes(k))
    const roleHit = keywords.some((k) => role.includes(k))
    if (bucketHit && roleHit) score += 25
  }

  return score
}

export function suggestResumeBucket(roleText, buckets) {
  const list = Array.isArray(buckets) ? buckets : []
  if (!String(roleText || "").trim() || list.length === 0) return null

  let best = null
  let bestScore = 0
  for (const bucket of list) {
    const score = scoreRoleToBucket(roleText, bucket.name)
    if (score > bestScore) {
      bestScore = score
      best = bucket
    }
  }
  return bestScore >= 10 ? best : null
}

export function resolveContactResumeBucket(contact, buckets) {
  const list = Array.isArray(buckets) ? buckets : []
  if (contact?.resumeBucketId != null) {
    const explicit = list.find((b) => b.id === contact.resumeBucketId)
    if (explicit) return explicit
  }
  return suggestResumeBucket(contact?.role, list)
}

export function bucketNameForContact(contact, buckets) {
  return resolveContactResumeBucket(contact, buckets)?.name || null
}
