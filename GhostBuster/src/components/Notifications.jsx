import React, { useState, useEffect, useMemo } from "react"
import { api } from "../api"
import { font } from "../theme"
import { readLocalProfile } from "../profile"
import { buildSortedReminderFeed, dismissAutoSuggestion, isAutoReminder } from "../autoReminders"
import { PageShell, PageHero, ContentCard, CardTitle, EmptyState } from "../layout"
import { primaryBtn, secondaryBtn } from "../uiStyles"
import {
  getReminderUrgency,
  getReminderUrgencyStyle,
  reminderDueLabel,
  reminderContactInitial,
  summarizePendingReminders,
} from "../reminderUtils"

export default function Notifications({ setPage }) {
  const [reminders, setReminders] = useState([])
  const [contacts, setContacts] = useState([])
  const [outreachLogs, setOutreachLogs] = useState([])
  const [lastResumeUpdate, setLastResumeUpdate] = useState("")
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState(null)
  const [dismissalRevision, setDismissalRevision] = useState(0)

  async function loadFeed() {
    setLoadError(null)
    try {
      const [rRes, cRes, logRes, profileRes] = await Promise.all([
        api.getReminders(),
        api.getContacts(),
        api.getOutreachLogs(),
        api.getProfile(),
      ])
      setReminders(rRes.reminders || [])
      setContacts(cRes.contacts || [])
      setOutreachLogs(logRes.logs || [])
      setLastResumeUpdate(profileRes?.profile?.lastResumeUpdate || "")
      localStorage.setItem("gb_reminders", JSON.stringify(rRes.reminders || []))
    } catch (e) {
      setLoadError(e.message)
      setReminders(JSON.parse(localStorage.getItem("gb_reminders") || "[]"))
      setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
      setOutreachLogs(JSON.parse(localStorage.getItem("gb_outreach_logs") || "[]"))
      setLastResumeUpdate(readLocalProfile().lastResumeUpdate || "")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFeed()
  }, [])

  const feed = useMemo(
    () =>
      buildSortedReminderFeed({
        savedReminders: reminders,
        contacts,
        outreachLogs,
        lastResumeUpdate,
      }),
    [reminders, contacts, outreachLogs, lastResumeUpdate, dismissalRevision]
  )

  const pending = useMemo(() => feed.filter((r) => !r.done), [feed])
  const summary = useMemo(() => summarizePendingReminders(feed), [feed])

  async function markDone(id) {
    const row = feed.find((r) => r.id === id)
    if (!row) return
  if (isAutoReminder(row)) {
    dismissAutoSuggestion(row.suggestionKey)
    setDismissalRevision((n) => n + 1)
    return
  }
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
              : `${summary.pending} item${summary.pending !== 1 ? "s" : ""} in your feed need attention (saved + suggested).`
        }
      >
        {loadError && (
          <p style={{ color: "var(--gb-warning)", fontSize: 13, marginTop: 10, marginBottom: 0, fontFamily: font.body }}>
            API offline — showing local copy.
          </p>
        )}
        {actionError && <p style={{ color: "var(--gb-danger)", fontSize: 13, marginTop: 8, marginBottom: 0, fontFamily: font.body }}>{actionError}</p>}
      </PageHero>

      {summaryPills.length > 0 && (
        <>
          <ContentCard padding="14px 14px 12px" marginBottom={24}>
          <CardTitle style={{ marginBottom: 12 }}>Summary</CardTitle>
          <div className="gb-summary-chips gb-reveal-stagger">
          {summaryPills.map((pill) => {
            const style = getReminderUrgencyStyle(pill.key)
            return (
              <span
                key={pill.key}
                className="gb-summary-chip"
                style={{
                  color: style.color,
                  background: style.bg,
                  borderColor: style.border,
                }}
              >
                <span className="gb-summary-chip__dot" style={{ background: style.color }} />
                {pill.count} {pill.label.toLowerCase()}
              </span>
            )
          })}
        </div>
          </ContentCard>
        </>
      )}

      <ContentCard padding="8px 0 4px">
      <CardTitle helper="Includes auto-suggested follow-ups from Tracker warmth and your résumé date.">
        Pending feed
      </CardTitle>
      {loading ? (
        <div style={{ color: "var(--gb-text-faint)" }}>Loading notifications…</div>
      ) : pending.length === 0 ? (
        <EmptyState
          title="No pending nudges"
          lede="Add contacts and log outreach — we'll suggest follow-ups here. You can still add your own on Reminders."
        />
      ) : (
        <div className="gb-record-list gb-reminders-list">
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
                  "gb-record-row",
                  "gb-reminder-row",
                  "gb-reveal-block",
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
                <div className="gb-record-row__actions gb-reminder-row__actions">
                  <button type="button" onClick={() => markDone(r.id)} {...primaryBtn({ sm: true })}>
                    {auto ? "Dismiss" : "Mark done"}
                  </button>
                  <button type="button" onClick={() => setPage("reminders")} {...secondaryBtn({ sm: true })}>
                    Open Reminders
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </ContentCard>

      <div style={{ marginTop: 28 }} className="gb-reveal-block">
        <button type="button" onClick={() => setPage("reminders")} {...secondaryBtn()}>
          Manage all reminders →
        </button>
      </div>
    </PageShell>
  )
}
