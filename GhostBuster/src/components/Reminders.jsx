import React, { useState, useEffect } from "react"
import { api, BASE } from "../api"
import { font } from "../theme"
import {
  getReminderUrgency,
  getReminderUrgencyStyle,
  parseDueDay,
  reminderDueLabel,
  sortRemindersForDisplay,
  summarizePendingReminders,
} from "../reminderUtils"

const EMPTY = { contactName: "", reason: "", dueDate: "", done: false, syncToCalendar: true }

export default function Reminders({ googleNotice = null, onConsumeGoogleNotice = () => {} }) {
  const [reminders, setReminders] = useState([])
  const [contacts, setContacts] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [listLoading, setListLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState("pending")
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [googleStatus, setGoogleStatus] = useState({ connected: false, configured: false })
  const [googleLoading, setGoogleLoading] = useState(true)

  useEffect(() => {
    if (!googleNotice) return
    setNotice(googleNotice)
    onConsumeGoogleNotice()
  }, [googleNotice, onConsumeGoogleNotice])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const [{ contacts: c }, { reminders: r }, gStatus] = await Promise.all([
          api.getContacts(),
          api.getReminders(),
          api.getGoogleCalendarStatus(),
        ])
        if (!cancelled) {
          setContacts(c)
          setReminders(r)
          setGoogleStatus(gStatus)
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.message)
          setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
          setReminders(JSON.parse(localStorage.getItem("gb_reminders") || "[]"))
        }
      } finally {
        if (!cancelled) {
          setListLoading(false)
          setGoogleLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function save() {
    if (!form.contactName.trim()) return
    setActionError(null)
    const payload = {
      contactName: form.contactName.trim(),
      reason: form.reason === "Custom..." ? (form.customReason || "Custom...") : form.reason,
      dueDate: form.dueDate,
      done: false,
      customReason: form.reason === "Custom..." ? (form.customReason || "") : "",
      syncToCalendar: form.syncToCalendar !== false,
    }
    try {
      await api.createReminder(payload)
      const { reminders: list } = await api.getReminders()
      setReminders(list)
      localStorage.setItem("gb_reminders", JSON.stringify(list))
      setForm(EMPTY)
      setShowForm(false)
    } catch (e) {
      if (loadError) {
        const next = [...reminders, { id: Date.now(), ...payload, done: false }]
        setReminders(next)
        localStorage.setItem("gb_reminders", JSON.stringify(next))
        setForm(EMPTY)
        setShowForm(false)
      } else {
        setActionError(e.message)
      }
    }
  }

  async function toggle(id) {
    const r = reminders.find(x => x.id === id)
    if (!r) return
    setActionError(null)
    try {
      await api.patchReminder(id, { done: !r.done })
      const { reminders: list } = await api.getReminders()
      setReminders(list)
      localStorage.setItem("gb_reminders", JSON.stringify(list))
    } catch (e) {
      if (loadError) {
        const next = reminders.map(x => x.id === id ? { ...x, done: !x.done } : x)
        setReminders(next)
        localStorage.setItem("gb_reminders", JSON.stringify(next))
      } else {
        setActionError(e.message)
      }
    }
  }

  function connectGoogleCalendar() {
    window.location.href = `${BASE}/api/google/auth`
  }

  async function disconnectGoogleCalendar() {
    setActionError(null)
    try {
      await api.disconnectGoogleCalendar()
      setGoogleStatus({ connected: false, configured: googleStatus.configured })
      setNotice({ type: "success", text: "Google Calendar disconnected." })
    } catch (e) {
      setActionError(e.message)
    }
  }

  async function syncOne(id) {
    setActionError(null)
    try {
      const { reminder } = await api.syncReminderToCalendar(id)
      setReminders((prev) => {
        const next = prev.map((r) => (r.id === id ? reminder : r))
        localStorage.setItem("gb_reminders", JSON.stringify(next))
        return next
      })
      setNotice({ type: "success", text: "Added to Google Calendar." })
    } catch (e) {
      setActionError(e.message)
    }
  }

  async function remove(id) {
    setActionError(null)
    try {
      await api.deleteReminder(id)
      const { reminders: list } = await api.getReminders()
      setReminders(list)
      localStorage.setItem("gb_reminders", JSON.stringify(list))
    } catch (e) {
      if (loadError) {
        const next = reminders.filter(r => r.id !== id)
        setReminders(next)
        localStorage.setItem("gb_reminders", JSON.stringify(next))
      } else {
        setActionError(e.message)
      }
    }
  }

  const filtered = sortRemindersForDisplay(
    reminders.filter((r) => {
      if (filter === "pending") return !r.done
      if (filter === "done") return r.done
      return true
    })
  )

  const pendingCount = reminders.filter((r) => !r.done).length
  const summary = summarizePendingReminders(reminders)

  const inputStyle = {
    background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "10px 14px", color: "#f0f0f5",
    fontSize: 14, fontFamily: font.body, width: "100%", outline: "none",
  }

  const REASONS = [
    "Keep warm — check in",
    "Resume update",
    "New accomplishment to share",
    "Follow up after meeting",
    "After interview",
    "Job application update",
    "Custom...",
  ]

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: font.mono, letterSpacing: "0.14em", color: "rgba(240,240,245,0.3)", textTransform: "uppercase", marginBottom: 8 }}>Stay Warm</div>
          <h1 style={{ fontFamily: font.display, fontWeight: 800, fontSize: 36, letterSpacing: "-1px", marginBottom: 8 }}>Reminders</h1>
          <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, fontFamily: font.body, maxWidth: 560, lineHeight: 1.55 }}>
            {listLoading ? "Loading…" : (
              <>
                <span style={{ fontFamily: font.mono, fontVariantNumeric: "tabular-nums" }}>{pendingCount}</span>
                {` pending reminder${pendingCount !== 1 ? "s" : ""}`}
                {summary.overdue + summary.critical > 0 && (
                  <span style={{ color: "#ff6b6b" }}>
                    {" "}
                    · {summary.critical + summary.overdue} overdue
                  </span>
                )}
                <span style={{ display: "block", marginTop: 6, fontSize: 13, color: "rgba(240,240,245,0.35)" }}>
                  Reminders stay pending until you check them off — passing the due date only highlights them.
                </span>
                {loadError && (
                  <span style={{ display: "block", marginTop: 8, color: "#ffc96b", fontSize: 13 }}>
                    API unavailable — using local data. Start the server and refresh to sync.
                  </span>
                )}
              </>
            )}
          </p>
          {actionError && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{actionError}</p>}
          {notice && (
            <p
              style={{
                color: notice.type === "error" ? "#ff6b6b" : "#b8ff57",
                fontSize: 13,
                marginTop: 8,
              }}
            >
              {notice.text}
            </p>
          )}
        </div>
        <button onClick={() => setShowForm(true)} style={{
          background: "#b8ff57", color: "#0a0f09", border: "1px solid rgba(10,15,9,0.22)", boxShadow: "none",
          padding: "11px 22px", borderRadius: 10, fontFamily: font.display,
          fontWeight: 700, fontSize: 14, cursor: "pointer",
        }}>+ Add Reminder</button>
      </div>

      {!googleLoading && googleStatus.configured && (
        <div
          style={{
            background: googleStatus.connected ? "rgba(184,255,87,0.06)" : "#111118",
            border: `1px solid ${googleStatus.connected ? "rgba(184,255,87,0.2)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15 }}>
              Google Calendar {googleStatus.connected ? "connected" : "not connected"}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(240,240,245,0.45)", lineHeight: 1.45 }}>
              {googleStatus.connected
                ? "New reminders with a due date are added to your calendar automatically."
                : "Connect to sync reminders as calendar events."}
            </p>
          </div>
          {googleStatus.connected ? (
            <button
              type="button"
              onClick={disconnectGoogleCalendar}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(240,240,245,0.65)",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={connectGoogleCalendar}
              style={{
                background: "rgba(184,255,87,0.12)",
                border: "1px solid rgba(184,255,87,0.35)",
                color: "#b8ff57",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              Connect Google Calendar
            </button>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["pending", "done", "all"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 18px", borderRadius: 8, border: "1px solid",
            borderColor: filter === f ? "rgba(184,255,87,0.3)" : "rgba(255,255,255,0.08)",
            background: filter === f ? "rgba(184,255,87,0.08)" : "transparent",
            color: filter === f ? "#b8ff57" : "rgba(240,240,245,0.4)",
            fontSize: 13, fontFamily: font.mono, cursor: "pointer",
            textTransform: "capitalize",
            boxShadow: "none",
          }}>{f}</button>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{
          background: "#111118", border: "1px solid rgba(184,255,87,0.2)",
          borderRadius: 16, padding: 28, marginBottom: 28,
        }}>
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, marginBottom: 20 }}>New Reminder</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Contact picker */}
            <select value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} style={inputStyle}>
              <option value="">Select contact *</option>
              {contacts.map(c => <option key={c.id} value={c.name}>{c.name} {c.company ? `(${c.company})` : ""}</option>)}
              <option value="__custom__">Someone else...</option>
            </select>

            {/* If no contacts or custom */}
            {(form.contactName === "__custom__" || contacts.length === 0) && (
              <input placeholder="Contact name *" value={form.contactName === "__custom__" ? "" : form.contactName}
                onChange={e => setForm({ ...form, contactName: e.target.value })}
                style={inputStyle}
              />
            )}

            {/* Reason */}
            <select value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={inputStyle}>
              <option value="">Reason for outreach</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {/* Due date */}
            <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={inputStyle} />
          </div>

          {form.reason === "Custom..." && (
            <input placeholder="Describe your reason..." value={form.customReason || ""}
              onChange={e => setForm({ ...form, customReason: e.target.value })}
              style={{ ...inputStyle, marginTop: 14 }}
            />
          )}

          {googleStatus.connected && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 14,
                fontSize: 13,
                color: "rgba(240,240,245,0.65)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.syncToCalendar !== false}
                onChange={(e) => setForm({ ...form, syncToCalendar: e.target.checked })}
              />
              Add to Google Calendar when a due date is set
            </label>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={save} style={{
              background: "#b8ff57", color: "#0a0f09", border: "1px solid rgba(10,15,9,0.22)", boxShadow: "none",
              padding: "10px 24px", borderRadius: 9, fontFamily: font.display,
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>Save</button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }} style={{
              background: "transparent", color: "rgba(240,240,245,0.45)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "none",
              padding: "10px 24px", borderRadius: 9, fontFamily: font.body,
              fontSize: 14, cursor: "pointer",
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Reminder List */}
      {filtered.length === 0 ? (
        <div style={{
          background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: 48, textAlign: "center",
          color: "rgba(240,240,245,0.3)", fontSize: 14, fontFamily: font.body
        }}>
          {filter === "pending" ? "No pending reminders — you're on top of it! 🎉" : "Nothing here yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((r) => {
            const urgency = getReminderUrgency(r)
            const style = getReminderUrgencyStyle(urgency)
            const cardBorder = r.done
              ? "1px solid rgba(255,255,255,0.04)"
              : `2px solid ${style.border}`

            return (
            <div key={r.id} style={{
              background: r.done ? "#111118" : style.cardBg,
              border: cardBorder,
              boxShadow: r.done ? "none" : style.shadow,
              borderRadius: 14, padding: "18px 22px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              opacity: r.done ? 0.55 : 1, transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-label={r.done ? `Mark reminder for ${r.contactName} as pending` : `Mark reminder for ${r.contactName} as done`}
                  title={r.done ? "Mark as not done" : "Mark as done"}
                  style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  border: `2px solid ${r.done ? "#b8ff57" : style.border}`,
                  background: r.done ? "#b8ff57" : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: "#0a0f09",
                  boxShadow: "none",
                }}>
                  {r.done ? "✓" : ""}
                </button>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, textDecoration: r.done ? "line-through" : "none" }}>
                      {r.contactName}
                    </div>
                    {!r.done && (
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: font.mono,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: style.color,
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          padding: "2px 7px",
                          borderRadius: 5,
                        }}
                      >
                        {style.label}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(240,240,245,0.45)", marginTop: 2, fontFamily: font.body }}>
                    {r.reason || "General check-in"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {r.dueDate && (
                  <div style={{
                    fontSize: 11, fontFamily: font.mono,
                    color: r.done ? "rgba(240,240,245,0.3)" : style.color,
                    background: r.done ? "transparent" : style.bg,
                    padding: r.done ? "0" : "4px 10px",
                    borderRadius: 6,
                    border: r.done ? "none" : `1px solid ${style.border}`,
                  }}>
                    {r.done ? parseDueDay(r.dueDate)?.toLocaleDateString() ?? r.dueDate : reminderDueLabel(r)}
                  </div>
                )}
                {r.googleEventId && (
                  <span
                    title="Synced to Google Calendar"
                    style={{
                      fontSize: 10,
                      fontFamily: font.mono,
                      color: "#b8ff57",
                      background: "rgba(184,255,87,0.1)",
                      padding: "3px 8px",
                      borderRadius: 6,
                    }}
                  >
                    Calendar
                  </span>
                )}
                {googleStatus.connected && r.dueDate && !r.googleEventId && !r.done && (
                  <button
                    type="button"
                    onClick={() => syncOne(r.id)}
                    style={{
                      background: "rgba(91,228,216,0.1)",
                      border: "1px solid rgba(91,228,216,0.3)",
                      boxShadow: "none",
                      color: "#5be4d8",
                      padding: "6px 12px",
                      borderRadius: 7,
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: font.mono,
                    }}
                  >
                    Add to Calendar
                  </button>
                )}
                <button onClick={() => remove(r.id)} style={{
                  background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)", boxShadow: "none",
                  color: "#ff6b6b", padding: "6px 14px", borderRadius: 7,
                  fontSize: 12, cursor: "pointer", fontFamily: font.mono,
                }}>Delete</button>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
