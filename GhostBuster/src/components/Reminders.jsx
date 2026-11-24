import React, { useState, useEffect, useMemo } from "react"
import { api, BASE } from "../api"
import { inputStyle, primaryBtn, secondaryBtn } from "../uiStyles"
import {
  PageShell,
  PageHero,
  ContentCard,
  CardTitle,
  SegmentedFilter,
  EmptyState,
  FormActions,
  FormPrimaryButton,
  FormSecondaryButton,
} from "../layout"
import ViewMoreButton from "./ViewMoreButton"
import { previewHiddenCount, previewSlice } from "../listPreview"
import {
  getReminderUrgency,
  getReminderUrgencyStyle,
  formatDayIso,
  parseDueDay,
  reminderDueLabel,
  summarizePendingReminders,
} from "../reminderUtils"
import { readPreferences } from "../preferences"
import { readLocalProfile } from "../profile"
import {
  buildSortedReminderFeed,
  dismissAutoSuggestion,
  generateAutoReminders,
  isAutoReminder,
} from "../autoReminders"

export const GMAIL_FOLLOWUPS_EVENT = "gb-gmail-followups"

function defaultDueInDays(days = 7) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return formatDayIso(d)
}

function emptyReminderForm() {
  return {
    contactName: "",
    customContactName: "",
    reason: "Follow up after meeting",
    dueDate: defaultDueInDays(7),
    done: false,
    customReason: "",
    syncToCalendar: readPreferences().defaultSyncToCalendar,
  }
}

