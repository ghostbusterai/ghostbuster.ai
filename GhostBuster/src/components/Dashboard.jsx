import React, { useState, useEffect, useMemo } from "react"
import { api } from "../api"
import { getReminderDueStatus, isReminderOverdue, summarizePendingReminders, getReminderUrgencyStyle, getReminderUrgency } from "../reminderUtils"
import { font } from "../theme"
import { SectionLabel } from "../layout"

import { readLocalProfile, saveLocalProfile, GETTING_STARTED_SESSION_KEY, GETTING_STARTED_RESTORED_EVENT, PROFILE_UPDATED_EVENT } from "../profile"

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
    detail: "Use Compose to draft a warm follow-up or introduction email.",
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

function tintedCard(rgb, borderAlpha = 0.2) {
  return {
    background: `color-mix(in srgb, rgb(${rgb}) 14%, var(--gb-bg-elevated))`,
    border: `1px solid rgba(${rgb},${borderAlpha})`,
    boxShadow: `var(--gb-inset-highlight), 0 12px 40px -12px rgba(${rgb},0.22)`,
  }
}

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

function formatActivityTime(ts) {
  if (!ts || Number.isNaN(ts)) return "—"
  const d = new Date(ts)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const ms = d.getTime()
  if (ms >= startOfToday.getTime()) {
    const hours = Math.floor((now - d) / (1000 * 60 * 60))
    if (hours < 1) return "Now"
    if (hours < 24) return `${hours}h`
    return "Today"
  }
  if (ms >= startOfYesterday.getTime()) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "short" })
}

function greetingForHour(h = new Date().getHours()) {
  if (h >= 5 && h < 12) return "Good morning"
  if (h >= 12 && h < 17) return "Good afternoon"
  if (h >= 17 && h < 22) return "Good evening"
  return "Good night"
}

function useTimeGreeting() {
  const [greeting, setGreeting] = useState(() => greetingForHour())

  useEffect(() => {
    function syncGreeting() {
      setGreeting((prev) => {
        const next = greetingForHour()
        return prev === next ? prev : next
      })
    }

    syncGreeting()
    const id = setInterval(syncGreeting, 60_000)
    return () => clearInterval(id)
  }, [])

  return greeting
}

