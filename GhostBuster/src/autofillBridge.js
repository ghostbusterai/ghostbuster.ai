import { api } from "./api"

/**
 * Talks to the GhostBuster Autofill browser extension (ghostbuster-extension/) through window.postMessage.
 * The extension's app-bridge content script relays to its background worker, which opens the application
 * and fills it. Fill results come back here and are saved with the user's normal session.
 */

export const AUTOFILL_EVENT = "gb-autofill"

const handledReports = new Set()
let initialized = false

function emit(detail) {
  window.dispatchEvent(new CustomEvent(AUTOFILL_EVENT, { detail }))
}

function post(data) {
  window.postMessage({ source: "gb-app", ...data }, window.location.origin)
}

function localDate() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function extensionInstalled() {
  return Boolean(document.documentElement.dataset.gbAutofill)
}

async function saveReport(report) {
  if (report?.applicationId == null || handledReports.has(report.reportId)) return
  handledReports.add(report.reportId)
  try {
    await api.reportApplicationFill(report.applicationId, {
      questions: report.questions || [],
      reviewItems: report.reviewItems || [],
      filledCount: report.filledCount || 0,
      reviewed: Boolean(report.reviewed),
      submitted: Boolean(report.submitted),
      localDate: localDate(),
    })
    post({ type: "REPORT_ACK", reportId: report.reportId })
    emit({ type: "report", report })
  } catch (e) {
    if (e.status === 404) {
      // Application was deleted; nothing to save.
      post({ type: "REPORT_ACK", reportId: report.reportId })
    } else {
      // Not signed in or API down: leave it pending in the extension and retry on next load.
      handledReports.delete(report.reportId)
    }
  }
}

function linkedinHandle(url) {
  const m = String(url || "").match(/linkedin\.com\/in\/([^/?#]+)/i)
  return m ? decodeURIComponent(m[1]).toLowerCase() : ""
}

const handledContacts = new Set()

/** A LinkedIn profile saved from the extension. Skips people already in contacts. */
async function saveContact(contact) {
  if (!contact?.contactId || handledContacts.has(contact.contactId)) return
  handledContacts.add(contact.contactId)
  try {
    const handle = linkedinHandle(contact.linkedin)
    const { contacts } = await api.getContacts()
    const exists = (contacts || []).some((c) =>
      handle ? linkedinHandle(c.linkedin) === handle : c.name?.trim().toLowerCase() === contact.name.trim().toLowerCase()
    )
    if (!exists) {
      await api.createContact({
        name: contact.name,
        company: contact.company,
        role: contact.role,
        notes: contact.notes,
        linkedin: contact.linkedin,
      })
    }
    post({ type: "CONTACT_ACK", contactId: contact.contactId })
    emit({ type: "contact", contact, duplicate: exists })
  } catch {
    // Not signed in or API down: the extension keeps it and resends next time.
    handledContacts.delete(contact.contactId)
  }
}

/** Call once at startup, before the app renders, so pending fill results aren't missed. */
export function initAutofillBridge() {
  if (initialized) return
  initialized = true
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== window.location.origin) return
    const m = e.data
    if (!m || m.source !== "gb-extension") return
    if (m.type === "READY") {
      emit({ type: "ready", allSites: Boolean(m.allSites) })
      syncProfileToExtension()
      syncResumesToExtension()
    }
    else if (m.type === "FILL_STARTED") emit({ type: "started", ...m })
    else if (m.type === "FILL_REPORT") saveReport(m.report)
    else if (m.type === "SAVE_CONTACT") saveContact(m.contact)
  })
  post({ type: "PING" })
  // Coming back from LinkedIn or an application tab: collect anything the extension is holding.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") post({ type: "PING" })
  })
}

/** Ask the extension to resend fill results it's still holding (e.g. after signing in). */
export function requestPendingFillReports() {
  post({ type: "PING" })
}

/** Opens the application in a new tab and fills it. The user reviews and submits. */
export async function startFill(application) {
  if (!extensionInstalled()) throw new Error("Install the GhostBuster Autofill extension to fill applications.")
  if (!application?.url) throw new Error("Add the application link first.")
  const { autofill } = await api.getAutofillProfile()
  post({
    type: "START_FILL",
    job: {
      application: {
        id: application.id,
        url: application.url,
        company: application.company || "",
        role: application.role || "",
      },
      profile: autofill,
    },
  })
}

/** Give the extension the latest autofill profile so "Fill this page" works on any site. */
export async function syncProfileToExtension() {
  if (!extensionInstalled()) return
  try {
    const { autofill } = await api.getAutofillProfile()
    post({ type: "SYNC_PROFILE", profile: autofill })
  } catch {
    /* not signed in yet; synced again after sign-in */
  }
}

/** Give the extension your résumé files so it can offer them on applications and in Gmail. */
export async function syncResumesToExtension() {
  if (!extensionInstalled()) return
  try {
    const { files } = await api.getResumeFiles()
    post({ type: "SYNC_RESUMES", files: files || [] })
  } catch {
    /* not signed in yet; synced again after sign-in */
  }
}

/** Opens the extension's prompt to let it run on any site (follows jobs off the big ATS sites). */
export function requestAllSitesAccess() {
  post({ type: "REQUEST_ALL_SITES" })
}
