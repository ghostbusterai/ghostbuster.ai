/**
 * In dev, default to same-origin + Vite proxy → backend on :3001 (works for other devices on your LAN).
 * Set VITE_API_BASE only when you need to override (e.g. production build hitting a deployed API).
 */
function apiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE
  if (fromEnv != null && String(fromEnv).trim() !== "") {
    return String(fromEnv).replace(/\/$/, "")
  }
  if (import.meta.env.DEV) return ""
  // Production: same origin when UI is served by the API (e.g. Render). Set VITE_API_BASE if API is elsewhere.
  return ""
}

const BASE = apiBase()

function parseBody(text, response) {
  if (!text) return {}
  const trimmed = text.trim()
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<!DOCTYPE")) {
    const hint =
      BASE === ""
        ? " Start the API: cd ghostbuster-server && npm start"
        : " Check that the API is running and VITE_API_BASE is correct."
    throw new Error(`API returned HTML instead of JSON (${response.status}).${hint}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Invalid API response (${response.status})`)
  }
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) }
  let r
  try {
    r = await fetch(`${BASE}${path}`, {
      headers,
      credentials: "include",
      ...options,
    })
  } catch {
    const hint =
      BASE === ""
        ? " (Vite dev proxy → port 3001). Run: cd ghostbuster-server && npm start"
        : `: ${BASE}. Run the API or fix VITE_API_BASE`
    throw new Error(`Can't reach API${hint}`)
  }
  if (r.status === 204) return {}
  const text = await r.text()
  const data = parseBody(text, r)
  if (!r.ok) {
    const err = new Error(data.error || r.statusText || `Request failed (${r.status})`)
    err.status = r.status
    throw err
  }
  return data
}

async function uploadRequest(path, formData) {
  let r
  try {
    r = await fetch(`${BASE}${path}`, { method: "POST", body: formData, credentials: "include" })
  } catch {
    const hint =
      BASE === ""
        ? " (Vite dev proxy → port 3001). Run: cd ghostbuster-server && npm start"
        : `: ${BASE}. Run the API or fix VITE_API_BASE`
    throw new Error(`Can't reach API${hint}`)
  }
  const text = await r.text()
  const data = parseBody(text, r)
  if (!r.ok) {
    const err = new Error(data.error || r.statusText || `Request failed (${r.status})`)
    err.status = r.status
    throw err
  }
  return data
}

export const api = {
  getMe: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  getContacts: () => request("/api/contacts"),
  createContact: (body) => request("/api/contacts", { method: "POST", body: JSON.stringify(body) }),
  updateContact: (id, body) => request(`/api/contacts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteContact: (id) => request(`/api/contacts/${id}`, { method: "DELETE" }),
  getReminders: () => request("/api/reminders"),
  createReminder: (body) => request("/api/reminders", { method: "POST", body: JSON.stringify(body) }),
  patchReminder: (id, body) => request(`/api/reminders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteReminder: (id) => request(`/api/reminders/${id}`, { method: "DELETE" }),
  getProfile: () => request("/api/profile"),
  patchProfile: (body) => request("/api/profile", { method: "PATCH", body: JSON.stringify(body) }),
  getOutreachLogs: (contactId) => {
    const q = contactId != null && contactId !== "" ? `?contactId=${encodeURIComponent(contactId)}` : ""
    return request(`/api/outreach-logs${q}`)
  },
  createOutreachLog: (body) =>
    request("/api/outreach-logs", { method: "POST", body: JSON.stringify(body) }),
  deleteOutreachLog: (id) => request(`/api/outreach-logs/${id}`, { method: "DELETE" }),
  compose: (body) => request("/compose", { method: "POST", body: JSON.stringify(body) }),
  getResumeUpdates: () => request("/api/resume-updates"),
  createResumeUpdate: (body) =>
    request("/api/resume-updates", { method: "POST", body: JSON.stringify(body) }),
  deleteResumeUpdate: (id) => request(`/api/resume-updates/${id}`, { method: "DELETE" }),
  getFullResume: () => request("/api/resume"),
  saveFullResume: (body) => request("/api/resume", { method: "POST", body: JSON.stringify(body) }),
  uploadFullResume: (file, bucketId) => {
    const form = new FormData()
    form.append("file", file)
    if (bucketId != null) form.append("bucketId", String(bucketId))
    return uploadRequest("/api/resume/upload", form)
  },
  deleteFullResume: (bucketId) => {
    const q = bucketId != null ? `?bucketId=${encodeURIComponent(bucketId)}` : ""
    return request(`/api/resume${q}`, { method: "DELETE" })
  },
  getResumeBucketSuggestions: () => request("/api/resume-buckets/suggestions"),
  getResumeBuckets: () => request("/api/resume-buckets"),
  createResumeBucket: (body) =>
    request("/api/resume-buckets", { method: "POST", body: JSON.stringify(body) }),
  patchResumeBucket: (id, body) =>
    request(`/api/resume-buckets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteResumeBucket: (id) => request(`/api/resume-buckets/${id}`, { method: "DELETE" }),
  uploadBucketResume: (bucketId, file) => {
    const form = new FormData()
    form.append("file", file)
    return uploadRequest(`/api/resume-buckets/${bucketId}/upload`, form)
  },
  deleteBucketResume: (bucketId) =>
    request(`/api/resume-buckets/${bucketId}/resume`, { method: "DELETE" }),
  restoreResumeVersion: (bucketId, versionId) =>
    request(`/api/resume-buckets/${bucketId}/versions/${versionId}/restore`, { method: "POST" }),
  deleteResumeVersion: (bucketId, versionId) =>
    request(`/api/resume-buckets/${bucketId}/versions/${versionId}`, { method: "DELETE" }),
  getResumeSuggestions: (bucketId) =>
    request("/api/resume/suggestions", {
      method: "POST",
      body: JSON.stringify(bucketId != null ? { bucketId } : {}),
    }),
  getGoogleCalendarStatus: () => request("/api/google/status"),
  disconnectGoogleCalendar: () => request("/api/google/disconnect", { method: "DELETE" }),
  saveGmailDraft: (body) => request("/api/gmail/draft", { method: "POST", body: JSON.stringify(body) }),
  scheduleGmailSend: (body) => request("/api/gmail/schedule", { method: "POST", body: JSON.stringify(body) }),
  syncReminderToCalendar: (id) =>
    request(`/api/reminders/${id}/sync-calendar`, { method: "POST", body: JSON.stringify({}) }),
}

export { BASE }
