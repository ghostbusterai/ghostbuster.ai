import React, { useState, useEffect } from "react"
import { api } from "../api"
import { font } from "../theme"

const EMPTY = { contactName: "", reason: "", dueDate: "", done: false }

export default function Reminders() {
  const [reminders, setReminders] = useState([])
  const [contacts, setContacts] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [listLoading, setListLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState("pending")
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const [{ contacts: c }, { reminders: r }] = await Promise.all([
          api.getContacts(),
          api.getReminders(),
        ])
        if (!cancelled) {
          setContacts(c)
          setReminders(r)
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.message)
          setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
          setReminders(JSON.parse(localStorage.getItem("gb_reminders") || "[]"))
        }
      } finally {
        if (!cancelled) setListLoading(false)
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

  const filtered = reminders.filter(r => {
    if (filter === "pending") return !r.done
    if (filter === "done") return r.done
    return true
  })

  const isOverdue = (r) => {
    if (!r.dueDate || r.done) return false
    return new Date(r.dueDate) < new Date()
  }

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
          <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, fontFamily: font.body }}>
            {listLoading ? "Loading…" : (
              <>
                <span style={{ fontFamily: font.mono, fontVariantNumeric: "tabular-nums" }}>{reminders.filter(r => !r.done).length}</span>
                {` pending reminder${reminders.filter(r => !r.done).length !== 1 ? "s" : ""}`}
                {loadError && (
                  <span style={{ display: "block", marginTop: 8, color: "#ffc96b", fontSize: 13 }}>
                    API unavailable — using local data. Start the server and refresh to sync.
                  </span>
                )}
              </>
            )}
          </p>
          {actionError && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{actionError}</p>}
        </div>
        <button onClick={() => setShowForm(true)} style={{
          background: "#b8ff57", color: "#0a0f09", border: "1px solid rgba(10,15,9,0.22)", boxShadow: "none",
          padding: "11px 22px", borderRadius: 10, fontFamily: font.display,
          fontWeight: 700, fontSize: 14, cursor: "pointer",
        }}>+ Add Reminder</button>
      </div>

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
          {filtered.map(r => (
            <div key={r.id} style={{
              background: "#111118",
              border: `1px solid ${r.done ? "rgba(255,255,255,0.04)" : isOverdue(r) ? "rgba(255,107,107,0.25)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 14, padding: "18px 22px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              opacity: r.done ? 0.5 : 1, transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Checkbox */}
                <button onClick={() => toggle(r.id)} style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  border: `2px solid ${r.done ? "#b8ff57" : "rgba(255,255,255,0.2)"}`,
                  background: r.done ? "#b8ff57" : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: "#0a0f09",
                  boxShadow: "none",
                }}>
                  {r.done ? "✓" : ""}
                </button>

                <div>
                  <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, textDecoration: r.done ? "line-through" : "none" }}>
                    {r.contactName}
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
                    color: isOverdue(r) ? "#ff6b6b" : "rgba(240,240,245,0.3)",
                    background: isOverdue(r) ? "rgba(255,107,107,0.08)" : "transparent",
                    padding: isOverdue(r) ? "3px 8px" : "0", borderRadius: 6,
                  }}>
                    {isOverdue(r) ? "⚠ Overdue · " : ""}{new Date(r.dueDate).toLocaleDateString()}
                  </div>
                )}
                <button onClick={() => remove(r.id)} style={{
                  background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)", boxShadow: "none",
                  color: "#ff6b6b", padding: "6px 14px", borderRadius: 7,
                  fontSize: 12, cursor: "pointer", fontFamily: font.mono,
                }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
