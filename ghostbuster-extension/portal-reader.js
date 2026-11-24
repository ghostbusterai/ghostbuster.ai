/**
 * Reads visible application status on ATS candidate / application status pages.
 * Runs alongside filler.js on supported hosts when a portal sync job is active.
 */
;(() => {
  if (window.__gbPortalReader) return
  window.__gbPortalReader = true

  function textOf(el) {
    return String(el?.innerText || el?.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
  }

  function readStatus() {
    const selectors = [
      '[data-automation-id="applicationStatus"]',
      '[data-automation-id="progressBarActiveStep"]',
      ".application-status",
      ".status-label",
      '[class*="ApplicationStatus"]',
      '[class*="application-status"]',
      "main h1",
      "main h2",
    ]

    let statusText = ""
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      const t = textOf(el)
      if (t && t.length > 2 && t.length < 240) {
        statusText = t
        break
      }
    }

    const body = textOf(document.body).toLowerCase()
    if (!statusText) {
      if (body.includes("under review")) statusText = "Under review"
      else if (body.includes("interview")) statusText = "Interview in progress"
      else if (body.includes("not selected")) statusText = "Not selected"
      else if (body.includes("offer")) statusText = "Offer stage"
      else if (body.includes("submitted")) statusText = "Application submitted"
    }

    return {
      statusText,
      title: document.title || "",
      url: location.href,
    }
  }

  function publish() {
    chrome.runtime.sendMessage({ type: "GET_JOB" }, (resp) => {
      if (!resp?.job || resp.job.mode !== "portal") return
      const report = readStatus()
      if (!report.statusText && !report.title) return
      chrome.runtime.sendMessage({ type: "PORTAL_STATUS", report })
    })
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(publish, 1200)
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(publish, 1200))
  }
})()