import React, { useState, useEffect, useMemo } from "react"
import { api } from "../api"
import { font } from "../theme"
import {
  getReminderUrgency,
  getReminderUrgencyStyle,
  reminderDueLabel,
  sortRemindersForDisplay,
  summarizePendingReminders,
} from "../reminderUtils"

export default function Notifications({ setPage }) {
  const [reminders, setReminders] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState(null)

  async function loadReminders() {
    setLoadError(null)
    try {
      const { reminders: list } = await api.getReminders()
      setReminders(list || [])
      localStorage.setItem("gb_reminders", JSON.stringify(list || []))
    } catch (e) {
      setLoadError(e.message)
      setReminders(JSON.parse(localStorage.getItem("gb_reminders") || "[]"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReminders()
  }, [])

  const pending = useMemo(
    () => sortRemindersForDisplay(reminders.filter((r) => !r.done)),
    [reminders]
  )
  const summary = useMemo(() => summarizePendingReminders(reminders), [reminders])

  async function markDone(id) {
    setActionError(null)
    try {
      await api.patchReminder(id, { done: true })
      const { reminders: list } = await api.getReminders()
      setReminders(list)
      localStorage.setItem("gb_reminders", JSON.stringify(list))
    } catch (e) {
      if (loadError) {
        const next = reminders.map((r) => (r.id === id ? { ...r, done: true } : r))
        setReminders(next)
        localStorage.setItem("gb_reminders", JSON.stringify(next))
      } else {
        setActionError(e.message)
      }
    }
  }

  const summaryPills = [
    { key: "critical", label: "Critical", count: summary.critical, show: summary.critical > 0 },
    { key: "overdue", label: "Overdue", count: summary.overdue, show: summary.overdue > 0 },
    { key: "today", label: "Due today", count: summary.today, show: summary.today > 0 },
    { key: "soon", label: "Due soon", count: summary.soon, show: summary.soon > 0 },
    { key: "upcoming", label: "Upcoming", count: summary.upcoming, show: summary.upcoming > 0 },
  ].filter((p) => p.show)

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: font.mono,
            letterSpacing: "0.14em",
            color: "rgba(240,240,245,0.3)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Inbox
        </div>
        <h1
          style={{
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 36,
            letterSpacing: "-1px",
            marginBottom: 8,
          }}
        >
          Notifications
        </h1>
        <p
          style={{
            color: "rgba(240,240,245,0.45)",
            fontSize: 15,
            fontFamily: font.body,
            maxWidth: 560,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {loading
            ? "Loading…"
            : summary.pending === 0
              ? "You're all caught up — no pending reminders."
              : `${summary.pending} pending reminder${summary.pending !== 1 ? "s" : ""} need your attention.`}
        </p>
        {loadError && (
          <p style={{ color: "#ffc96b", fontSize: 13, marginTop: 10 }}>
            API offline — showing local copy.
          </p>
        )}
        {actionError && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{actionError}</p>}
      </div>

      {summaryPills.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {summaryPills.map((pill) => {
            const style = getReminderUrgencyStyle(pill.key)
            return (
              <span
                key={pill.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontFamily: font.mono,
                  color: style.color,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: style.color,
                  }}
                />
                {pill.count} {pill.label.toLowerCase()}
              </span>
            )
          })}
        </div>
      )}

      {loading ? (
        <div style={{ color: "rgba(240,240,245,0.35)" }}>Loading notifications…</div>
      ) : pending.length === 0 ? (
        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: 48,
            textAlign: "center",
            color: "rgba(240,240,245,0.35)",
            fontSize: 14,
          }}
        >
          No pending reminders. Set one from Reminders when you want a follow-up nudge.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pending.map((r) => {
            const urgency = getReminderUrgency(r)
            const style = getReminderUrgencyStyle(urgency)
            const reason = r.customReason || r.reason || "General check-in"
            return (
              <div
                key={r.id}
                style={{
                  background: style.cardBg,
                  border: `2px solid ${style.border}`,
                  boxShadow: style.shadow,
                  borderRadius: 14,
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: font.mono,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: style.color,
                        background: style.bg,
                        border: `1px solid ${style.border}`,
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {style.label}
                    </span>
                    <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16 }}>{r.contactName}</span>
                  </div>
                  <div style={{ fontSize: 14, color: "rgba(240,240,245,0.55)", lineHeight: 1.5 }}>{reason}</div>
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: font.mono,
                      color: style.color,
                      marginTop: 8,
                    }}
                  >
                    {reminderDueLabel(r)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => markDone(r.id)}
                    style={{
                      background: "rgba(184,255,87,0.12)",
                      border: "1px solid rgba(184,255,87,0.35)",
                      color: "#b8ff57",
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      boxShadow: "none",
                      fontFamily: font.body,
                    }}
                  >
                    Mark done
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage("reminders")}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(240,240,245,0.6)",
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      boxShadow: "none",
                      fontFamily: font.body,
                    }}
                  >
                    Open Reminders
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <button
          type="button"
          onClick={() => setPage("reminders")}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(240,240,245,0.55)",
            padding: "10px 18px",
            borderRadius: 9,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: "none",
            fontFamily: font.body,
          }}
        >
          Manage all reminders →
        </button>
      </div>
    </div>
  )
}
