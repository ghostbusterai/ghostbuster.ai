import React, { useState, useEffect, useMemo } from "react"
import { api } from "../api"
import { getReminderDueStatus, isReminderOverdue, summarizePendingReminders, getReminderUrgencyStyle, getReminderUrgency } from "../reminderUtils"
import { font } from "../theme"
import { CardTitle, ContentCard, PageShell, responsiveGrid, PAGE_SPLIT_GRID, type } from "../layout"
import { primaryBtn, secondaryBtn } from "../uiStyles"
import { formatContactName, formatLastTouch, formatActivityTime } from "../formatters"
import { useMotivationalGreeting } from "../greeting"
import ViewMoreButton from "./ViewMoreButton"
import NetworkingSuccessReel from "./NetworkingSuccessReel"
import { previewHiddenCount, previewSlice } from "../listPreview"
import { Icon } from "../icons"

import { readLocalProfile, saveLocalProfile, GETTING_STARTED_SESSION_KEY, GETTING_STARTED_RESTORED_EVENT } from "../profile"
import { buildSortedReminderFeed } from "../autoReminders"

const LS_LOGS = "gb_outreach_logs"
const LS_UPDATES = "gb_resume_updates"

const GETTING_STARTED_STEPS = [
  {
    step: 1,
    title: "Add someone you've met",
    detail: "Career fair, coffee chat, LinkedIn — save their name and how you know them.",
    page: "contacts",
    cta: "Go to Contacts",
  },
  {
    step: 2,
    title: "Send them a message",
    detail: "On Contacts, tap the compose button to draft a warm follow-up or introduction.",
    page: "compose",
    cta: "Open Compose",
  },
  {
    step: 3,
    title: "Stay in touch",
    detail: "Log outreach in Tracker and set a reminder so relationships don't go cold.",
    page: "tracker",
    cta: "Open Tracker",
  },
]

function parseDay(iso) {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function daysSinceLastTouch(contact) {
  const ms = contact?.lastContacted ? parseDay(contact.lastContacted) : 0
  if (!ms) return Infinity
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
}

/** Warmth label + colors for status pill */
function warmthPill(days) {
  if (days === Infinity) return { label: "No touch yet", fg: "#9ca3af", bg: "rgba(156,163,175,0.15)" }
  if (days <= 21) return { label: "Warm", fg: "var(--gb-accent)", bg: "var(--gb-accent-soft)" }
  if (days <= 45) return { label: "Check in", fg: "var(--gb-warning)", bg: "rgba(255,201,107,0.12)" }
  return { label: "Overdue", fg: "var(--gb-danger)", bg: "rgba(255,107,107,0.12)" }
}

function contactRecencyMs(c) {
  const idT = Number(c.id) || 0
  const lc = c.lastContacted ? parseDay(c.lastContacted) : 0
  return Math.max(idT, lc)
}

function contactReminderBadge(contact, reminders) {
  const n = contact.name?.trim().toLowerCase()
  if (!n) return null
  const pending = reminders.filter(
    (r) => !r.done && String(r.contactName || "").trim().toLowerCase() === n
  )
  if (!pending.length) return null
  if (pending.some((r) => isReminderOverdue(r))) return "overdue"
  return "pending"
}

function warmthTone(label) {
  if (label === "Warm") return "warm"
  if (label === "Check in") return "check"
  if (label === "Overdue") return "overdue"
  return "muted"
}

function isWithinDays(ms, days) {
  if (!ms) return false
  return Date.now() - ms <= days * 24 * 60 * 60 * 1000
}

function contactAddedMs(contact) {
  const idT = Number(contact.id) || 0
  if (idT > 1e12) return idT
  return 0
}

const SNAPSHOT_ICON_STROKE = {
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
}

function SnapshotIcon({ name, color, size = 20 }) {
  const svgProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  }
  const stroke = { stroke: color, ...SNAPSHOT_ICON_STROKE }

  switch (name) {
    case "contacts":
      return (
        <svg {...svgProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...stroke} />
          <circle cx="9" cy="7" r="4" {...stroke} />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" {...stroke} />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" {...stroke} />
        </svg>
      )
    case "reminders":
      return (
        <svg {...svgProps}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...stroke} />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" {...stroke} />
        </svg>
      )
    case "companies":
      return (
        <svg {...svgProps}>
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" {...stroke} />
          <path d="M6 12h12" {...stroke} />
          <path d="M6 16h12" {...stroke} />
          <path d="M6 8h12" {...stroke} />
          <path d="M10 6h4" {...stroke} />
        </svg>
      )
    case "outreach":
      return (
        <svg {...svgProps}>
          <path d="m22 2-7 20-4-9-9-4Z" {...stroke} />
          <path d="M22 2 11 13" {...stroke} />
        </svg>
      )
    default:
      return null
  }
}

