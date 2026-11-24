const { normalizePipelineStatus, pipelineFromLegacyStatus, isoDateOnly } = require("./applicationPipeline")

const PIPELINE_ORDER = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]

function classifyEmailStatus(subject, snippet) {
  const text = `${subject} ${snippet}`.toLowerCase()

  if (/\b(reject|not moving forward|unfortunately|regret to inform|not selected|no longer consider)\b/.test(text)) {
    return { pipelineStatus: "rejected", note: subject.trim() }
  }
  if (/\b(offer|pleased to offer|congratulations on your offer|extend an offer)\b/.test(text)) {
    return { pipelineStatus: "offer", note: subject.trim() }
  }
  if (/\b(interview|speak with|schedule.*call|meet the team|calendar invite|onsite)\b/.test(text)) {
    return { pipelineStatus: "interview", note: subject.trim() }
  }
  if (/\b(assessment|hacker ?rank|codesignal|take[- ]home|questionnaire|complete the following|coding challenge|oa)\b/.test(text)) {
    return { pipelineStatus: "screening", note: subject.trim() }
  }
  if (/\b(thank you for applying|application received|received your application|application submitted|we received your)\b/.test(text)) {
    return { pipelineStatus: "applied", note: subject.trim() }
  }
  return null
}

function canAdvancePipeline(from, to) {
  if (to === "rejected" || to === "withdrawn") return true
  const a = PIPELINE_ORDER.indexOf(from)
  const b = PIPELINE_ORDER.indexOf(to)
  if (a < 0 || b < 0) return true
  return b >= a
}

function tokenizeCompany(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

function matchScore(app, email) {
  const blob = `${email.subject} ${email.snippet} ${email.from}`.toLowerCase()
  let score = 0
  const company = (app.company || "").toLowerCase()
  const role = (app.role || "").toLowerCase()

  if (company && blob.includes(company)) score += 12
  else {
    for (const tok of tokenizeCompany(app.company)) {
      if (tok.length > 3 && blob.includes(tok)) score += 4
    }
  }

  if (role) {
    if (blob.includes(role)) score += 8
    else {
      const first = role.split(/\s+/)[0]
      if (first.length > 3 && blob.includes(first)) score += 3
    }
  }

  try {
    const host = new URL(app.portalUrl || app.url || "").hostname.replace(/^www\./, "")
    const brand = host.split(".")[0]
    if (brand.length > 3 && blob.includes(brand)) score += 4
  } catch {
    /* no url */
  }

  return score
}

function pickMatch(applications, email) {
  let best = null
  let bestScore = 0
  for (const app of applications) {
    const score = matchScore(app, email)
    if (score > bestScore) {
      bestScore = score
      best = app
    }
  }
  if (!best || bestScore < 8) return null
  return { application: best, score: bestScore }
}

/**
 * Scan Gmail metadata and return patches (does not write).
 */
function planEmailSync(applications, messages) {
  const updates = []
  const unmatched = []

  for (const email of messages) {
    const classified = classifyEmailStatus(email.subject, email.snippet)
    if (!classified) continue

    const match = pickMatch(applications, email)
    if (!match) {
      unmatched.push({ messageId: email.id, subject: email.subject, ...classified })
      continue
    }

    const app = match.application
    const prevPipeline = app.pipelineStatus
      ? normalizePipelineStatus(app.pipelineStatus)
      : pipelineFromLegacyStatus(app.status)

    if (app.lastEmailSyncId === email.id) continue
    if (!canAdvancePipeline(prevPipeline, classified.pipelineStatus)) continue

    const patch = {
      applicationId: app.id,
      messageId: email.id,
      subject: email.subject,
      previousPipeline: prevPipeline,
      pipelineStatus: classified.pipelineStatus,
      statusNote: classified.note,
      markPortalChecked: true,
      lastEmailSyncId: email.id,
      lastEmailSyncAt: new Date().toISOString(),
    }

    if (classified.pipelineStatus !== "saved") {
      patch.status = "completed"
    }

    updates.push(patch)

    // So multiple emails in one batch don't double-match the same stale row
    app.pipelineStatus = classified.pipelineStatus
    app.lastEmailSyncId = email.id
  }

  return { updates, unmatched, scanned: messages.length }
}

module.exports = {
  classifyEmailStatus,
  planEmailSync,
  canAdvancePipeline,
  isoDateOnly,
}