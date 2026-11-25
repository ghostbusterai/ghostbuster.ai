const gmail = require("./gmail")
const { planEmailSync, isoDateOnly } = require("./applicationEmailSync")
const { normalizePipelineStatus } = require("./applicationPipeline")

function proposedFromUpdates(applications, updates) {
  return (updates || []).map((u) => {
    const app = (applications || []).find((a) => a.id === u.applicationId)
    return {
      applicationId: u.applicationId,
      messageId: u.messageId,
      company: app?.company || "",
      role: app?.role || "",
      previousPipeline: u.previousPipeline,
      pipelineStatus: u.pipelineStatus,
      subject: u.subject,
      statusNote: u.statusNote,
      status: u.status,
    }
  })
}

async function applyEmailSyncPatch(store, userId, u) {
  const patch = {
    pipelineStatus: u.pipelineStatus,
    statusNote: u.statusNote,
    markPortalChecked: true,
    lastEmailSyncId: u.messageId || u.lastEmailSyncId,
    lastEmailSyncAt: u.lastEmailSyncAt || new Date().toISOString(),
  }
  if (u.status) patch.status = u.status
  else if (u.pipelineStatus && u.pipelineStatus !== "saved") patch.status = "completed"

  const out = await store.patchApplication(userId, u.applicationId, patch)
  if (!out?.application) return null
  return {
    applicationId: u.applicationId,
    company: out.application.company,
    role: out.application.role,
    pipelineStatus: u.pipelineStatus,
    subject: u.subject,
  }
}

async function syncApplicationsFromEmail(store, userId, refreshToken, { dryRun = false } = {}) {
  const messages = await gmail.listRecruitingMessages(refreshToken, { maxResults: 50, newerThanDays: 45 })
  const { applications } = await store.getApplications(userId)
  const { updates, unmatched, scanned } = planEmailSync(applications || [], messages)
  const proposed = proposedFromUpdates(applications, updates)

  const applied = []
  if (!dryRun) {
    for (const u of updates) {
      const row = await applyEmailSyncPatch(store, userId, u)
      if (row) applied.push(row)
    }

    await store.patchProfile(userId, {
      applicationSync: {
        lastEmailSyncAt: new Date().toISOString(),
        lastEmailScanCount: scanned,
        lastEmailUpdateCount: applied.length,
      },
    })
  }

  return {
    dryRun,
    scanned,
    planned: updates.length,
    proposed,
    updated: applied,
    unmatched: unmatched.slice(0, 8),
    needsReconnect: false,
  }
}

/** Apply updates the user accepted from the Gmail review queue. */
async function applyEmailSyncUpdates(store, userId, rawUpdates) {
  const list = Array.isArray(rawUpdates) ? rawUpdates : []
  const applied = []
  for (const u of list) {
    const id = Number(u.applicationId)
    if (!Number.isFinite(id) || !u.messageId) continue
    const row = await applyEmailSyncPatch(store, userId, { ...u, applicationId: id })
    if (row) applied.push(row)
  }

  await store.patchProfile(userId, {
    applicationSync: {
      lastEmailSyncAt: new Date().toISOString(),
      lastEmailUpdateCount: applied.length,
    },
  })

  return { updated: applied, count: applied.length }
}

async function applyPortalSync(store, userId, body) {
  const id = Number(body.applicationId)
  if (!Number.isFinite(id)) throw new Error("Invalid application id")

  const statusText = typeof body.statusText === "string" ? body.statusText.trim() : ""
  let pipelineStatus = body.pipelineStatus
    ? normalizePipelineStatus(body.pipelineStatus)
    : null

  if (!pipelineStatus && statusText) {
    const lower = statusText.toLowerCase()
    if (/reject|not selected|closed|no longer/.test(lower)) pipelineStatus = "rejected"
    else if (/offer/.test(lower)) pipelineStatus = "offer"
    else if (/interview|scheduled/.test(lower)) pipelineStatus = "interview"
    else if (/review|assessment|questionnaire|submitted/.test(lower)) pipelineStatus = "screening"
    else if (/applied|received/.test(lower)) pipelineStatus = "applied"
  }

  const patch = {
    markPortalChecked: true,
    lastPortalCheck: isoDateOnly(),
    portalSyncAt: new Date().toISOString(),
  }
  if (statusText) patch.statusNote = statusText.slice(0, 500)
  if (pipelineStatus) {
    patch.pipelineStatus = pipelineStatus
    if (pipelineStatus !== "saved") patch.status = "completed"
  }

  const out = await store.patchApplication(userId, id, patch)
  if (!out?.application) return null

  await store.patchProfile(userId, {
    applicationSync: {
      lastPortalSyncAt: new Date().toISOString(),
      lastPortalApplicationId: id,
    },
  })

  return out.application
}

module.exports = { syncApplicationsFromEmail, applyEmailSyncUpdates, applyPortalSync }