function QuickActionIcon({ name, color, size = 20 }) {
  const svgProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  }
  const stroke = { stroke: color, ...SNAPSHOT_ICON_STROKE }

  switch (name) {
    case "add":
      return (
        <svg {...svgProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...stroke} />
          <circle cx="9" cy="7" r="4" {...stroke} />
          <path d="M19 8v6" {...stroke} />
          <path d="M22 11h-6" {...stroke} />
        </svg>
      )
    case "reminders":
      return <SnapshotIcon name="reminders" color={color} size={size} />
    case "compose":
      return <SnapshotIcon name="outreach" color={color} size={size} />
    case "resume":
      return (
        <svg {...svgProps}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...stroke} />
          <path d="M14 2v6h6" {...stroke} />
          <path d="M10 13H8" {...stroke} />
          <path d="M16 13h-2" {...stroke} />
          <path d="M10 17H8" {...stroke} />
          <path d="M16 17h-4" {...stroke} />
        </svg>
      )
    case "applications":
      return (
        <svg {...svgProps}>
          <rect x="8" y="3" width="8" height="4" rx="1" {...stroke} />
          <path d="M8 7v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" {...stroke} />
          <path d="M10 11h4" {...stroke} />
          <path d="M10 15h4" {...stroke} />
        </svg>
      )
    case "tracker":
      return (
        <svg {...svgProps}>
          <path d="M4 20V10" {...stroke} />
          <path d="M10 20V4" {...stroke} />
          <path d="M16 20v-8" {...stroke} />
          <path d="M22 20v-12" {...stroke} />
        </svg>
      )
    default:
      return null
  }
}

const QUICK_ACTIONS = [
  { page: "contacts", title: "Add contact", sub: "Save someone new", icon: "add" },
  { page: "compose", title: "Compose", sub: "Draft outreach", icon: "compose" },
  { page: "reminders", title: "Set reminder", sub: "Schedule follow-up", icon: "reminders" },
  { page: "tracker", title: "Tracker", sub: "Warmth & touches", icon: "tracker" },
  { page: "applications", title: "Applications", sub: "Pipeline & portals", icon: "applications" },
  { page: "updates", title: "Resume", sub: "Update your docs", icon: "resume" },
]

const WEEKLY_OUTREACH_GOAL = 15

