/**
 * Routes messages between the GhostBuster app tab and the application tabs it opens, and follows each
 * job wherever it goes: redirects, "Apply" links that open new tabs, and forms embedded in iframes.
 *
 * jobs (storage.session): { [tabId]: { application, profile, appTabId, hops, promptedOrigins } }
 * pendingReports (storage.local): fill results not yet saved by the app (survive the app tab closing)
 *
 * Known ATS hosts get filler.js from the manifest. Every other site needs host permission, which the
 * user grants per site or for all sites (optional_host_permissions); until then nothing runs there.
 */

const ALL_SITES = ["https://*/*", "http://*/*"]
const MAX_APPLY_HOPS = 6

async function getJobs() {
  const { jobs } = await chrome.storage.session.get("jobs")
  return jobs || {}
}

async function setJobs(jobs) {
  await chrome.storage.session.set({ jobs })
}

async function updateJob(tabId, fn) {
  const jobs = await getJobs()
  if (!jobs[tabId]) return null
  jobs[tabId] = fn(jobs[tabId]) || jobs[tabId]
  await setJobs(jobs)
  return jobs[tabId]
}

async function getPending() {
  const { pendingReports } = await chrome.storage.local.get("pendingReports")
  return pendingReports || []
}

function originPattern(url) {
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol)) return null
    return `${u.origin}/*`
  } catch {
    return null
  }
}

async function hasAccess(url) {
  const pattern = originPattern(url)
  return pattern ? chrome.permissions.contains({ origins: [pattern] }) : false
}

async function hasAllSites() {
  return chrome.permissions.contains({ origins: ALL_SITES })
}

function openPermissionWindow(params) {
  const q = new URLSearchParams(params)
  return chrome.windows.create({
    url: chrome.runtime.getURL(`permission.html?${q}`),
    type: "popup",
    width: 440,
    height: 330,
  })
}

/** Inject the filler into one frame of a job tab, or ask once per site for permission. */
async function ensureFiller(tabId, frameId, url) {
  const jobs = await getJobs()
  const job = jobs[tabId]
  if (!job) return
  const pattern = originPattern(url)
  if (!pattern) return

  if (await hasAccess(url)) {
    await chrome.scripting
      .executeScript({ target: { tabId, frameIds: [frameId] }, files: ["filler.js"] })
      .catch(() => {
        /* frame went away or is a browser page */
      })
    return
  }

  const prompted = job.promptedOrigins || []
  if (prompted.includes(pattern)) return
  await updateJob(tabId, (j) => ({ ...j, promptedOrigins: [...prompted, pattern] }))
  await openPermissionWindow({ origin: new URL(url).origin, tabId: String(tabId) })
}

chrome.webNavigation.onCompleted.addListener(({ tabId, frameId, url }) => {
  ensureFiller(tabId, frameId, url)
})

// "Apply" links that open a new tab carry the job with them.
chrome.webNavigation.onCreatedNavigationTarget.addListener(async ({ sourceTabId, tabId }) => {
  const jobs = await getJobs()
  if (!jobs[sourceTabId]) return
  jobs[tabId] = { ...jobs[sourceTabId] }
  await setJobs(jobs)
})

// After the user grants access, fill the job tabs that were waiting on it.
chrome.permissions.onAdded.addListener(async () => {
  const jobs = await getJobs()
  for (const tabId of Object.keys(jobs).map(Number)) {
    const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => null)
    for (const f of frames || []) {
      if (await hasAccess(f.url)) {
        await chrome.scripting
          .executeScript({ target: { tabId, frameIds: [f.frameId] }, files: ["filler.js"] })
          .catch(() => {})
      }
    }
  }
})

async function injectInto(tabId) {
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["filler.js"] }).catch(() => {})
  await chrome.tabs.sendMessage(tabId, { type: "FILL_NOW" }).catch(() => {})
}

async function handle(msg, sender) {
  switch (msg?.type) {
    case "START_FILL": {
      const url = msg.job?.application?.url
      if (!url || !/^https?:\/\//i.test(url)) return { ok: false, error: "This application has no link." }
      // Record the job before the page loads, or the filler can ask for it before it exists.
      if (msg.job.profile) await chrome.storage.local.set({ lastProfile: msg.job.profile })
      const tab = await chrome.tabs.create({ url: "about:blank" })
      const jobs = await getJobs()
      jobs[tab.id] = { ...msg.job, appTabId: sender.tab?.id ?? null, hops: 0, promptedOrigins: [] }
      await setJobs(jobs)
      await chrome.tabs.update(tab.id, { url })
      return { ok: true }
    }

    case "SYNC_PROFILE":
      if (msg.profile) await chrome.storage.local.set({ lastProfile: msg.profile })
      return { ok: true }

    case "GET_STATUS":
      return { allSites: await hasAllSites() }

    case "REQUEST_ALL_SITES":
      await openPermissionWindow({ all: "1" })
      return { ok: true }

    case "GET_JOB": {
      const tabId = sender.tab?.id
      const jobs = await getJobs()
      const { lastProfile, resumeFile } = await chrome.storage.local.get(["lastProfile", "resumeFile"])
      const job = tabId != null ? jobs[tabId] : null
      return {
        job: job || null,
        profile: job?.profile || lastProfile || null,
        resumeFile: resumeFile || null,
      }
    }

    // The filler asks before clicking an "Apply" button so a job can't bounce between pages forever.
    case "APPLY_HOP": {
      const tabId = sender.tab?.id
      const job = await updateJob(tabId, (j) => (j.hops >= MAX_APPLY_HOPS ? j : { ...j, hops: (j.hops || 0) + 1 }))
      return { ok: Boolean(job) && job.hops <= MAX_APPLY_HOPS }
    }

    case "FILL_REPORT": {
      const tabId = sender.tab?.id
      const jobs = await getJobs()
      const job = tabId != null ? jobs[tabId] : null
      const applicationId = job?.application?.id
      if (applicationId == null) return { ok: false }
      const report = { ...msg.report, applicationId, reportId: `${applicationId}-${Date.now()}` }
      // Keep only the latest report per application.
      const pending = (await getPending()).filter((r) => r.applicationId !== applicationId)
      pending.push(report)
      await chrome.storage.local.set({ pendingReports: pending })
      if (job.appTabId != null) {
        chrome.tabs.sendMessage(job.appTabId, { type: "FILL_REPORT", report }).catch(() => {
          /* app tab closed — delivered next time GhostBuster opens */
        })
      }
      return { ok: true }
    }

    case "REPORT_ACK": {
      const pending = (await getPending()).filter((r) => r.reportId !== msg.reportId)
      await chrome.storage.local.set({ pendingReports: pending })
      return { ok: true }
    }

    case "APP_READY":
      return { pending: await getPending() }

    // From the popup: fill the tab the user is looking at (activeTab grants access for this click).
    case "FILL_ACTIVE_TAB": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return { ok: false, error: "No active tab." }
      await injectInto(tab.id)
      return { ok: true }
    }

    default:
      return null
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender)
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: e.message }))
  return true
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const jobs = await getJobs()
  if (jobs[tabId]) {
    delete jobs[tabId]
    await setJobs(jobs)
  }
})
