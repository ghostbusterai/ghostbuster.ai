import React, { useState, useEffect, useRef, useMemo } from "react"
import { api } from "../api"
import {
  getReminderUrgency,
  getReminderUrgencyStyle,
  reminderDueLabel,
  reminderContactInitial,
  summarizePendingReminders,
} from "../reminderUtils"
import { isAutoReminder } from "../autoReminders"
import { font } from "../theme"
import { secondaryBtn } from "../uiStyles"
import { readLocalProfile } from "../profile"
import { buildSortedReminderFeed } from "../autoReminders"

const PREVIEW_LIMIT = 5

export default function NotificationBell({ setPage, currentPage }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const rootRef = useRef(null)

  async function loadReminders() {
    try {
      const [rRes, cRes, logRes, profileRes] = await Promise.all([
        api.getReminders(),
        api.getContacts(),
        api.getOutreachLogs(),
        api.getProfile(),
      ])
      const list = rRes.reminders || []
      const feed = buildSortedReminderFeed({
        savedReminders: list,
        contacts: cRes.contacts || [],
        outreachLogs: logRes.logs || [],
        lastResumeUpdate: profileRes?.profile?.lastResumeUpdate || "",
      })
      const summary = summarizePendingReminders(feed)
      setCount(summary.pending)
      setReminders(feed)
      localStorage.setItem("gb_reminders", JSON.stringify(list))
    } catch {
      try {
        const list = JSON.parse(localStorage.getItem("gb_reminders") || "[]")
        const contacts = JSON.parse(localStorage.getItem("gb_contacts") || "[]")
        const logs = JSON.parse(localStorage.getItem("gb_outreach_logs") || "[]")
        const feed = buildSortedReminderFeed({
          savedReminders: list,
          contacts,
          outreachLogs: logs,
          lastResumeUpdate: readLocalProfile().lastResumeUpdate || "",
        })
        const summary = summarizePendingReminders(feed)
        setCount(summary.pending)
        setReminders(feed)
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

  const pending = useMemo(() => reminders.filter((r) => !r.done).slice(0, PREVIEW_LIMIT), [reminders])

  const summary = useMemo(() => summarizePendingReminders(reminders), [reminders])

  function goToNotifications() {
    setOpen(false)
    setPage("notifications")
  }

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        className="gb-icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `${count} pending notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
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
        {count > 0 && <span className="gb-badge">{count > 99 ? "99+" : count}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="gb-floating-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: "min(360px, calc(100vw - 24px))",
            maxHeight: "min(85vh, 560px)",
            overflowY: "auto",
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
                  ? "You're all caught up. No pending reminders."
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
              <div className="gb-notif-reminder-list">
                {pending.map((r) => {
                  const urgency = getReminderUrgency(r)
                  const style = getReminderUrgencyStyle(urgency)
                  const auto = isAutoReminder(r)
                  const reason = r.customReason || r.reason || "General check-in"
                  const cardStyle = !auto
                    ? { background: style.cardBg, borderColor: style.border, boxShadow: style.shadow }
                    : undefined
                  return (
                    <div
                      key={r.id}
                      className={[
                        "gb-reminder-row",
                        "gb-reminder-row--compact",
                        auto ? "gb-reminder-row--suggested" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={cardStyle}
                    >
                      <div className="gb-reminder-row__body">
                        <span className="gb-reminder-avatar" aria-hidden="true">
                          {reminderContactInitial(r.contactName)}
                        </span>
                        <div className="gb-reminder-row__main">
                          <div className="gb-reminder-row__title-line">
                            <span className="gb-reminder-row__name">{r.contactName}</span>
                            {auto && <span className="gb-reminder-chip gb-reminder-chip--suggested">Suggested</span>}
                            <span
                              className="gb-reminder-chip"
                              style={{ color: style.color, borderColor: style.border, background: style.bg }}
                            >
                              {style.label}
                            </span>
                          </div>
                          <p className="gb-reminder-row__reason">{reason}</p>
                          <p
                            className="gb-reminder-row__due"
                            style={{ color: style.color, borderColor: style.border, background: style.bg }}
                          >
                            {reminderDueLabel(r)}
                          </p>
                        </div>
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

            <button type="button" onClick={goToNotifications} {...secondaryBtn({ fullWidth: true })}>
              Manage notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
