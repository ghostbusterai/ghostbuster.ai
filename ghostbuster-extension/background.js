/**
 * Routes messages between the GhostBuster app tab and the application tabs it opens, and follows each
 * job wherever it goes: redirects, "Apply" links that open new tabs, and forms embedded in iframes.
 *
 * jobs (storage.session): { [tabId]: { application, profile, appTabId, hops, promptedOrigins } }
 * pendingReports (storage.local): fill results not yet saved by the app (survive the app tab closing)
 * pendingContacts (storage.local): LinkedIn profiles the user saved, waiting for the app to add them
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

async function getPendingContacts() {
  const { pendingContacts } = await chrome.storage.local.get("pendingContacts")
  return pendingContacts || []
}

/** Tabs running the GhostBuster app, recorded when their app-bridge says hello (APP_READY). */
async function appTabs() {
  const { appTabIds } = await chrome.storage.session.get("appTabIds")
  return appTabIds || []
}

async function setAppTabs(ids) {
  await chrome.storage.session.set({ appTabIds: [...new Set(ids)] })
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
      .executeScript({ target: { tabId, frameIds: [frameId] }, files: ["resume-picker.js", "filler.js"] })
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
          .executeScript({ target: { tabId, frameIds: [f.frameId] }, files: ["resume-picker.js", "filler.js"] })
          .catch(() => {})
      }
    }
  }
})

async function injectInto(tabId) {
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["resume-picker.js", "filler.js"] }).catch(() => {})
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

    // From the app: résumé files from your buckets, offered on applications and in Gmail.
    case "SYNC_RESUMES":
      await chrome.storage.local.set({ resumeFiles: Array.isArray(msg.files) ? msg.files : [] })
      return { ok: true }

    case "GET_RESUMES": {
      const { resumeFiles } = await chrome.storage.local.get("resumeFiles")
      return { files: resumeFiles || [] }
    }

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
      if (sender.tab?.id != null) await setAppTabs([...(await appTabs()), sender.tab.id])
      return { pending: await getPending(), contacts: await getPendingContacts() }

    // From linkedin.js: the user saved the profile they're viewing.
    case "SAVE_CONTACT": {
      const c = msg.contact || {}
      if (!String(c.name || "").trim()) return { ok: false, error: "Name is required." }
      const contact = {
        name: String(c.name).slice(0, 120),
        company: String(c.company || "").slice(0, 120),
        role: String(c.role || "").slice(0, 120),
        notes: String(c.notes || "").slice(0, 500),
        linkedin: String(c.linkedin || "").slice(0, 300),
        contactId: `li-${Date.now()}`,
      }
      const pending = (await getPendingContacts()).filter((p) => !contact.linkedin || p.linkedin !== contact.linkedin)
      pending.push(contact)
      await chrome.storage.local.set({ pendingContacts: pending })
      // Deliver to open GhostBuster tabs; ones that closed or navigated away are forgotten.
      const live = []
      for (const id of await appTabs()) {
        const resp = await chrome.tabs.sendMessage(id, { type: "SAVE_CONTACT", contact }).catch(() => null)
        if (resp?.app) live.push(id)
      }
      await setAppTabs(live)
      return { ok: true, delivered: live.length > 0 }
    }

    case "CONTACT_ACK": {
      const pending = (await getPendingContacts()).filter((p) => p.contactId !== msg.contactId)
      await chrome.storage.local.set({ pendingContacts: pending })
      return { ok: true }
    }

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

// After an install, update or reload, Chrome disconnects the scripts in tabs that were already open,
// so an open GhostBuster or LinkedIn tab would stop working until refreshed. Reconnect them.
chrome.runtime.onInstalled.addListener(async () => {
  const targets = [
    { url: ["http://localhost/*", "http://127.0.0.1/*", "https://*.onrender.com/*"], file: "app-bridge.js" },
    { url: ["https://www.linkedin.com/*"], file: "linkedin.js" },
    { url: ["https://mail.google.com/*"], files: ["resume-picker.js", "gmail.js"] },
  ]
  for (const { url, file, files } of targets) {
    for (const tab of await chrome.tabs.query({ url }).catch(() => [])) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: files || [file] }).catch(() => {})
    }
  }
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await setAppTabs((await appTabs()).filter((id) => id !== tabId))
  const jobs = await getJobs()
  if (jobs[tabId]) {
    delete jobs[tabId]
    await setJobs(jobs)
  }
})