export default function Dashboard({ setPage }) {
  const greeting = useMotivationalGreeting()
  const [contacts, setContacts] = useState([])
  const [reminders, setReminders] = useState([])
  const [outreachLogs, setOutreachLogs] = useState([])
  const [resumeUpdates, setResumeUpdates] = useState([])
  const [lastResumeUpdate, setLastResumeUpdate] = useState(() => readLocalProfile().lastResumeUpdate || "")
  const [hideGettingStarted, setHideGettingStarted] = useState(
    () => readLocalProfile().hideGettingStarted === true
  )
  const [sessionDismissedTutorial, setSessionDismissedTutorial] = useState(
    () => sessionStorage.getItem(GETTING_STARTED_SESSION_KEY) === "1"
  )
  const [showAllRecentContacts, setShowAllRecentContacts] = useState(false)
  const [showAllRecentActivity, setShowAllRecentActivity] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { profile } = await api.getProfile()
        if (!cancelled && profile) {
          saveLocalProfile(profile)
          if (profile.hideGettingStarted) setHideGettingStarted(true)
          if (profile.lastResumeUpdate) setLastResumeUpdate(profile.lastResumeUpdate)
        }
      } catch {
        /* use local profile from initial state */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onRestored() {
      setHideGettingStarted(false)
      setSessionDismissedTutorial(false)
    }
    window.addEventListener(GETTING_STARTED_RESTORED_EVENT, onRestored)
    return () => {
      window.removeEventListener(GETTING_STARTED_RESTORED_EVENT, onRestored)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cRes, rRes, logRes, upRes] = await Promise.all([
          api.getContacts(),
          api.getReminders(),
          api.getOutreachLogs(),
          api.getResumeUpdates(),
        ])
        if (!cancelled) {
          setContacts(cRes.contacts || [])
          setReminders(rRes.reminders || [])
          setOutreachLogs(logRes.logs || [])
          setResumeUpdates(upRes.updates || [])
        }
      } catch {
        if (!cancelled) {
          setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
          setReminders(JSON.parse(localStorage.getItem("gb_reminders") || "[]"))
          setOutreachLogs(JSON.parse(localStorage.getItem(LS_LOGS) || "[]"))
          setResumeUpdates(JSON.parse(localStorage.getItem(LS_UPDATES) || "[]"))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const reminderFeed = useMemo(
    () =>
      buildSortedReminderFeed({
        savedReminders: reminders,
        contacts,
        outreachLogs,
        lastResumeUpdate,
      }),
    [reminders, contacts, outreachLogs, lastResumeUpdate]
  )

  const dueReminders = reminderFeed.filter((r) => !r.done)
  const overdueReminders = reminderFeed.filter((r) => isReminderOverdue(r))
  const reminderSummary = summarizePendingReminders(reminderFeed)

  const isNewUser = contacts.length === 0
  const showGettingStarted = !hideGettingStarted && !sessionDismissedTutorial

  async function dismissTutorialPermanently() {
    setHideGettingStarted(true)
    setSessionDismissedTutorial(true)
    sessionStorage.setItem(GETTING_STARTED_SESSION_KEY, "1")
    const profile = { ...readLocalProfile(), hideGettingStarted: true }
    saveLocalProfile(profile)
    try {
      await api.patchProfile({ hideGettingStarted: true })
    } catch {
      /* saved locally */
    }
  }

  const contactsThisWeek = contacts.filter((c) => isWithinDays(contactAddedMs(c), 7)).length
  const companiesSet = [...new Set(contacts.map((c) => c.company).filter(Boolean))]
  const companiesThisWeek = contacts.filter(
    (c) => c.company?.trim() && isWithinDays(contactAddedMs(c), 7)
  ).length
  const weeklyOutreachCount = contacts.filter((c) => {
    if (!c.lastContacted) return false
    return isWithinDays(parseDay(c.lastContacted), 7)
  }).length

  const weekLogs = outreachLogs.filter((log) => isWithinDays(parseDay(log.contactedAt) || Number(log.id), 7))
  const outreachBuckets = {
    cold: weekLogs.filter((l) => l.channel === "Email" || l.channel === "LinkedIn").length,
    followups: weekLogs.filter((l) => l.channel === "Call" || l.channel === "In-person").length,
    referral: weekLogs.filter((l) => l.channel === "Other").length,
  }
  const weeklyLogTotal = weekLogs.length || weeklyOutreachCount

  const stats = [
    {
      label: "Contacts in your network",
      value: contacts.length,
      trend: contactsThisWeek > 0 ? `+${contactsThisWeek} added this week` : null,
      tag: contacts.length > 0 ? "Active" : null,
      icon: "contacts",
      color: "var(--gb-accent)",
      page: "contacts",
    },
    {
      label: "Items in your reminder feed",
      value: dueReminders.length,
      trend: overdueReminders.length > 0 ? `${overdueReminders.length} overdue` : reminderSummary.today > 0 ? `${reminderSummary.today} due today` : null,
      tag: reminderSummary.attention > 0 ? "Urgent" : null,
      icon: "reminders",
      color: overdueReminders.length > 0 ? "var(--gb-danger)" : "var(--gb-warning)",
      page: "notifications",
    },
    {
      label: "Companies you're tracking",
      value: companiesSet.length,
      trend: companiesThisWeek > 0 ? `${companiesThisWeek} new this week` : null,
      icon: "companies",
      color: "var(--gb-text-secondary)",
    },
    {
      label: "Outreach touches logged this week",
      value: weeklyLogTotal,
      trend: `Weekly goal: ${WEEKLY_OUTREACH_GOAL}`,
      icon: "outreach",
      color: "var(--gb-accent-muted)",
      page: "tracker",
    },
  ]

  const sortedRecentContacts = useMemo(() => {
    return [...contacts].sort((a, b) => contactRecencyMs(b) - contactRecencyMs(a))
  }, [contacts])

  const visibleRecentContacts = useMemo(
    () => previewSlice(sortedRecentContacts, showAllRecentContacts),
    [sortedRecentContacts, showAllRecentContacts]
  )
  const hiddenRecentContactCount = previewHiddenCount(sortedRecentContacts, showAllRecentContacts)

  const activityFeed = useMemo(() => {
    const items = []
    const contactById = new Map(contacts.map((c) => [c.id, c]))

    for (const log of outreachLogs) {
      const person = contactById.get(log.contactId)
      const ts = parseDay(log.contactedAt) || Number(log.id) || 0
      const ch = log.channel ? String(log.channel) : "Touchpoint"
      const note = log.note?.trim()
      items.push({
        id: `log-${log.id}`,
        kind: "outreach",
        ts,
        accent: "#5be4d8",
        title: person?.name ? `${person.name} · ${ch}` : `Outreach · ${ch}`,
        detail: note || "Logged touchpoint",
        page: "tracker",
      })
    }

    for (const u of resumeUpdates) {
      const ts = parseDay(u.createdAt) || parseDay(u.effectiveDate) || Number(u.id) || 0
      items.push({
        id: `up-${u.id}`,
        kind: "update",
        ts,
        accent: "#b482ff",
        title: u.title || "Résumé update",
        detail: typeof u.details === "string" ? u.details.replace(/\s+/g, " ").trim().slice(0, 120) : "",
        page: "updates",
      })
    }

    for (const r of reminders) {
      if (r.done) continue
      const due = r.dueDate ? parseDay(r.dueDate) : 0
      const ts = due || Number(r.id) || 0
      const reason = (r.customReason || r.reason || "Reminder")?.replace(/\s+/g, " ").trim()
      const status = getReminderDueStatus(r)
      const urgency = getReminderUrgency(r)
      const urgencyStyle = getReminderUrgencyStyle(urgency)
      items.push({
        id: `rem-${r.id}`,
        kind: "reminder",
        ts,
        accent: urgencyStyle.color,
        title: `Reminder · ${r.contactName || "Contact"}`,
        detail: status.overdue ? `Overdue · ${reason}` : reason,
        page: "notifications",
      })
    }

    items.sort((a, b) => b.ts - a.ts)
    return items
  }, [contacts, outreachLogs, resumeUpdates, reminders])

  const visibleActivityFeed = useMemo(
    () => previewSlice(activityFeed, showAllRecentActivity),
    [activityFeed, showAllRecentActivity]
  )
  const hiddenRecentActivityCount = previewHiddenCount(activityFeed, showAllRecentActivity)

  return (
    <PageShell className="gb-dashboard">
      <section className="gb-spacex-hero gb-spacex-hero--intro" aria-labelledby="dashboard-hero-title">
        <div className="gb-spacex-hero__content">
          <p className="gb-spacex-hero__eyebrow">GhostBuster</p>
          <h1 id="dashboard-hero-title" className="gb-spacex-hero__title">
            {greeting}
          </h1>
          <p className="gb-spacex-hero__lede">
            Nurture the relationships that turn intros into interviews — contacts, outreach, and follow-ups in one
            place.
          </p>
          <div className="gb-spacex-hero__cta-row">
            <button type="button" className="gb-spacex-hero__cta" onClick={() => setPage("contacts")}>
              Build your network
            </button>
            <button type="button" className="gb-spacex-hero__cta gb-spacex-hero__cta--ghost" onClick={() => setPage("compose")}>
              Compose
            </button>
          </div>
        </div>
      </section>

      <section className="gb-spacex-reel-section" aria-label="Networking success stories">
        <p className="gb-spacex-reel-section__label">Students who landed roles through consistent networking</p>
        <NetworkingSuccessReel id="networking-wins" variant="scroll" />
      </section>

      {showGettingStarted && (
        <ContentCard className="gb-getting-started" marginBottom={32}>
          <CardTitle helper="GhostBuster helps you nurture relationships with people you've already met — career fairs, coffee chats, LinkedIn, interviews.">
            Welcome — here's how to connect
          </CardTitle>
          <div className="gb-steps">
            {GETTING_STARTED_STEPS.map((s) => (
              <button key={s.step} type="button" className="gb-step-tile" onClick={() => setPage(s.page)}>
                <span className="gb-step-tile__num">{String(s.step).padStart(2, "0")}</span>
                <span className="gb-step-tile__title">{s.title}</span>
                <span className="gb-step-tile__detail">{s.detail}</span>
                <span className="gb-step-tile__cta">{s.cta.replace(/\s*→\s*$/, "")}</span>
              </button>
            ))}
          </div>
          <div className="gb-getting-started__footer">
            {isNewUser && (
              <button type="button" onClick={() => setPage("contacts")} {...primaryBtn()}>
                Add your first contact
                <Icon name="chevron-right" size={14} color="var(--gb-accent-text-on)" />
              </button>
            )}
            <button type="button" onClick={dismissTutorialPermanently} {...secondaryBtn({ style: { background: "transparent", border: "none" } })}>
              Don&apos;t show again
            </button>
          </div>
        </ContentCard>
      )}

      <section className="gb-snapshot-wrap gb-stat-showcase" aria-labelledby="dashboard-stats-title">
        <header className="gb-stat-showcase__intro">
          <h2 id="dashboard-stats-title" className="gb-stat-showcase__title">
            Your network, measured
          </h2>
          <p className="gb-stat-showcase__lede">Tap a metric to open the right workspace — live counts from your account.</p>
        </header>
        <div className="gb-snapshot-grid gb-stat-showcase__grid">
          {stats.map((s) => {
            const interactive = Boolean(s.page)
            const className = `gb-snapshot-stat${interactive ? " gb-snapshot-stat--interactive" : ""}`
            const accentStyle = { "--snapshot-accent": s.color }
            const body = (
              <>
                <div className="gb-snapshot-stat__value">{s.value}</div>
                <p className="gb-snapshot-stat__label">{s.label}</p>
                {s.trend && <div className="gb-snapshot-stat__trend">{s.trend}</div>}
                <div className="gb-snapshot-stat__head" aria-hidden>
                  <span className="gb-snapshot-stat__icon">
                    <SnapshotIcon name={s.icon} color={s.color} size={20} />
                  </span>
                  {s.tag && <span className="gb-snapshot-stat__tag">{s.tag}</span>}
                </div>
              </>
            )
            return interactive ? (
              <button
                key={s.label}
                type="button"
                className={className}
                style={accentStyle}
                aria-label={`${s.label}: ${s.value}${s.trend ? `, ${s.trend}` : ""}`}
                onClick={() => setPage(s.page)}
              >
                {body}
              </button>
            ) : (
              <div key={s.label} className={className} style={accentStyle}>
                {body}
              </div>
            )
          })}
        </div>
      </section>

      <ContentCard marginBottom={24} className="gb-quick-actions-card" padding="22px 24px 0">
        <CardTitle helper="Jump straight into a workflow.">Quick actions</CardTitle>
        <div className="gb-quick-actions-grid" role="list">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.page}
              type="button"
              role="listitem"
              className="gb-quick-action"
              aria-label={`${action.title} — ${action.sub}`}
              onClick={() => setPage(action.page)}
            >
              <span className="gb-quick-action__icon" aria-hidden>
                <QuickActionIcon name={action.icon} color="currentColor" />
              </span>
              <span className="gb-quick-action__copy">
                <span className="gb-quick-action__title">{action.title}</span>
                <span className="gb-quick-action__sub">{action.sub}</span>
              </span>
              <Icon name="chevron-right" size={16} className="gb-quick-action__arrow" />
            </button>
          ))}
        </div>
      </ContentCard>

      <ContentCard marginBottom={24} className="gb-weekly-outreach-card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <CardTitle style={{ marginBottom: 0, flex: "1 1 auto" }}>Weekly outreach goal</CardTitle>
          <div style={{ fontFamily: font.mono, fontSize: 12, color: "var(--gb-text-muted)" }}>
            {weeklyLogTotal} / {WEEKLY_OUTREACH_GOAL} sent
          </div>
        </div>
        {[
          { label: "Cold outreach", value: outreachBuckets.cold },
          { label: "Follow-ups", value: outreachBuckets.followups },
          { label: "Referral asks", value: outreachBuckets.referral },
        ].map(({ label, value }) => {
          const pct = WEEKLY_OUTREACH_GOAL > 0 ? Math.min(100, (value / WEEKLY_OUTREACH_GOAL) * 100) : 0
          return (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "var(--gb-text-secondary)" }}>{label}</span>
                <span style={{ fontFamily: font.mono, color: "var(--gb-text-muted)" }}>{value}</span>
              </div>
              <div className="gb-progress-bar">
                <div className="gb-progress-bar__fill" style={{ width: `${pct}%`, minWidth: value > 0 ? 4 : 0 }} />
              </div>
            </div>
          )
        })}
      </ContentCard>

      <div
        className="gb-dashboard-split"
        style={{
          display: "grid",
          gridTemplateColumns: PAGE_SPLIT_GRID,
          gap: 28,
          alignItems: "start",
          marginBottom: 8,
        }}
      >
      <ContentCard className="gb-recent-activity-card" padding="18px 18px 8px" marginBottom={0}>
        <CardTitle style={{ marginBottom: 14 }}>Recent activity</CardTitle>
      <div className="gb-activity-list-wrap">
        {activityFeed.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--gb-text-muted)",
              fontSize: 14,
            }}
          >
            No activity yet. Log outreach in Tracker or add a résumé update.
          </div>
        ) : (
          <>
          {visibleActivityFeed.map((item) => (
            <button
              key={item.id}
              type="button"
              className="gb-activity-row"
              onClick={() => setPage(item.page)}
            >
              <span className="gb-activity-row__dot" style={{ background: item.accent }} aria-hidden />
              <span className="gb-activity-row__copy">
                <span className="gb-activity-row__title">{item.title}</span>
                {item.detail ? <span className="gb-activity-row__detail">{item.detail}</span> : null}
              </span>
              <span className="gb-activity-row__time">{formatActivityTime(item.ts)}</span>
            </button>
          ))}
          <ViewMoreButton
            hiddenCount={hiddenRecentActivityCount}
            showAll={showAllRecentActivity}
            onToggle={() => setShowAllRecentActivity((v) => !v)}
            singular="activity item"
            plural="activity items"
            style={{ margin: "8px 10px 0" }}
          />
          </>
        )}
      </div>
      </ContentCard>

      <ContentCard className="gb-recent-contacts-card" padding="18px 18px 8px" marginBottom={0}>
        <div className="gb-card-toolbar">
          <CardTitle helper="Sorted by latest touch or date added" style={{ marginBottom: 0 }}>
            Recent contacts
          </CardTitle>
          <button type="button" className="gb-btn gb-btn--ghost gb-btn--sm" onClick={() => setPage("contacts")}>
            View all
          </button>
        </div>

        {sortedRecentContacts.length === 0 ? (
          <div className="gb-contact-empty">
            <Icon name="users" size={28} color="var(--gb-text-faint)" />
            <p className="gb-contact-empty__title">No contacts saved yet</p>
            <p className="gb-contact-empty__lede">
              Add someone from a career fair, class, or LinkedIn — then use Compose to reach out.
            </p>
            <button type="button" className="gb-spacex-hero__cta" onClick={() => setPage("contacts")}>
              Add contact
            </button>
          </div>
        ) : (
          <ul className="gb-contact-list">
            {visibleRecentContacts.map((c) => {
              const d = daysSinceLastTouch(c)
              const warm = warmthPill(d)
              const reminderBadge = contactReminderBadge(c, reminders)
              const lastTouch = formatLastTouch(c.lastContacted)
              const displayName = formatContactName(c.name)
              const meta = [c.role, c.company].filter(Boolean).join(" · ")

              return (
                <li key={c.id}>
                  <button type="button" className="gb-contact-row" onClick={() => setPage("contacts")}>
                    <span className="gb-contact-row__avatar" aria-hidden>
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                    <span className="gb-contact-row__body">
                      <span className="gb-contact-row__top">
                        <span className="gb-contact-row__name">{displayName}</span>
                        <span className="gb-contact-row__date">{lastTouch || "Not yet"}</span>
                      </span>
                      <span className="gb-contact-row__meta">{meta || "Add company & role in Contacts"}</span>
                      <span className="gb-contact-row__status-line">
                        <span className="gb-contact-row__status" data-tone={warmthTone(warm.label)}>
                          {warm.label}
                        </span>
                        {reminderBadge ? (
                          <span
                            className="gb-contact-row__status"
                            data-tone={reminderBadge === "overdue" ? "overdue" : "check"}
                          >
                            {reminderBadge === "overdue" ? "Reminder overdue" : "Reminder pending"}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {sortedRecentContacts.length > 0 && (
          <ViewMoreButton
            hiddenCount={hiddenRecentContactCount}
            showAll={showAllRecentContacts}
            onToggle={() => setShowAllRecentContacts((v) => !v)}
            singular="contact"
            style={{ margin: "4px 0 8px" }}
          />
        )}
      </ContentCard>
      </div>
    </PageShell>
  )
}