export default function Reminders({ googleNotice = null, onConsumeGoogleNotice = () => {} }) {
  const [reminders, setReminders] = useState([])
  const [contacts, setContacts] = useState([])
  const [outreachLogs, setOutreachLogs] = useState([])
  const [lastResumeUpdate, setLastResumeUpdate] = useState("")
  const [dismissalRevision, setDismissalRevision] = useState(0)
  const [loadError, setLoadError] = useState(null)
  const [listLoading, setListLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyReminderForm)
  const [filter, setFilter] = useState("pending")
  const [kindFilter, setKindFilter] = useState("all")
  const [showCalendarHelp, setShowCalendarHelp] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [googleStatus, setGoogleStatus] = useState({ connected: false, configured: false })
  const [googleLoading, setGoogleLoading] = useState(true)
  const [showAllReminders, setShowAllReminders] = useState(false)

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
        const [{ contacts: c }, { reminders: r }, gStatus, logRes, profileRes] = await Promise.all([
          api.getContacts(),
          api.getReminders(),
          api.getGoogleCalendarStatus(),
          api.getOutreachLogs(),
          api.getProfile(),
        ])
        if (!cancelled) {
          setContacts(c)
          setReminders(r)
          setGoogleStatus(gStatus)
          setOutreachLogs(logRes.logs || [])
          setLastResumeUpdate(profileRes?.profile?.lastResumeUpdate || "")
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.message)
          setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
          setReminders(JSON.parse(localStorage.getItem("gb_reminders") || "[]"))
          setOutreachLogs(JSON.parse(localStorage.getItem("gb_outreach_logs") || "[]"))
          setLastResumeUpdate(readLocalProfile().lastResumeUpdate || "")
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

  useEffect(() => {
    async function onFollowups() {
      try {
        const { reminders: list } = await api.getReminders()
        setReminders(list)
      } catch {
        /* shown on next load */
      }
    }
    window.addEventListener(GMAIL_FOLLOWUPS_EVENT, onFollowups)
    return () => window.removeEventListener(GMAIL_FOLLOWUPS_EVENT, onFollowups)
  }, [])

  async function save() {
    const resolvedName =
      form.contactName === "__custom__" ? form.customContactName.trim() : form.contactName.trim()
    if (!resolvedName) return
    setActionError(null)
    const payload = {
      contactName: resolvedName,
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
      setForm(emptyReminderForm())
      setShowForm(false)
    } catch (e) {
      if (loadError) {
        const next = [...reminders, { id: Date.now(), ...payload, done: false }]
        setReminders(next)
        localStorage.setItem("gb_reminders", JSON.stringify(next))
        setForm(emptyReminderForm())
        setShowForm(false)
      } else {
        setActionError(e.message)
      }
    }
  }

  const autoSuggestions = useMemo(
    () =>
      generateAutoReminders({
        contacts,
        outreachLogs,
        savedReminders: reminders,
        lastResumeUpdate,
      }),
    [contacts, outreachLogs, reminders, lastResumeUpdate, dismissalRevision]
  )

  const feed = useMemo(
    () => buildSortedReminderFeed({
      savedReminders: reminders,
      contacts,
      outreachLogs,
      lastResumeUpdate,
    }),
  [contacts, outreachLogs, reminders, lastResumeUpdate, dismissalRevision]
  )

  function dismissSuggestion(r) {
    if (r?.suggestionKey) dismissAutoSuggestion(r.suggestionKey)
    setDismissalRevision((n) => n + 1)
  }

  async function saveSuggestionAsReminder(r) {
    setActionError(null)
    const payload = {
      contactName: r.contactName.trim(),
      reason: r.reason === "Custom..." ? r.customReason || r.reason : r.reason,
      dueDate: r.dueDate,
      done: false,
      syncToCalendar: readPreferences().defaultSyncToCalendar,
    }
    try {
      await api.createReminder(payload)
      const { reminders: list } = await api.getReminders()
      setReminders(list)
      localStorage.setItem("gb_reminders", JSON.stringify(list))
      dismissSuggestion(r)
    } catch (e) {
      if (loadError) {
        const next = [...reminders, { id: Date.now(), ...payload, done: false }]
        setReminders(next)
        localStorage.setItem("gb_reminders", JSON.stringify(next))
        dismissSuggestion(r)
      } else {
        setActionError(e.message)
      }
    }
  }

  async function toggle(id) {
    const r = feed.find((x) => x.id === id)
    if (!r) return
    if (isAutoReminder(r)) {
      dismissSuggestion(r)
      return
    }
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
    const r = feed.find((x) => x.id === id)
    if (r && isAutoReminder(r)) {
      dismissSuggestion(r)
      return
    }
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

  const statusFiltered = feed.filter((r) => {
    if (filter === "pending") return !r.done
    if (filter === "done") return r.done && !isAutoReminder(r)
    return true
  })

  const filtered = statusFiltered.filter((r) => {
    if (filter !== "pending" || kindFilter === "all") return true
    if (kindFilter === "suggested") return isAutoReminder(r)
    if (kindFilter === "yours") return !isAutoReminder(r)
    return true
  })

  const visibleReminders = useMemo(
    () => previewSlice(filtered, showAllReminders),
    [filtered, showAllReminders]
  )
  const hiddenReminderCount = previewHiddenCount(filtered, showAllReminders)

  useEffect(() => {
    setShowAllReminders(false)
  }, [filter, kindFilter])

  const pendingCount = feed.filter((r) => !r.done).length
  const savedPendingCount = reminders.filter((r) => !r.done).length
  const suggestedCount = autoSuggestions.length
  const summary = summarizePendingReminders(feed)

  const REASONS = [
    "Keep warm — check in",
    "Resume update",
    "New accomplishment to share",
    "Follow up after meeting",
    "After interview",
    "Job application update",
    "Custom...",
  ]

  const summaryPills = [
    { key: "overdue", label: "Overdue", count: summary.overdue, show: summary.overdue > 0 },
    { key: "today", label: "Due today", count: summary.today, show: summary.today > 0 },
    { key: "suggested", label: "Suggested", count: suggestedCount, show: suggestedCount > 0 && filter === "pending" },
    { key: "yours", label: "Yours", count: savedPendingCount, show: savedPendingCount > 0 && filter === "pending" },
  ].filter((p) => p.show)

  function renderReminderRow(r) {
    const auto = isAutoReminder(r)
    const urgency = getReminderUrgency(r)
    const style = getReminderUrgencyStyle(urgency)
    return (
      <div
        key={r.id}
        className={[
          "gb-record-row",
          "gb-reminder-row",
          r.done ? "gb-record-row--done" : "",
          auto ? "gb-record-row--suggested gb-reminder-row--suggested" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={!r.done ? { borderLeft: `3px solid ${auto ? "var(--gb-accent)" : style.border}` } : undefined}
      >
        <div className="gb-reminder-row__main">
          <div className="gb-record-row__title-row">
            <h3 className={`gb-record-row__title${r.done ? " gb-reminder-row__title--done" : ""}`}>{r.contactName}</h3>
            {!r.done && auto && <span className="gb-pill gb-pill--accent">Suggested</span>}
            {!r.done && !auto && <span className="gb-pill" style={{ color: style.color, borderColor: style.border, background: style.bg }}>{style.label}</span>}
          </div>
          <p className="gb-record-row__meta">{r.reason || "General check-in"}</p>
          {r.dueDate && (
            <p className="gb-reminder-row__due" style={{ color: r.done ? "var(--gb-text-dim)" : style.color }}>
              {r.done ? parseDueDay(r.dueDate)?.toLocaleDateString() ?? r.dueDate : reminderDueLabel(r)}
              {r.googleEventId ? " · On calendar" : ""}
            </p>
          )}
        </div>
        <div className="gb-record-row__actions gb-reminder-row__actions">
          {auto && !r.done ? (
            <>
              <button type="button" onClick={() => saveSuggestionAsReminder(r)} {...primaryBtn({ sm: true })}>
                Add to my list
              </button>
              <button type="button" onClick={() => dismissSuggestion(r)} {...secondaryBtn({ sm: true })}>
                Not now
              </button>
            </>
          ) : (
            <>
              {!r.done && (
                <button type="button" onClick={() => toggle(r.id)} {...primaryBtn({ sm: true })}>
                  Done
                </button>
              )}
              {r.done && (
                <button type="button" onClick={() => toggle(r.id)} {...secondaryBtn({ sm: true })}>
                  Undo
                </button>
              )}
              {googleStatus.connected && r.dueDate && !r.googleEventId && !r.done && !auto && (
                <button type="button" onClick={() => syncOne(r.id)} {...secondaryBtn({ sm: true })}>
                  Calendar
                </button>
              )}
              <button type="button" onClick={() => remove(r.id)} {...secondaryBtn({ sm: true, style: { color: "var(--gb-danger)" } })}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const suggestedInView = visibleReminders.filter(isAutoReminder)
  const yoursInView = visibleReminders.filter((r) => !isAutoReminder(r))
  const showGrouped = filter === "pending" && kindFilter === "all" && suggestedInView.length > 0 && yoursInView.length > 0

  return (
    <PageShell>
      <PageHero
        eyebrow="Follow-ups"
        title="Reminders"
        subtitle={
          listLoading
            ? "Loading…"
            : pendingCount === 0
              ? "Nothing due — we'll suggest follow-ups when contacts go quiet."
              : `${pendingCount} to handle${summary.overdue > 0 ? ` · ${summary.overdue} overdue` : ""}`
        }
        action={
          <button type="button" onClick={() => setShowForm(true)} {...primaryBtn()}>
            + New reminder
          </button>
        }
      >
        {actionError && <p className="gb-reminder-banner gb-reminder-banner--error">{actionError}</p>}
        {notice && (
          <p className={`gb-reminder-banner${notice.type === "error" ? " gb-reminder-banner--error" : ""}`}>{notice.text}</p>
        )}
        {loadError && (
          <p className="gb-reminder-banner gb-reminder-banner--warn">Offline mode — showing saved data on this device.</p>
        )}
      </PageHero>

      {summaryPills.length > 0 && (
        <ContentCard padding="14px 16px" marginBottom={20} className="gb-reminders-summary-card">
          <div className="gb-summary-chips">
            {summaryPills.map((pill) => {
              const pillStyle = pill.key === "suggested" ? null : getReminderUrgencyStyle(pill.key)
              return (
                <span
                  key={pill.key}
                  className="gb-summary-chip"
                  style={
                    pill.key === "suggested"
                      ? {
                          color: "var(--gb-accent)",
                          background: "var(--gb-accent-soft)",
                          borderColor: "var(--gb-accent-border)",
                        }
                      : {
                          color: pillStyle.color,
                          background: pillStyle.bg,
                          borderColor: pillStyle.border,
                        }
                  }
                >
                  {pill.count} {pill.label.toLowerCase()}
                </span>
              )
            })}
          </div>
        </ContentCard>
      )}

      <ContentCard padding="16px 18px" marginBottom={20} className="gb-reminders-toolbar-card">
        <div className="gb-reminders-toolbar">
          <SegmentedFilter
            value={filter}
            onChange={(v) => {
              setFilter(v)
              if (v !== "pending") setKindFilter("all")
            }}
            options={[
              { id: "pending", label: "To do" },
              { id: "done", label: "Completed" },
              { id: "all", label: "All" },
            ]}
          />
          {filter === "pending" && (
            <SegmentedFilter
              className="gb-reminders-kind-filter"
              value={kindFilter}
              onChange={setKindFilter}
              options={[
                { id: "all", label: "Everything" },
                { id: "suggested", label: "Suggested" },
                { id: "yours", label: "Yours" },
              ]}
            />
          )}
        </div>
        {!googleLoading && googleStatus.configured && (
          <p className="gb-reminders-calendar-line">
            Google Calendar:{" "}
            {googleStatus.connected ? (
              <>
                <span className="gb-reminders-calendar-line__ok">Connected</span>
                <button type="button" className="gb-reminders-calendar-line__link" onClick={disconnectGoogleCalendar}>
                  Disconnect
                </button>
              </>
            ) : (
              <button type="button" className="gb-reminders-calendar-line__link" onClick={connectGoogleCalendar}>
                Connect for due-date sync
              </button>
            )}
            <button
              type="button"
              className="gb-reminders-calendar-line__link"
              onClick={() => setShowCalendarHelp((v) => !v)}
              aria-expanded={showCalendarHelp}
            >
              {showCalendarHelp ? "Hide" : "How it works"}
            </button>
          </p>
        )}
        {showCalendarHelp && (
          <p className="gb-reminders-calendar-help">
            Reminders with a due date can become calendar events when Google is connected. Turn the default on in Settings.
          </p>
        )}
      </ContentCard>

      {/* Add Form */}
      {showForm && (
        <ContentCard className="gb-reminder-form-card" padding="22px 24px" marginBottom={24}>
          <CardTitle helper="Pick someone, choose why you're reaching out, and set a due date. Defaults to one week out.">
            New reminder
          </CardTitle>
          <div className="gb-reminder-form">
            <label className="gb-reminder-form__field">
              <span className="gb-field-label">Who</span>
              {contacts.length > 0 ? (
                <select
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className={uiClass.input}
                  style={inputStyle()}
                >
                  <option value="">Choose a contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                      {c.company ? ` (${c.company})` : ""}
                    </option>
                  ))}
                  <option value="__custom__">Type a different name…</option>
                </select>
              ) : null}
              {(form.contactName === "__custom__" || contacts.length === 0) && (
                <input
                  placeholder="Contact name"
                  value={form.contactName === "__custom__" ? form.customContactName : form.contactName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contactName: contacts.length === 0 ? e.target.value : "__custom__",
                      customContactName: e.target.value,
                    })
                  }
                  className={uiClass.input}
                  style={inputStyle()}
                />
              )}
            </label>
            <label className="gb-reminder-form__field">
              <span className="gb-field-label">Why</span>
              <select
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className={uiClass.input}
                style={inputStyle()}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="gb-reminder-form__field">
              <span className="gb-field-label">Due date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className={uiClass.input}
                style={inputStyle()}
              />
            </label>
          </div>

          {form.reason === "Custom..." && (
            <input
              placeholder="Describe your reason…"
              value={form.customReason || ""}
              onChange={(e) => setForm({ ...form, customReason: e.target.value })}
              className={uiClass.input}
              style={{ ...inputStyle(), marginTop: 12 }}
            />
          )}

          {googleStatus.connected && (
            <label className="gb-check gb-reminder-form__calendar">
              <input
                type="checkbox"
                checked={form.syncToCalendar !== false}
                onChange={(e) => setForm({ ...form, syncToCalendar: e.target.checked })}
              />
              <span>Also add to Google Calendar</span>
            </label>
          )}

          <FormActions
            primary={<FormPrimaryButton onClick={save}>Save reminder</FormPrimaryButton>}
            secondary={
              <FormSecondaryButton
                onClick={() => {
                  setShowForm(false)
                  setForm(emptyReminderForm())
                }}
              >
                Cancel
              </FormSecondaryButton>
            }
          />
        </ContentCard>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={filter === "pending" ? "You're all caught up" : "Nothing here yet"}
          lede={
            filter === "pending"
              ? kindFilter === "suggested"
                ? "No suggestions right now. Add contacts or log outreach on Tracker."
                : "Add a reminder when you want a nudge — we also suggest follow-ups when contacts go quiet."
              : "Completed reminders show up here."
          }
          action={
            filter === "pending" ? (
              <button type="button" onClick={() => setShowForm(true)} {...primaryBtn()}>
                + New reminder
              </button>
            ) : null
          }
        />
      ) : (
        <div className="gb-record-list gb-reminders-list">
          {showGrouped ? (
            <>
              <p className="gb-reminders-section-label">Suggested for you</p>
              {suggestedInView.map(renderReminderRow)}
              <p className="gb-reminders-section-label">Your reminders</p>
              {yoursInView.map(renderReminderRow)}
            </>
          ) : (
            visibleReminders.map(renderReminderRow)
          )}
          <ViewMoreButton
            hiddenCount={hiddenReminderCount}
            showAll={showAllReminders}
            onToggle={() => setShowAllReminders((v) => !v)}
            singular="item"
          />
        </div>
      )}

      {filter === "pending" && kindFilter === "all" && suggestedCount > 0 && (
        <p className="gb-reminders-footnote">
          Suggested items come from contact warmth and your résumé date. <strong>Add to my list</strong> keeps them;{" "}
          <strong>Not now</strong> snoozes about 3 weeks.
        </p>
      )}
    </PageShell>
  )
}
