/**
 * Runs on the GhostBuster web app. Relays window.postMessage traffic between the page and the
 * extension so the app never needs the extension's id, and fill results are saved with the
 * user's normal signed-in session.
 */
;(() => {
  if (!document.querySelector('meta[name="ghostbuster-app"]')) return

  const VERSION = chrome.runtime.getManifest().version
  const origin = window.location.origin
  const post = (data) => window.postMessage({ source: "gb-extension", ...data }, origin)

  function announce() {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (status) => {
      post({ type: "READY", version: VERSION, allSites: Boolean(status?.allSites) })
    })
    chrome.runtime.sendMessage({ type: "APP_READY" }, (resp) => {
      for (const report of resp?.pending || []) post({ type: "FILL_REPORT", report })
      for (const contact of resp?.contacts || []) post({ type: "SAVE_CONTACT", contact })
    })
  }

  document.documentElement.dataset.gbAutofill = VERSION
  announce()

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== origin) return
    const m = e.data
    if (!m || m.source !== "gb-app") return

    if (m.type === "PING") {
      announce()
    } else if (m.type === "START_FILL") {
      chrome.runtime.sendMessage({ type: "START_FILL", job: m.job }, (resp) => {
        post({
          type: "FILL_STARTED",
          applicationId: m.job?.application?.id,
          ok: Boolean(resp?.ok),
          error: resp?.error || (chrome.runtime.lastError ? "Extension unavailable — reload the page." : ""),
        })
      })
    } else if (m.type === "SYNC_PROFILE") {
      chrome.runtime.sendMessage({ type: "SYNC_PROFILE", profile: m.profile })
    } else if (m.type === "REQUEST_ALL_SITES") {
      chrome.runtime.sendMessage({ type: "REQUEST_ALL_SITES" })
    } else if (m.type === "REPORT_ACK") {
      chrome.runtime.sendMessage({ type: "REPORT_ACK", reportId: m.reportId })
    } else if (m.type === "CONTACT_ACK") {
      chrome.runtime.sendMessage({ type: "CONTACT_ACK", contactId: m.contactId })
    }
  })

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "FILL_REPORT") post({ type: "FILL_REPORT", report: msg.report })
    else if (msg?.type === "SAVE_CONTACT") {
      post({ type: "SAVE_CONTACT", contact: msg.contact })
      sendResponse({ app: true })
    }
  })
})()
