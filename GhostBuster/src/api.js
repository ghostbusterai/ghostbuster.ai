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
  return "http://localhost:3001"
}

const BASE = apiBase()

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) }
  let r
  try {
    r = await fetch(`${BASE}${path}`, {
      headers,
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
  const data = text ? JSON.parse(text) : {}
  if (!r.ok) throw new Error(data.error || r.statusText || `Request failed (${r.status})`)
  return data
}

export const api = {
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
}

export { BASE }
