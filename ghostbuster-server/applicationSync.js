const gmail = require("./gmail")
const { planEmailSync, isoDateOnly } = require("./applicationEmailSync")
const { normalizePipelineStatus } = require("./applicationPipeline")

async function syncApplicationsFromEmail(store, userId, refreshToken, { dryRun = false } = {}) {
  const messages = await gmail.listRecruitingMessages(refreshToken, { maxResults: 50, newerThanDays: 45 })
  const { applications } = await store.getApplications(userId)
  const { updates, unmatched, scanned } = planEmailSync(applications || [], messages)

  const applied = []
  if (!dryRun) {
    for (const u of updates) {
      const patch = {
        pipelineStatus: u.pipelineStatus,
        statusNote: u.statusNote,
        markPortalChecked: true,
        lastEmailSyncId: u.lastEmailSyncId,
        lastEmailSyncAt: u.lastEmailSyncAt,
      }
      if (u.status) patch.status = u.status
      const out = await store.patchApplication(userId, u.applicationId, patch)
      if (out?.application) {
        applied.push({
          applicationId: u.applicationId,
          company: out.application.company,
          role: out.application.role,
          pipelineStatus: u.pipelineStatus,
          subject: u.subject,
        })
      }
    }

    const profilePatch = {
      applicationSync: {
        lastEmailSyncAt: new Date().toISOString(),
        lastEmailScanCount: scanned,
        lastEmailUpdateCount: applied.length,
      },
    }
    await store.patchProfile(userId, profilePatch)
  }

  return {
    dryRun,
    scanned,
    planned: updates.length,
    updated: applied,
    unmatched: unmatched.slice(0, 8),
    needsReconnect: false,
  }
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

module.exports = { syncApplicationsFromEmail, applyPortalSync }