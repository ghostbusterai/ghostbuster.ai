import React, { useState, useEffect, useMemo } from "react"
import { api, BASE } from "../api"
import { dangerBtn, inputStyle, linkBtn, primaryBtn, secondaryBtn } from "../uiStyles"
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
  reminderContactInitial,
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
          "gb-reminder-row--in-feed",
          "gb-reveal-block",
          r.done ? "gb-record-row--done gb-reminder-row--done" : "",
          auto ? "gb-record-row--suggested gb-reminder-row--suggested" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-urgency={!r.done && !auto ? urgency : undefined}
      >
        <div className="gb-reminder-row__body">
          <span className="gb-reminder-avatar" aria-hidden="true" title={r.contactName}>
            {reminderContactInitial(r.contactName)}
          </span>
          <div className="gb-reminder-row__main">
            <div className="gb-reminder-row__title-line">
              <h3 className={`gb-reminder-row__name${r.done ? " gb-reminder-row__name--done" : ""}`}>{r.contactName}</h3>
              {!r.done && auto && <span className="gb-reminder-chip gb-reminder-chip--suggested">Suggested</span>}
              {!r.done && !auto && (
                <span className={`gb-reminder-chip gb-reminder-chip--${urgency}`}>{style.label}</span>
              )}
            </div>
            <p className="gb-reminder-row__reason">{r.reason || "General check-in"}</p>
            {r.dueDate && (
              <p className={`gb-reminder-row__meta${r.done ? " gb-reminder-row__meta--done" : ""}`}>
                {r.done ? (
                  parseDueDay(r.dueDate)?.toLocaleDateString() ?? r.dueDate
                ) : (
                  <>
                    <span className={`gb-reminder-row__when gb-reminder-row__when--${urgency}`}>
                      {reminderDueLabel(r)}
                    </span>
                    {r.googleEventId ? <span className="gb-reminder-row__meta-note">On calendar</span> : null}
                  </>
                )}
              </p>
            )}
          </div>
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
              <button type="button" onClick={() => remove(r.id)} {...dangerBtn({ sm: true })}>
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

      <ContentCard padding="18px 20px" marginBottom={20} className="gb-reminders-controls">
        {summaryPills.length > 0 && (
          <div className="gb-reminders-stat-strip" aria-label="Reminder summary">
            {summaryPills.map((pill) => {
              const pillStyle = pill.key === "suggested" ? null : getReminderUrgencyStyle(pill.key)
              const tone =
                pill.key === "suggested"
                  ? "suggested"
                  : pill.key === "overdue"
                    ? "overdue"
                    : pill.key === "today"
                      ? "today"
                      : "neutral"
              return (
                <div key={pill.key} className={`gb-reminders-stat gb-reminders-stat--${tone}`}>
                  <span className="gb-reminders-stat__n" style={pillStyle ? { color: pillStyle.color } : undefined}>
                    {pill.count}
                  </span>
                  <span className="gb-reminders-stat__l">{pill.label}</span>
                </div>
              )
            })}
          </div>
        )}
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
                <button
                  type="button"
                  onClick={disconnectGoogleCalendar}
                  {...linkBtn({ sm: true, className: "gb-reminders-calendar-line__link" })}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={connectGoogleCalendar}
                {...linkBtn({ sm: true, className: "gb-reminders-calendar-line__link" })}
              >
                Connect for due-date sync
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCalendarHelp((v) => !v)}
              aria-expanded={showCalendarHelp}
              {...linkBtn({ sm: true, className: "gb-reminders-calendar-line__link" })}
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
        <ContentCard className="gb-reminders-feed-card" padding="8px 10px 12px" marginBottom={20}>
          <div className="gb-record-list gb-reminders-list">
            {showGrouped ? (
              <>
                <div className="gb-reminders-section">
                  <p className="gb-reminders-section__title">Suggested for you</p>
                  <p className="gb-reminders-section__hint">From Tracker warmth and your résumé — add or dismiss.</p>
                  {suggestedInView.map(renderReminderRow)}
                </div>
                <div className="gb-reminders-section">
                  <p className="gb-reminders-section__title">Your reminders</p>
                  {yoursInView.map(renderReminderRow)}
                </div>
              </>
            ) : (
              visibleReminders.map(renderReminderRow)
            )}
          </div>
          <ViewMoreButton
            hiddenCount={hiddenReminderCount}
            showAll={showAllReminders}
            onToggle={() => setShowAllReminders((v) => !v)}
            singular="item"
            style={{ margin: "8px 8px 4px" }}
          />
        </ContentCard>
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