function firstName(name) {
  const part = String(name || "").trim().split(/\s+/).filter(Boolean)[0]
  return part || ""
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

const QUICK_ACTIONS = [
  { page: "contacts", title: "Add contact", sub: "Save someone new", mark: "+", markColor: "var(--gb-accent)" },
  { page: "reminders", title: "Set reminder", sub: "Schedule follow-up", mark: "⏰", markColor: "var(--gb-danger)" },
  { page: "compose", title: "Compose message", sub: "Draft outreach", mark: "✉", markColor: "#5be4d8" },
  { page: "updates", title: "Update resume", sub: "Refresh your docs", mark: "📄", markColor: "#b482ff" },
]

const WEEKLY_OUTREACH_GOAL = 15

export default function Dashboard({ setPage }) {
  const [contacts, setContacts] = useState([])
  const [reminders, setReminders] = useState([])
  const [outreachLogs, setOutreachLogs] = useState([])
  const [resumeUpdates, setResumeUpdates] = useState([])
  const [hideGettingStarted, setHideGettingStarted] = useState(
    () => readLocalProfile().hideGettingStarted === true
  )
  const [profileName, setProfileName] = useState(() => readLocalProfile().name || "")
  const greeting = useTimeGreeting()
  const [sessionDismissedTutorial, setSessionDismissedTutorial] = useState(
    () => sessionStorage.getItem(GETTING_STARTED_SESSION_KEY) === "1"
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { profile } = await api.getProfile()
        if (!cancelled && profile) {
          saveLocalProfile(profile)
          if (profile.hideGettingStarted) setHideGettingStarted(true)
          setProfileName(profile.name || "")
        }
      } catch {
        setProfileName(readLocalProfile().name || "")
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
    function onProfileUpdated(e) {
      setProfileName(e.detail?.name ?? readLocalProfile().name ?? "")
    }
    window.addEventListener(GETTING_STARTED_RESTORED_EVENT, onRestored)
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated)
    return () => {
      window.removeEventListener(GETTING_STARTED_RESTORED_EVENT, onRestored)
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated)
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

  const dueReminders = reminders.filter((r) => !r.done)
  const overdueReminders = reminders.filter((r) => isReminderOverdue(r))
  const reminderSummary = summarizePendingReminders(reminders)

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
      label: "Total contacts",
      value: contacts.length,
      trend: contactsThisWeek > 0 ? `${contactsThisWeek} this week` : null,
      tag: contacts.length > 0 ? "Active" : null,
      icon: "contacts",
      color: "var(--gb-accent)",
      rgb: "184, 255, 87",
    },
    {
      label: "Pending reminders",
      value: dueReminders.length,
      trend: overdueReminders.length > 0 ? `${overdueReminders.length} overdue` : reminderSummary.today > 0 ? `${reminderSummary.today} due today` : null,
      tag: reminderSummary.attention > 0 ? "Urgent" : null,
      icon: "reminders",
      color: reminderSummary.critical > 0 ? "var(--gb-danger)" : overdueReminders.length > 0 ? "#ff8787" : "var(--gb-warning)",
      rgb: reminderSummary.critical > 0 ? "255, 107, 107" : overdueReminders.length > 0 ? "255, 135, 135" : "255, 201, 107",
      page: "notifications",
    },
    {
      label: "Companies tracked",
      value: companiesSet.length,
      trend: companiesThisWeek > 0 ? `${companiesThisWeek} new` : null,
      icon: "companies",
      color: "#5be4d8",
      rgb: "91, 228, 216",
    },
    {
      label: "Weekly outreach",
      value: weeklyOutreachCount,
      trend: `goal: ${WEEKLY_OUTREACH_GOAL}`,
      icon: "outreach",
      color: "#b482ff",
      rgb: "180, 130, 255",
      page: "tracker",
    },
  ]

  const recentContacts = useMemo(() => {
    return [...contacts].sort((a, b) => contactRecencyMs(b) - contactRecencyMs(a)).slice(0, 6)
  }, [contacts])

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
    return items.slice(0, 14)
  }, [contacts, outreachLogs, resumeUpdates, reminders])

  return (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", minWidth: 0 }}>
      {/* Hero greeting */}
      <section
        style={{
          background: "var(--gb-bg-elevated)",
          border: "1px solid var(--gb-border)",
          borderRadius: 20,
          padding: "24px 22px 22px",
          marginBottom: 24,
          boxShadow: "var(--gb-shadow-panel)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontFamily: font.mono,
            letterSpacing: "0.16em",
            color: "var(--gb-text-faint)",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Your career network
        </div>
        <h1
          style={{
            fontFamily: font.h1,
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: "-0.5px",
            margin: "0 0 8px",
            lineHeight: 1.2,
          }}
        >
          {firstName(profileName)
            ? `${greeting}, ${firstName(profileName)}`
            : greeting}
        </h1>
        {dueReminders.length > 0 ? (
          <button
            type="button"
            onClick={() => setPage("notifications")}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              color: "var(--gb-text-muted)",
              fontSize: 15,
              fontFamily: font.body,
              lineHeight: 1.5,
              textAlign: "left",
              boxShadow: "none",
            }}
          >
            You have{" "}
            <strong style={{ color: reminderSummary.attention > 0 ? "var(--gb-danger)" : "var(--gb-warning)" }}>
              {reminderSummary.attention > 0 ? reminderSummary.attention : dueReminders.length} follow-up
              {(reminderSummary.attention > 0 ? reminderSummary.attention : dueReminders.length) !== 1 ? "s" : ""}
            </strong>{" "}
            due {reminderSummary.today > 0 ? "today" : "soon"} →
          </button>
        ) : (
          <p style={{ margin: 0, color: "var(--gb-text-muted)", fontSize: 15, lineHeight: 1.5 }}>
            {isNewUser
              ? "Stay in touch with people you've already met — add them here, then reach out with a message."
              : "Your networking activity at a glance."}
          </p>
        )}
      </section>

      {showGettingStarted && (
        <section
          style={{
            background: "var(--gb-bg-elevated)",
            border: "1px solid var(--gb-accent-border)",
            borderRadius: 18,
            padding: "28px 28px 24px",
            marginBottom: 32,
            boxShadow: "0 0 0 1px var(--gb-accent-soft), 0 16px 48px rgba(0,0,0,0.35)",
            position: "relative",
            fontFamily: font.body,
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 12,
                fontFamily: font.body,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "var(--gb-accent-muted)",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Getting started
            </div>
            <h2
              style={{
                fontFamily: font.h2,
                fontWeight: 700,
                fontSize: 24,
                letterSpacing: "-0.3px",
                margin: "0 0 12px",
                lineHeight: 1.35,
                color: "var(--gb-text)",
              }}
            >
              Welcome — here&apos;s how to connect with people
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                fontFamily: font.body,
                color: "var(--gb-text-secondary)",
                lineHeight: 1.65,
                maxWidth: 680,
              }}
            >
              GhostBuster doesn&apos;t find strangers for you. It helps you nurture relationships with people
              you&apos;ve already met — at a career fair, through a friend, on LinkedIn, or after an interview.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              marginBottom: 24,
              alignItems: "start",
            }}
          >
            {GETTING_STARTED_STEPS.map((s) => (
              <div
                key={s.step}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--gb-accent-soft)",
                    border: "1px solid var(--gb-accent-border)",
                    color: "var(--gb-accent)",
                    fontFamily: font.body,
                    fontWeight: 600,
                    fontSize: 15,
                    fontVariantNumeric: "tabular-nums",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginBottom: 14,
                  }}
                >
                  {s.step}
                </div>
                <button
                  type="button"
                  onClick={() => setPage(s.page)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    textAlign: "left",
                    width: "100%",
                    height: "100%",
                    minHeight: 160,
                    background: "var(--gb-surface-hover)",
                    border: "1px solid var(--gb-border-subtle)",
                    borderRadius: 14,
                    padding: "18px 18px 16px",
                    cursor: "pointer",
                    color: "var(--gb-text)",
                    fontFamily: font.body,
                    boxShadow: "none",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--gb-accent-border)"
                    e.currentTarget.style.background = "var(--gb-accent-soft)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--gb-border-subtle)"
                    e.currentTarget.style.background = "var(--gb-surface-hover)"
                  }}
                >
                  <div
                    style={{
                      fontFamily: font.body,
                      fontWeight: 600,
                      fontSize: 16,
                      lineHeight: 1.4,
                      minHeight: 44,
                      marginBottom: 10,
                      width: "100%",
                      color: "var(--gb-text)",
                    }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontFamily: font.body,
                      color: "var(--gb-text-secondary)",
                      lineHeight: 1.65,
                      flex: 1,
                      width: "100%",
                    }}
                  >
                    {s.detail}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontFamily: font.body,
                      fontWeight: 600,
                      color: "var(--gb-accent)",
                      marginTop: 14,
                      width: "100%",
                    }}
                  >
                    {s.cta} →
                  </div>
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: isNewUser ? "space-between" : "flex-end",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {isNewUser && (
              <button
                type="button"
                onClick={() => setPage("contacts")}
                style={{
                  background: "var(--gb-accent-bright)",
                  color: "var(--gb-accent-text-on)",
                  border: "1px solid rgba(10,15,9,0.22)",
                  boxShadow: "none",
                  padding: "13px 26px",
                  borderRadius: 11,
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Add your first contact →
              </button>
            )}
            <button
              type="button"
              onClick={dismissTutorialPermanently}
              style={{
                background: "transparent",
                color: "var(--gb-text-subtle)",
                border: "none",
                boxShadow: "none",
                padding: "8px 4px",
                fontFamily: font.body,
                fontSize: 14,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Don&apos;t show again
            </button>
          </div>
        </section>
      )}

      {/* Snapshot stats */}
      <SectionLabel>Your snapshot</SectionLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {stats.map((s) => {
          const tg = tintedCard(s.rgb)
          const cardStyle = {
            ...tg,
            borderRadius: 16,
            padding: "16px 16px 14px",
            position: "relative",
            overflow: "hidden",
            width: "100%",
            textAlign: "left",
            color: "inherit",
            font: "inherit",
            cursor: s.page ? "pointer" : "default",
            boxShadow: "none",
            minHeight: 132,
          }
          const content = (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: `rgba(${s.rgb}, 0.14)`,
                    border: `1px solid rgba(${s.rgb}, 0.24)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  <SnapshotIcon name={s.icon} color={s.color} />
                </span>
                {s.tag && (
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: font.mono,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "4px 8px",
                      borderRadius: 20,
                      color: s.color,
                      background: `rgba(${s.rgb},0.16)`,
                      border: `1px solid rgba(${s.rgb},0.28)`,
                    }}
                  >
                    {s.tag}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: font.h1,
                  fontWeight: 800,
                  fontSize: 34,
                  color: "var(--gb-text)",
                  letterSpacing: "-1px",
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {s.value}
              </div>
              <div style={{ fontFamily: font.h1, fontSize: 13, color: "var(--gb-text-secondary)", marginBottom: 6 }}>{s.label}</div>
              {s.trend && (
                <div style={{ fontSize: 12, fontFamily: font.h1, color: s.color, opacity: 0.9 }}>↗ {s.trend}</div>
              )}
            </>
          )
          return s.page ? (
            <button key={s.label} type="button" onClick={() => setPage(s.page)} style={cardStyle}>
              {content}
            </button>
          ) : (
            <div key={s.label} style={cardStyle}>
              {content}
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <SectionLabel>Quick actions</SectionLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.page}
            type="button"
            onClick={() => setPage(action.page)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 14px",
              borderRadius: 14,
              background: "var(--gb-bg-elevated)",
              border: "1px solid var(--gb-border)",
              cursor: "pointer",
              textAlign: "left",
              color: "inherit",
              font: "inherit",
              boxShadow: "none",
            }}
          >
            <span
              style={{
                fontSize: action.mark.length > 1 ? 20 : 22,
                color: action.markColor,
                flexShrink: 0,
                lineHeight: 1,
              }}
              aria-hidden
            >
              {action.mark}
            </span>
            <span>
              <span style={{ display: "block", fontFamily: font.h1, fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                {action.title}
              </span>
              <span style={{ display: "block", fontFamily: font.h1, fontSize: 12, color: "var(--gb-text-muted)" }}>{action.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Weekly outreach goal */}
      <section
        style={{
          background: "var(--gb-bg-elevated)",
          border: "1px solid var(--gb-border)",
          borderRadius: 16,
          padding: "18px 18px 16px",
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 16 }}>Weekly outreach goal</div>
          <div style={{ fontFamily: font.mono, fontSize: 12, color: "var(--gb-text-muted)" }}>
            {weeklyLogTotal} / {WEEKLY_OUTREACH_GOAL} sent
          </div>
        </div>
        {[
          { label: "Cold outreach", value: outreachBuckets.cold, color: "var(--gb-accent)" },
          { label: "Follow-ups", value: outreachBuckets.followups, color: "var(--gb-danger)" },
          { label: "Referral asks", value: outreachBuckets.referral, color: "#5be4d8" },
        ].map(({ label, value, color }) => {
          const pct = WEEKLY_OUTREACH_GOAL > 0 ? Math.min(100, (value / WEEKLY_OUTREACH_GOAL) * 100) : 0
          return (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "var(--gb-text-secondary)" }}>{label}</span>
                <span style={{ fontFamily: font.mono, color: "var(--gb-text-muted)" }}>{value}</span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 99,
                  background: "var(--gb-surface-muted)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 99,
                    background: color,
                    minWidth: value > 0 ? 8 : 0,
                  }}
                />
              </div>
            </div>
          )
        })}
      </section>

      {/* Recent activity */}
      <SectionLabel>Recent activity</SectionLabel>
      <section
        style={{
          background: "var(--gb-bg-elevated)",
          border: "1px solid var(--gb-border)",
          borderRadius: 16,
          padding: "6px 8px 8px",
          marginBottom: 28,
        }}
      >
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
          activityFeed.slice(0, 8).map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.page)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderTop: idx === 0 ? "none" : "1px solid var(--gb-border-subtle)",
                padding: "14px 10px",
                cursor: "pointer",
                color: "inherit",
                font: "inherit",
                boxShadow: "none",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: item.accent,
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45, color: "var(--gb-text-secondary)" }}>
                {item.title}
                {item.detail ? ` · ${item.detail}` : ""}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: font.mono,
                  fontSize: 11,
                  color: "var(--gb-text-faint)",
                  marginTop: 2,
                }}
              >
                {formatActivityTime(item.ts)}
              </span>
            </button>
          ))
        )}
      </section>

      {/* Recent contacts */}
      <SectionLabel>Recent contacts</SectionLabel>
      <section
        style={{
          background: "var(--gb-bg-elevated)",
          border: "1px solid var(--gb-border)",
          borderRadius: 16,
          padding: "18px 16px 16px",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
            padding: "0 4px",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: "var(--gb-text-faint)", fontFamily: font.mono, lineHeight: 1.4 }}>
            Sorted by latest touch or date added
          </p>
          <button
            type="button"
            onClick={() => setPage("contacts")}
            style={{
              flexShrink: 0,
              background: "var(--gb-surface-muted)",
              border: "1px solid var(--gb-border-strong)",
              color: "var(--gb-text-secondary)",
              fontFamily: font.mono,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            View all
          </button>
        </div>

          {recentContacts.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "32px 24px",
                textAlign: "center",
                borderRadius: 12,
                border: "1px dashed var(--gb-border-strong)",
                background: "var(--gb-surface-hover)",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.45 }}>👋</div>
              <div
                style={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--gb-text-strong)",
                  marginBottom: 8,
                }}
              >
                No contacts saved yet
              </div>
              <p
                style={{
                  margin: "0 0 18px",
                  maxWidth: 320,
                  fontSize: 14,
                  color: "var(--gb-text-muted)",
                  lineHeight: 1.55,
                  fontFamily: font.body,
                }}
              >
                Add someone from a career fair, class, or LinkedIn conversation — then use Compose to reach out.
              </p>
              <button
                type="button"
                onClick={() => setPage("contacts")}
                style={{
                  background: "var(--gb-accent-bright)",
                  color: "var(--gb-accent-text-on)",
                  border: "1px solid rgba(10,15,9,0.22)",
                  boxShadow: "none",
                  padding: "10px 20px",
                  borderRadius: 9,
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Add someone you met →
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentContacts.map((c) => {
                const d = daysSinceLastTouch(c)
                const warm = warmthPill(d)
                const reminderBadge = contactReminderBadge(c, reminders)
                return (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "var(--gb-surface-hover)",
                      border: "1px solid var(--gb-surface-active)",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: "var(--gb-accent-soft)",
                        color: "var(--gb-accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: font.display,
                        fontWeight: 700,
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {c.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, fontFamily: font.display }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "var(--gb-text-faint)", marginBottom: 8, fontFamily: font.body }}>
                        {[c.company, c.role].filter(Boolean).join(" · ") || "No company on file"}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontFamily: font.mono,
                            fontSize: 10,
                            fontWeight: 500,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "4px 10px",
                            borderRadius: 20,
                            color: warm.fg,
                            background: warm.bg,
                            border: `1px solid ${warm.fg}33`,
                          }}
                        >
                          {warm.label}
                        </span>
                        {reminderBadge ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              fontFamily: font.mono,
                              fontSize: 10,
                              fontWeight: 500,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              padding: "4px 10px",
                              borderRadius: 20,
                              color: reminderBadge === "overdue" ? "var(--gb-danger)" : "var(--gb-warning)",
                              background:
                                reminderBadge === "overdue"
                                  ? "rgba(255,107,107,0.1)"
                                  : "rgba(255,201,107,0.1)",
                              border:
                                reminderBadge === "overdue"
                                  ? "1px solid rgba(255,107,107,0.35)"
                                  : "1px solid rgba(255,201,107,0.28)",
                            }}
                          >
                            {reminderBadge === "overdue" ? "Reminder overdue" : "Reminder set"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        textAlign: "right",
                        fontSize: 10,
                        fontFamily: font.mono,
                        color: "var(--gb-text-faint)",
                        maxWidth: 100,
                        lineHeight: 1.4,
                      }}
                    >
                      {c.lastContacted ? (
                        <>
                          Last
                          <br />
                          {new Date(c.lastContacted).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </section>
    </div>
  )
}
