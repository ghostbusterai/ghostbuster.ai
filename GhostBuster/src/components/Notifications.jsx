import React, { useState, useEffect, useMemo } from "react"
import { api } from "../api"
import { font } from "../theme"
import { PageShell, PageHero, SectionLabel, ContentCard } from "../layout"
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
    <PageShell>
      <PageHero
        eyebrow="Inbox"
        title="Notifications"
        subtitle={
          loading
            ? "Loading…"
            : summary.pending === 0
              ? "You're all caught up — no pending reminders."
              : `${summary.pending} pending reminder${summary.pending !== 1 ? "s" : ""} need your attention.`
        }
      >
        {loadError && (
          <p style={{ color: "var(--gb-warning)", fontSize: 13, marginTop: 10, marginBottom: 0 }}>
            API offline — showing local copy.
          </p>
        )}
        {actionError && <p style={{ color: "var(--gb-danger)", fontSize: 13, marginTop: 8, marginBottom: 0 }}>{actionError}</p>}
      </PageHero>

      {summaryPills.length > 0 && (
        <>
          <SectionLabel>Summary</SectionLabel>
          <ContentCard padding="14px 14px 12px" marginBottom={24}>
          <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
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
          </ContentCard>
        </>
      )}

      <SectionLabel>Pending reminders</SectionLabel>
      {loading ? (
        <div style={{ color: "var(--gb-text-faint)" }}>Loading notifications…</div>
      ) : pending.length === 0 ? (
        <div
          style={{
            background: "var(--gb-bg-elevated)",
            border: "1px solid var(--gb-surface-active)",
            borderRadius: 14,
            padding: 48,
            textAlign: "center",
            color: "var(--gb-text-faint)",
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
                  <div style={{ fontSize: 14, color: "var(--gb-text-subtle)", lineHeight: 1.5 }}>{reason}</div>
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
                      background: "var(--gb-accent-soft)",
                      border: "1px solid var(--gb-accent-border)",
                      color: "var(--gb-accent)",
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
                      border: "1px solid var(--gb-border-strong)",
                      color: "var(--gb-text-subtle)",
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
            border: "1px solid var(--gb-border-strong)",
            color: "var(--gb-text-subtle)",
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
    </PageShell>
  )
}
