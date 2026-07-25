import React, { useState, useEffect, useRef, useMemo } from "react"
import { api } from "../api"
import {
  getReminderUrgency,
  getReminderUrgencyStyle,
  reminderDueLabel,
  sortRemindersForDisplay,
  summarizePendingReminders,
} from "../reminderUtils"
import { font } from "../theme"

const panelShadow = "0 12px 16px -4px rgba(0,0,0,0.45), 0 4px 6px -2px rgba(0,0,0,0.25)"
const PREVIEW_LIMIT = 5

export default function NotificationBell({ setPage, currentPage }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const rootRef = useRef(null)

  async function loadReminders() {
    try {
      const { reminders: list } = await api.getReminders()
      const summary = summarizePendingReminders(list || [])
      setCount(summary.pending)
      setReminders(list || [])
      localStorage.setItem("gb_reminders", JSON.stringify(list || []))
    } catch {
      try {
        const list = JSON.parse(localStorage.getItem("gb_reminders") || "[]")
        const summary = summarizePendingReminders(list)
        setCount(summary.pending)
        setReminders(list)
      } catch {
        setCount(0)
        setReminders([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReminders()
    const interval = setInterval(loadReminders, 60000)
    return () => clearInterval(interval)
  }, [currentPage])

  useEffect(() => {
    if (!open) return
    loadReminders()
    function onKey(e) {
      if (e.key === "Escape") setOpen(false)
    }
    function onClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onClick)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onClick)
    }
  }, [open])

  const pending = useMemo(
    () => sortRemindersForDisplay(reminders.filter((r) => !r.done)).slice(0, PREVIEW_LIMIT),
    [reminders]
  )

  const summary = useMemo(() => summarizePendingReminders(reminders), [reminders])

  function goToNotifications() {
    setOpen(false)
    setPage("notifications")
  }

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `${count} pending notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "none",
          background: open || currentPage === "notifications" ? "var(--gb-surface-hover)" : "transparent",
          color: open || currentPage === "notifications" ? "var(--gb-text)" : "var(--gb-text-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "none",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "#3b82f6",
              color: "#fff",
              fontSize: 10,
              fontFamily: font.mono,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--gb-header-bg)",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: "min(360px, calc(100vw - 24px))",
            maxHeight: "min(85vh, 560px)",
            overflowY: "auto",
            background: "var(--gb-bg-elevated)",
            border: "1px solid var(--gb-border-subtle)",
            borderRadius: 12,
            boxShadow: panelShadow,
            zIndex: 100,
          }}
        >
          <div style={{ padding: "18px 18px 16px" }}>
            <div
              style={{
                fontFamily: font.h2,
                fontWeight: 800,
                fontSize: 17,
                letterSpacing: "-0.3px",
                marginBottom: 8,
              }}
            >
              Notifications
            </div>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 13,
                color: "var(--gb-text-muted)",
                lineHeight: 1.5,
                fontFamily: font.body,
              }}
            >
              {loading
                ? "Loading…"
                : summary.pending === 0
                  ? "You're all caught up — no pending reminders."
                  : `${summary.pending} pending reminder${summary.pending !== 1 ? "s" : ""} need your attention.`}
            </p>

            {loading ? null : pending.length === 0 ? (
              <div
                style={{
                  background: "var(--gb-bg-panel)",
                  border: "1px solid var(--gb-border-subtle)",
                  borderRadius: 10,
                  padding: "20px 16px",
                  textAlign: "center",
                  color: "var(--gb-text-faint)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  marginBottom: 16,
                }}
              >
                No pending reminders. Set one from Reminders when you want a follow-up nudge.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {pending.map((r) => {
                  const urgency = getReminderUrgency(r)
                  const style = getReminderUrgencyStyle(urgency)
                  const reason = r.customReason || r.reason || "General check-in"
                  return (
                    <div
                      key={r.id}
                      style={{
                        background: "var(--gb-bg-panel)",
                        border: `1px solid ${style.border}`,
                        borderRadius: 10,
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: font.mono,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: style.color,
                            background: style.bg,
                            border: `1px solid ${style.border}`,
                            padding: "2px 7px",
                            borderRadius: 6,
                          }}
                        >
                          {style.label}
                        </span>
                        <span style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 14 }}>{r.contactName}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--gb-text-subtle)", lineHeight: 1.45 }}>{reason}</div>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: font.mono,
                          color: style.color,
                          marginTop: 6,
                        }}
                      >
                        {reminderDueLabel(r)}
                      </div>
                    </div>
                  )
                })}
                {summary.pending > PREVIEW_LIMIT && (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--gb-text-faint)", textAlign: "center" }}>
                    +{summary.pending - PREVIEW_LIMIT} more in Manage notifications
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={goToNotifications}
              style={{
                width: "100%",
                background: "var(--gb-surface-active)",
                color: "var(--gb-text-strong)",
                border: "1px solid var(--gb-border)",
                padding: "10px 16px",
                borderRadius: 9,
                fontFamily: font.body,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              Manage notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
