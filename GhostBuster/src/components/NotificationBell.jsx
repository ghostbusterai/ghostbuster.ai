import React, { useState, useEffect } from "react"
import { api } from "../api"
import { summarizePendingReminders } from "../reminderUtils"
import { font } from "../theme"

export default function NotificationBell({ setPage, currentPage }) {
  const [count, setCount] = useState(0)
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { reminders } = await api.getReminders()
        if (cancelled) return
        const summary = summarizePendingReminders(reminders || [])
        setCount(summary.pending)
        setUrgent(summary.critical > 0 || summary.overdue > 0)
      } catch {
        if (cancelled) return
        try {
          const reminders = JSON.parse(localStorage.getItem("gb_reminders") || "[]")
          const summary = summarizePendingReminders(reminders)
          setCount(summary.pending)
          setUrgent(summary.critical > 0 || summary.overdue > 0)
        } catch {
          setCount(0)
          setUrgent(false)
        }
      }
    }
    load()
    const interval = setInterval(load, 60000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [currentPage])

  const active = currentPage === "notifications"

  return (
    <button
      type="button"
      onClick={() => setPage("notifications")}
      aria-label={count > 0 ? `${count} pending notifications` : "Notifications"}
      title="Notifications"
      style={{
        position: "relative",
        width: 40,
        height: 40,
        borderRadius: 10,
        border: active ? "1px solid var(--gb-accent-border)" : "1px solid var(--gb-border-strong)",
        background: active ? "var(--gb-accent-soft)" : "var(--gb-surface-hover)",
        color: active ? "var(--gb-accent)" : "var(--gb-text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "none",
        fontSize: 18,
        lineHeight: 1,
      }}
    >
      <span aria-hidden style={{ transform: "translateY(-1px)" }}>
        🔔
      </span>
      {count > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 999,
            background: urgent ? "var(--gb-danger)" : "var(--gb-warning)",
            color: urgent ? "#fff" : "var(--gb-accent-text-on)",
            fontSize: 10,
            fontFamily: font.mono,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid var(--gb-bg)",
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  )
}
