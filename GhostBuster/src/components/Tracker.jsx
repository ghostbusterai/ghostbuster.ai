import React, { useState, useEffect, useMemo } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle } from "../uiStyles"
import { PageShell, PageHero, SectionLabel, ContentCard, CardTitle } from "../layout"

const CHANNELS = ["Email", "LinkedIn", "In-person", "Call", "Other"]
const TOUCHPOINT_HISTORY_PREVIEW = 5

/** Visual encoding for the graphical timeline */
const CHANNEL_TIMELINE = {
  Email: { stroke: "var(--gb-accent)", glow: "rgba(184,255,87,0.5)", fill: "var(--gb-accent-soft)", mark: "✉" },
  LinkedIn: { stroke: "#6eb5ff", glow: "rgba(110,181,255,0.45)", fill: "rgba(110,181,255,0.12)", mark: "in" },
  "In-person": { stroke: "#c4a5ff", glow: "rgba(196,165,255,0.4)", fill: "rgba(196,165,255,0.1)", mark: "◎" },
  Call: { stroke: "#5be4d8", glow: "rgba(91,228,216,0.45)", fill: "rgba(91,228,216,0.12)", mark: "📞" },
  Other: { stroke: "#94a3b8", glow: "rgba(148,163,184,0.35)", fill: "rgba(148,163,184,0.1)", mark: "·" },
}

function timelineChannelMeta(ch) {
  return CHANNEL_TIMELINE[ch] || CHANNEL_TIMELINE.Other
}

function formatTouchDate(ms) {
  if (!ms) return "Unknown date"
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatRelativeTouch(ms) {
  if (!ms) return ""
  const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? "" : "s"} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"} ago`
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? "" : "s"} ago`
}

function daysBetweenTouchpoints(prevMs, nextMs) {
  if (!prevMs || !nextMs) return 0
  return Math.max(0, Math.round((nextMs - prevMs) / (24 * 60 * 60 * 1000)))
}

/** One marker per calendar day so same-day touchpoints never stack overlapping labels. */
function buildTimelineDayMarkers(entries, timelineAxis) {
  if (!timelineAxis || !entries.length) return []

  const { t0, span } = timelineAxis
  const dayMap = new Map()

  for (const entry of entries) {
    const ms = parseDay(entry.contactedAt)
    const dayKey = ms > 0 ? new Date(ms).toDateString() : `unknown-${entry.id}`
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { ms: ms || t0, entries: [] })
    }
    dayMap.get(dayKey).entries.push(entry)
  }

  return [...dayMap.values()]
    .sort((a, b) => a.ms - b.ms)
    .map((group) => {
      const pct = group.ms > 0 ? ((group.ms - t0) / span) * 100 : 0
      const channels = group.entries.map((e) => e.channel || "Other")
      const meta = timelineChannelMeta(group.entries[group.entries.length - 1].channel)
      return {
        ms: group.ms,
        entries: group.entries,
        pct: Math.min(86, Math.max(4, pct)),
        channels,
        meta,
        tip: `${formatTouchDate(group.ms)} · ${channels.join(", ")}`,
      }
    })
}


const LS_LOGS = "gb_outreach_logs"

function parseDay(iso) {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function lastTouchMs(contactId, contact, logs) {
  let max = 0
  for (const l of logs) {
    if (l.contactId !== contactId) continue
    const t = parseDay(l.contactedAt)
    if (t > max) max = t
  }
  if (contact?.lastContacted) {
    const t = parseDay(contact.lastContacted)
    if (t > max) max = t
  }
  return max
}

function countInWindow(logs, contactId, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return logs.filter(
    (l) => l.contactId === contactId && parseDay(l.contactedAt) >= cutoff
  ).length
}

/** Oldest week first (left); each bucket is 7 days ending at `now`. */
function weekTouchFlags(logs, contactId, weeks = 12) {
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const flags = []
  for (let i = weeks - 1; i >= 0; i--) {
    const end = now - i * weekMs
    const start = end - weekMs
    const touched = logs.some(
      (l) =>
        l.contactId === contactId &&
        parseDay(l.contactedAt) >= start &&
        parseDay(l.contactedAt) < end
    )
    flags.push(touched)
  }
  return flags
}

function avgDaysBetweenTouches(logs, contactId) {
  const sorted = logs
    .filter((l) => l.contactId === contactId)
    .map((l) => parseDay(l.contactedAt))
    .filter((t) => t > 0)
    .sort((a, b) => a - b)
  if (sorted.length < 2) return null
  let sum = 0
  for (let i = 1; i < sorted.length; i++) sum += (sorted[i] - sorted[i - 1]) / (24 * 60 * 60 * 1000)
  return Math.round(sum / (sorted.length - 1))
}

const WARMTH_SORT_ORDER = { red: 0, yellow: 1, green: 2, none: 3 }

function sortContactsForTracker(list, logs, sortBy) {
  if (sortBy === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name))
  if (sortBy === "touch") {
    return [...list].sort((a, b) => {
      const la = lastTouchMs(a.id, a, logs)
      const lb = lastTouchMs(b.id, b, logs)
      return la - lb
    })
  }
  return [...list].sort((a, b) => {
    const da = daysSince(lastTouchMs(a.id, a, logs))
    const db = daysSince(lastTouchMs(b.id, b, logs))
    const wa = warmthStatus(da).key
    const wb = warmthStatus(db).key
    const cmp = WARMTH_SORT_ORDER[wa] - WARMTH_SORT_ORDER[wb]
    if (cmp !== 0) return cmp
    return (db === Infinity ? 9999 : db) - (da === Infinity ? 9999 : da)
  })
}

/** green = on track, yellow = due soon, red = overdue, gray = no baseline */
function warmthStatus(daysSince) {
  if (daysSince === Infinity) return { key: "none", label: "No touch logged", color: "#6b7280", bg: "rgba(107,114,128,0.15)" }
  if (daysSince <= 21) return { key: "green", label: "Warm", color: "var(--gb-accent)", bg: "var(--gb-accent-soft)" }
  if (daysSince <= 45) return { key: "yellow", label: "Check in soon", color: "var(--gb-warning)", bg: "rgba(255,201,107,0.12)" }
  return { key: "red", label: "Overdue", color: "var(--gb-danger)", bg: "rgba(255,107,107,0.12)" }
}

function daysSince(ms) {
  if (!ms) return Infinity
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
}

function formatDaysAgo(days) {
  if (days === Infinity) return "never logged"
  if (days === 0) return "today"
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

function formatOutreachWindow(count, windowDays) {
  const label = windowDays === 7 ? "7 days" : windowDays === 30 ? "30 days" : `${windowDays} days`
  const touch = count === 1 ? "touch" : "touches"
  return `${count} ${touch} in last ${label}`
}

function warmthDetail(daysSinceTouch) {
  if (daysSinceTouch === Infinity) return "No outreach logged yet"
  if (daysSinceTouch <= 21) return `Last outreach ${formatDaysAgo(daysSinceTouch)}`
  if (daysSinceTouch <= 45) return `${daysSinceTouch} days since last outreach — time to check in`
  return `${daysSinceTouch} days since last outreach — overdue for a follow-up`
}

export default function Tracker() {
  const [contacts, setContacts] = useState([])
  const [logs, setLogs] = useState([])
  const [filterContactId, setFilterContactId] = useState("")
  const [sortBy, setSortBy] = useState("warmth")
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState(null)

  const [logContactId, setLogContactId] = useState("")
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [logChannel, setLogChannel] = useState(CHANNELS[0])
  const [logNote, setLogNote] = useState("")
  const [savingLog, setSavingLog] = useState(false)

  /** When set, show full-screen timeline for this contact's logged touchpoints */
  const [timelineContactId, setTimelineContactId] = useState(null)
  const [historyView, setHistoryView] = useState("recent")
  const [modalTouchpointView, setModalTouchpointView] = useState("recent")

  async function loadAll() {
    setLoadError(null)
    try {
      const [{ contacts: c }, { logs: lg }] = await Promise.all([
        api.getContacts(),
        api.getOutreachLogs(),
      ])
      setContacts(c)
      setLogs(lg)
      localStorage.setItem(LS_LOGS, JSON.stringify(lg))
    } catch (e) {
      setLoadError(e.message)
      setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
      setLogs(JSON.parse(localStorage.getItem(LS_LOGS) || "[]"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const filteredContacts = useMemo(() => {
    if (!filterContactId) return contacts
    const id = Number(filterContactId)
    return contacts.filter((c) => c.id === id)
  }, [contacts, filterContactId])

  const filteredLogs = useMemo(() => {
    const base = !filterContactId
      ? logs
      : logs.filter((l) => l.contactId === Number(filterContactId))
    return [...base].sort((a, b) => parseDay(b.contactedAt) - parseDay(a.contactedAt))
  }, [logs, filterContactId])

  const visibleHistoryLogs = useMemo(() => {
    if (historyView === "all") return filteredLogs
    return filteredLogs.slice(0, TOUCHPOINT_HISTORY_PREVIEW)
  }, [filteredLogs, historyView])

  const hiddenHistoryCount = Math.max(0, filteredLogs.length - TOUCHPOINT_HISTORY_PREVIEW)

  const sortedFilteredContacts = useMemo(
    () => sortContactsForTracker(filteredContacts, logs, sortBy),
    [filteredContacts, logs, sortBy]
  )

  const filteredSingle = filterContactId && sortedFilteredContacts.length === 1

  const timelineContact = useMemo(
    () => (timelineContactId == null ? null : contacts.find((c) => c.id === timelineContactId) || null),
    [contacts, timelineContactId]
  )

  /** Oldest first for the horizontal axis */
  const timelineEntries = useMemo(() => {
    if (timelineContactId == null) return []
    return logs
      .filter((l) => l.contactId === timelineContactId)
      .sort((a, b) => parseDay(a.contactedAt) - parseDay(b.contactedAt))
  }, [logs, timelineContactId])

  /** Newest first for the readable history list */
  const timelineEntriesNewest = useMemo(() => [...timelineEntries].reverse(), [timelineEntries])

  const visibleModalTouchpoints = useMemo(() => {
    if (modalTouchpointView === "all") return timelineEntriesNewest
    return timelineEntriesNewest.slice(0, TOUCHPOINT_HISTORY_PREVIEW)
  }, [timelineEntriesNewest, modalTouchpointView])

  const hiddenModalTouchpointCount = Math.max(0, timelineEntriesNewest.length - TOUCHPOINT_HISTORY_PREVIEW)

  const timelineSummary = useMemo(() => {
    if (!timelineEntries.length) return null
    const times = timelineEntries.map((e) => parseDay(e.contactedAt)).filter((t) => t > 0)
    const firstMs = times.length ? Math.min(...times) : 0
    const lastMs = times.length ? Math.max(...times) : 0
    return {
      count: timelineEntries.length,
      firstMs,
      lastMs,
      spanDays: firstMs && lastMs ? daysBetweenTouchpoints(firstMs, lastMs) : 0,
    }
  }, [timelineEntries])

  /** For horizontal axis: map real dates to % along the bar */
  const timelineAxis = useMemo(() => {
    if (!timelineEntries.length) return null
    const times = timelineEntries.map((e) => parseDay(e.contactedAt))
    const valid = times.filter((t) => t > 0)
    const t0 = valid.length ? Math.min(...valid) : Date.now() - 86400000
    const t1 = Math.max(Date.now(), ...times.map((t) => t || t0))
    const span = Math.max(t1 - t0, 86400000)
    return { t0, t1, span, now: Date.now() }
  }, [timelineEntries])

  const timelineDayMarkers = useMemo(
    () => (timelineAxis ? buildTimelineDayMarkers(timelineEntries, timelineAxis) : []),
    [timelineEntries, timelineAxis]
  )

  useEffect(() => {
    setHistoryView("recent")
  }, [filterContactId])

  useEffect(() => {
    setModalTouchpointView("recent")
  }, [timelineContactId])

  useEffect(() => {
    if (timelineContactId == null) return
    function onKey(e) {
      if (e.key === "Escape") setTimelineContactId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [timelineContactId])

  useEffect(() => {
    if (timelineContactId == null) return
    if (!contacts.some((c) => c.id === timelineContactId)) setTimelineContactId(null)
  }, [contacts, timelineContactId])

  async function saveLog(e) {
    e.preventDefault()
    if (!logContactId) return
    setActionError(null)
    setSavingLog(true)
    const cid = Number(logContactId)
    try {
      await api.createOutreachLog({
        contactId: cid,
        contactedAt: logDate,
        channel: logChannel,
        note: logNote,
      })
      const [{ contacts: c }, { logs: lg }] = await Promise.all([
        api.getContacts(),
        api.getOutreachLogs(),
      ])
      setContacts(c)
      setLogs(lg)
      localStorage.setItem("gb_contacts", JSON.stringify(c))
      localStorage.setItem(LS_LOGS, JSON.stringify(lg))
      setLogNote("")
    } catch (err) {
      if (loadError) {
        const entry = {
          id: Date.now(),
          contactId: cid,
          contactedAt: logDate,
          channel: logChannel,
          note: logNote,
        }
        const next = [entry, ...logs]
        setLogs(next)
        localStorage.setItem(LS_LOGS, JSON.stringify(next))
        setContacts((prev) =>
          prev.map((c) => {
            if (c.id !== cid) return c
            const prevT = c.lastContacted ? parseDay(c.lastContacted) : 0
            const newT = parseDay(logDate)
            if (newT >= prevT) return { ...c, lastContacted: logDate }
            return c
          })
        )
        setLogNote("")
      } else {
        setActionError(err.message)
      }
    }
    setSavingLog(false)
  }

  async function deleteLog(id) {
    setActionError(null)
    try {
      await api.deleteOutreachLog(id)
      const { logs: lg } = await api.getOutreachLogs()
      setLogs(lg)
      localStorage.setItem(LS_LOGS, JSON.stringify(lg))
    } catch (err) {
      if (loadError) {
        const next = logs.filter((l) => l.id !== id)
        setLogs(next)
        localStorage.setItem(LS_LOGS, JSON.stringify(next))
      } else {
        setActionError(err.message)
      }
    }
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Relationship health"
        title="Tracker"
        subtitle="Who's warm, who needs a nudge. Filter and sort below."
      >
        {loadError && (
          <p style={{ color: "var(--gb-warning)", fontSize: 13, marginTop: 10, marginBottom: 0 }}>
            API offline — using local copy. Run the server to sync across devices.
          </p>
        )}
        {actionError && <p style={{ color: "var(--gb-danger)", fontSize: 13, marginTop: 8, marginBottom: 0 }}>{actionError}</p>}
      </PageHero>

      {/* Warmth legend */}
      <SectionLabel>How warmth works</SectionLabel>
      <ContentCard
        style={{
          background: "var(--gb-bg-elevated)",
          border: "1px solid var(--gb-border)",
        }}
        padding="16px 18px"
        marginBottom={20}
      >
        <CardTitle>How warmth works</CardTitle>
        <p style={{ fontSize: 13, color: "var(--gb-text-muted)", margin: "0 0 14px", lineHeight: 1.5, fontFamily: font.body }}>
          Each contact gets a color based on how long it&apos;s been since you last logged outreach with them.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[
            { c: "var(--gb-accent)", label: "Warm", detail: "Last touch within 21 days" },
            { c: "#ffc96b", label: "Check in soon", detail: "22–45 days since last touch" },
            { c: "var(--gb-danger)", label: "Overdue", detail: "More than 45 days since last touch" },
            { c: "#6b7280", label: "No touch logged", detail: "No outreach recorded yet" },
          ].map((x) => (
            <span
              key={x.label}
              style={{
                display: "inline-flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 12,
                color: "var(--gb-text-secondary)",
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--gb-surface-hover)",
                maxWidth: 220,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: x.c,
                  marginTop: 3,
                  flexShrink: 0,
                }}
              />
              <span>
                <strong style={{ color: "var(--gb-text)" }}>{x.label}</strong>
                <span style={{ display: "block", color: "var(--gb-text-faint)", marginTop: 2, lineHeight: 1.35 }}>
                  {x.detail}
                </span>
              </span>
            </span>
          ))}
        </div>
      </ContentCard>

      {/* Filter + sort */}
      <SectionLabel>Filter & sort</SectionLabel>
      <ContentCard padding="18px 18px 14px" marginBottom={20}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)" }}>CONTACT</label>
          <select
            value={filterContactId}
            onChange={(e) => setFilterContactId(e.target.value)}
            style={{ ...inputStyle(), maxWidth: 320 }}
          >
            <option value="">All contacts</option>
            {contacts.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
                {c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)" }}>SORT</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle(), maxWidth: 280 }}>
            <option value="warmth">Warmth — needs attention first</option>
            <option value="touch">Last touch — oldest first</option>
            <option value="name">Name — A to Z</option>
          </select>
        </div>
      </div>
      </ContentCard>

      {filteredSingle && sortedFilteredContacts[0] && (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: 12,
            background: "var(--gb-accent-soft)",
            border: "1px solid var(--gb-border-subtle)",
            fontSize: 14,
            color: "var(--gb-text-secondary)",
          }}
        >
          <strong style={{ color: "var(--gb-text)" }}>{sortedFilteredContacts[0].name}</strong> only
        </div>
      )}

      {/* Log touchpoint */}
      <SectionLabel>Log outreach</SectionLabel>
      <ContentCard
        style={{
          border: "1px solid var(--gb-border-subtle)",
        }}
        padding="24px"
        marginBottom={28}
      >
        <CardTitle>Log outreach</CardTitle>
        <form onSubmit={saveLog} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <select value={logContactId} onChange={(e) => setLogContactId(e.target.value)} style={inputStyle()} required>
            <option value="">Contact *</option>
            {contacts.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} style={inputStyle()} required />
          <select value={logChannel} onChange={(e) => setLogChannel(e.target.value)} style={inputStyle()}>
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
          <input
            placeholder="Short note (optional)"
            value={logNote}
            onChange={(e) => setLogNote(e.target.value)}
            style={inputStyle()}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <button
              type="submit"
              disabled={!logContactId || savingLog}
              style={{
                background: logContactId && !savingLog ? "var(--gb-accent-bright)" : "var(--gb-accent-soft)",
                color: logContactId && !savingLog ? "var(--gb-accent-text-on)" : "var(--gb-accent-muted)",
                border:
                  logContactId && !savingLog ? "1px solid rgba(10,15,9,0.22)" : "1px solid var(--gb-border-subtle)",
                boxShadow: "none",
                padding: "10px 22px",
                borderRadius: 9,
                fontWeight: 700,
                cursor: logContactId && !savingLog ? "pointer" : "not-allowed",
              }}
            >
              {savingLog ? "Saving…" : "Add touchpoint"}
            </button>
          </div>
        </form>
      </ContentCard>

      {/* Per-contact warmth */}
      <SectionLabel>Connection warmth</SectionLabel>
      <p style={{ fontSize: 13, color: "var(--gb-text-faint)", margin: "0 0 14px", lineHeight: 1.5, fontFamily: font.body }}>
        Click a contact to open their full outreach timeline. The bar chart shows whether you logged outreach each
        week for the past 12 weeks.
      </p>
      {loading ? (
        <div style={{ color: "var(--gb-text-faint)" }}>Loading…</div>
      ) : sortedFilteredContacts.length === 0 ? (
        <div
          style={{
            background: "var(--gb-bg-elevated)",
            border: "1px solid var(--gb-surface-active)",
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
            color: "var(--gb-text-faint)",
          }}
        >
          {contacts.length === 0 ? "Add contacts first, then log outreach here." : "No contacts match this filter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sortedFilteredContacts.map((c) => {
            const lastMs = lastTouchMs(c.id, c, logs)
            const d = daysSince(lastMs)
            const w = warmthStatus(d)
            const n7 = countInWindow(logs, c.id, 7)
            const n30 = countInWindow(logs, c.id, 30)
            const n90 = countInWindow(logs, c.id, 90)
            const avgGap = avgDaysBetweenTouches(logs, c.id)
            const weeks = weekTouchFlags(logs, c.id, 12)
            return (
              <div
                key={c.id}
                style={{
                  background: "var(--gb-bg-elevated)",
                  border: `1px solid ${w.key === "yellow" ? "rgba(255,201,107,0.25)" : w.key === "red" ? "rgba(255,107,107,0.25)" : "var(--gb-surface-active)"}`,
                  borderRadius: 14,
                  padding: "18px 20px",
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setTimelineContactId(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setTimelineContactId(c.id)
                    }
                  }}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    flex: 1,
                    minWidth: 200,
                    cursor: "pointer",
                    borderRadius: 10,
                    margin: "-6px",
                    padding: "6px",
                    outline: "none",
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: w.color,
                      marginTop: 4,
                      boxShadow: `0 0 12px ${w.color}66`,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: font.mono,
                        color: "var(--gb-accent-muted)",
                        marginTop: 4,
                        letterSpacing: 0.3,
                      }}
                    >
                      View outreach history →
                    </div>
                    <div style={{ fontSize: 13, color: "var(--gb-text-muted)", marginTop: 2, fontFamily: font.body }}>
                      {[c.role, c.company].filter(Boolean).join(" @ ")}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--gb-text-subtle)", marginTop: 10, fontFamily: font.body, lineHeight: 1.5 }}>
                      {lastMs
                        ? `Last outreach: ${new Date(lastMs).toLocaleDateString()} (${formatDaysAgo(d)})`
                        : "Last outreach: none logged yet"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--gb-text-faint)", marginTop: 4, fontFamily: font.body, lineHeight: 1.5 }}>
                      {formatOutreachWindow(n7, 7)} · {formatOutreachWindow(n30, 30)} · {formatOutreachWindow(n90, 90)}
                      {avgGap != null && ` · about ${avgGap} days between touches on average`}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: font.mono,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--gb-text-faint)",
                          marginBottom: 6,
                        }}
                      >
                        Outreach rhythm — last 12 weeks
                      </div>
                      <div
                        title="Each bar is one week. Bright = at least one logged touch that week."
                        style={{
                          display: "flex",
                          gap: 4,
                          maxWidth: 420,
                          alignItems: "stretch",
                        }}
                      >
                        {weeks.map((on, i) => (
                          <div
                            key={i}
                            title={on ? "Outreach logged this week" : "No outreach logged this week"}
                            style={{
                              flex: 1,
                              height: 22,
                              borderRadius: 4,
                              background: on ? "var(--gb-accent-muted)" : "var(--gb-surface-active)",
                              border: on ? "1px solid var(--gb-border-strong)" : "1px solid var(--gb-surface-active)",
                            }}
                          />
                        ))}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          maxWidth: 420,
                          fontSize: 10,
                          color: "var(--gb-text-dim)",
                          marginTop: 4,
                          fontFamily: font.mono,
                        }}
                      >
                        <span>12 weeks ago</span>
                        <span>This week</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--gb-text-faint)", marginTop: 4, fontFamily: font.body }}>
                        Bright bar = you logged outreach that week. Dim bar = no logged outreach.
                      </div>
                    </div>
                    <div
                      style={{
                        display: "inline-block",
                        marginTop: 10,
                        padding: "5px 11px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontFamily: font.body,
                        color: w.color,
                        background: w.bg,
                        lineHeight: 1.4,
                      }}
                    >
                      <strong>{w.label}</strong>
                      <span style={{ color: "var(--gb-text-subtle)", fontWeight: 400 }}> · {warmthDetail(d)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent logs table */}
      <SectionLabel style={{ marginTop: 26 }}>Touchpoint history</SectionLabel>
      <div
        style={{
          margin: "0 0 14px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <p style={{ fontSize: 13, color: "var(--gb-text-faint)", margin: 0, lineHeight: 1.5, fontFamily: font.body, flex: "1 1 240px" }}>
          A log of every outreach you record above. Newest first — click a row to open that contact&apos;s timeline.
        </p>
        {filteredLogs.length > TOUCHPOINT_HISTORY_PREVIEW && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: font.h1,
              fontSize: 12,
              color: "var(--gb-text-muted)",
              flexShrink: 0,
            }}
          >
            Show
            <select
              value={historyView}
              onChange={(e) => setHistoryView(e.target.value)}
              style={{
                ...inputStyle,
                width: "auto",
                minWidth: 132,
                padding: "8px 10px",
                fontSize: 12,
                fontFamily: font.h1,
                cursor: "pointer",
              }}
            >
              <option value="recent">Recent {TOUCHPOINT_HISTORY_PREVIEW}</option>
              <option value="all">All ({filteredLogs.length})</option>
            </select>
          </label>
        )}
      </div>
      {filteredLogs.length === 0 ? (
        <div style={{ color: "var(--gb-text-faint)", fontSize: 14 }}>No logs yet — add one above.</div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--gb-surface-active)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--gb-surface-hover)", textAlign: "left" }}>
                <th style={{ padding: 12, fontFamily: font.mono, color: "var(--gb-text-muted)" }}>When</th>
                <th style={{ padding: 12, fontFamily: font.mono, color: "var(--gb-text-muted)" }}>Contact</th>
                <th style={{ padding: 12, fontFamily: font.mono, color: "var(--gb-text-muted)" }}>How you reached out</th>
                <th style={{ padding: 12, fontFamily: font.mono, color: "var(--gb-text-muted)" }}>Notes</th>
                <th style={{ padding: 12 }} />
              </tr>
            </thead>
            <tbody>
              {visibleHistoryLogs.map((l) => {
                const person = contacts.find((x) => x.id === l.contactId)
                return (
                  <tr
                    key={l.id}
                    onClick={() => setTimelineContactId(l.contactId)}
                    style={{
                      borderTop: "1px solid var(--gb-surface-active)",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--gb-surface-hover)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    <td style={{ padding: 12, fontFamily: font.mono, color: "var(--gb-text-secondary)" }}>
                      {l.contactedAt}
                    </td>
                    <td style={{ padding: 12 }}>{person?.name || "—"}</td>
                    <td style={{ padding: 12, color: "var(--gb-text-subtle)" }}>{l.channel || "—"}</td>
                    <td style={{ padding: 12, color: "var(--gb-text-muted)", maxWidth: 280 }}>{l.note || "—"}</td>
                    <td style={{ padding: 12 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => deleteLog(l.id)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,107,107,0.3)",
                          color: "var(--gb-danger)",
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {historyView === "recent" && hiddenHistoryCount > 0 && (
            <div
              style={{
                padding: "12px 14px",
                borderTop: "1px solid var(--gb-border-subtle)",
                background: "var(--gb-surface-hover)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontFamily: font.h1, fontSize: 12, color: "var(--gb-text-muted)" }}>
                Showing the {TOUCHPOINT_HISTORY_PREVIEW} most recent touchpoints
              </span>
              <button
                type="button"
                onClick={() => setHistoryView("all")}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--gb-border)",
                  background: "var(--gb-bg-elevated)",
                  color: "var(--gb-text)",
                  fontFamily: font.h1,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Show {hiddenHistoryCount} more
              </button>
            </div>
          )}
        </div>
      )}

      {timelineContact && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeline-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(6,6,10,0.82)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setTimelineContactId(null)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              maxHeight: "min(88vh, 760px)",
              background: "var(--gb-bg-elevated)",
              border: "1px solid var(--gb-border-strong)",
              borderRadius: 18,
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "22px 24px 18px",
                borderBottom: "1px solid var(--gb-border-subtle)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: font.h1,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--gb-text-muted)",
                    marginBottom: 8,
                  }}
                >
                  Outreach history
                </div>
                <h2
                  id="timeline-title"
                  style={{
                    fontFamily: font.h2,
                    fontWeight: 800,
                    fontSize: 24,
                    margin: 0,
                    letterSpacing: "-0.5px",
                  }}
                >
                  {timelineContact.name}
                </h2>
                {(timelineContact.role || timelineContact.company) && (
                  <div style={{ fontFamily: font.h1, fontSize: 14, color: "var(--gb-text-secondary)", marginTop: 6 }}>
                    {[timelineContact.role, timelineContact.company].filter(Boolean).join(" · ")}
                  </div>
                )}
                {timelineContact.notes ? (
                  <div
                    style={{
                      marginTop: 14,
                      fontSize: 13,
                      color: "var(--gb-text-secondary)",
                      lineHeight: 1.55,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "var(--gb-surface-hover)",
                      border: "1px solid var(--gb-border-subtle)",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: font.h1,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--gb-text-muted)",
                        marginBottom: 4,
                      }}
                    >
                      How you met
                    </div>
                    {timelineContact.notes}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setTimelineContactId(null)}
                aria-label="Close timeline"
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid var(--gb-border)",
                  background: "var(--gb-surface-muted)",
                  color: "var(--gb-text)",
                  fontSize: 20,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "16px 24px 24px", overflowY: "auto", flex: 1 }}>
              {timelineEntries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--gb-text-muted)", fontSize: 14, fontFamily: font.h1, lineHeight: 1.6 }}>
                  No outreach logged yet. Use <strong style={{ color: "var(--gb-text)" }}>Log outreach</strong> on the Tracker page
                  to record when you reach out — it will show up here.
                </div>
              ) : (
                <>
                  {timelineSummary && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: 10,
                        marginBottom: 22,
                      }}
                    >
                      {[
                        {
                          label: "Touchpoints",
                          value: `${timelineSummary.count}`,
                        },
                        {
                          label: "Last contact",
                          value: timelineSummary.lastMs ? formatRelativeTouch(timelineSummary.lastMs) : "—",
                        },
                        {
                          label: timelineSummary.count > 1 ? "Relationship span" : "First logged",
                          value:
                            timelineSummary.count > 1 && timelineSummary.spanDays > 0
                              ? `${timelineSummary.spanDays} day${timelineSummary.spanDays === 1 ? "" : "s"}`
                              : timelineSummary.firstMs
                                ? formatTouchDate(timelineSummary.firstMs)
                                : "—",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 12,
                            background: "var(--gb-surface-muted)",
                            border: "1px solid var(--gb-border-subtle)",
                          }}
                        >
                          <div style={{ fontFamily: font.h1, fontSize: 11, color: "var(--gb-text-muted)", marginBottom: 4 }}>
                            {item.label}
                          </div>
                          <div style={{ fontFamily: font.h1, fontSize: 16, fontWeight: 700, color: "var(--gb-text)" }}>
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {timelineAxis && timelineEntries.length >= 2 && (
                    <div
                      style={{
                        marginBottom: 24,
                        padding: "16px 14px",
                        borderRadius: 14,
                        background: "var(--gb-surface-muted)",
                        border: "1px solid var(--gb-border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: font.h1,
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--gb-text)",
                          marginBottom: 4,
                        }}
                      >
                        Relationship over time
                      </div>
                      <div style={{ fontFamily: font.h1, fontSize: 12, color: "var(--gb-text-muted)", marginBottom: 14 }}>
                        Each dot is one day you logged outreach. Hover a dot to see how you reached out. Left is earliest, right is today.
                      </div>
                      <div style={{ position: "relative", height: 36, marginTop: 4, paddingRight: 32, marginBottom: 8 }}>
                        <div
                          style={{
                            position: "absolute",
                            left: 8,
                            right: 32,
                            top: 16,
                            height: 4,
                            borderRadius: 4,
                            background: "var(--gb-border-subtle)",
                          }}
                        />
                        <div
                          title="Today"
                          aria-hidden
                          style={{
                            position: "absolute",
                            right: 28,
                            top: 10,
                            width: 2,
                            height: 16,
                            borderRadius: 2,
                            background: "var(--gb-text-muted)",
                          }}
                        />
                        {timelineDayMarkers.map((marker) => (
                          <div
                            key={marker.ms}
                            title={marker.tip}
                            style={{
                              position: "absolute",
                              left: `calc(8px + (100% - 40px) * ${marker.pct / 100})`,
                              top: 8,
                              transform: "translateX(-50%)",
                              width: 18,
                              height: 18,
                            }}
                          >
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                background: marker.meta.fill,
                                border: `2px solid ${marker.meta.stroke}`,
                                boxShadow: `0 0 10px ${marker.meta.glow}`,
                              }}
                            />
                            {marker.entries.length > 1 && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: -5,
                                  right: -7,
                                  minWidth: 16,
                                  height: 16,
                                  padding: "0 4px",
                                  borderRadius: 999,
                                  background: "var(--gb-bg-elevated)",
                                  border: "1px solid var(--gb-border)",
                                  color: "var(--gb-text)",
                                  fontFamily: font.h1,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  lineHeight: "14px",
                                  textAlign: "center",
                                }}
                              >
                                {marker.entries.length}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 16,
                          fontSize: 11,
                          fontFamily: font.h1,
                          color: "var(--gb-text-muted)",
                        }}
                      >
                        <span style={{ minWidth: 0 }}>{formatTouchDate(timelineAxis.t0)}</span>
                        <span style={{ flexShrink: 0 }}>Today</span>
                      </div>
                      {timelineDayMarkers.some((m) => m.entries.length > 1) && (
                        <div style={{ fontFamily: font.h1, fontSize: 11, color: "var(--gb-text-muted)", marginTop: 10 }}>
                          Number badges show multiple touchpoints logged on the same day.
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontFamily: font.h1,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--gb-text)",
                      }}
                    >
                      Touchpoints
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 4,
                      }}
                    >
                      <div style={{ fontFamily: font.h1, fontSize: 12, color: "var(--gb-text-muted)" }}>
                        Newest first
                      </div>
                    {timelineEntriesNewest.length > TOUCHPOINT_HISTORY_PREVIEW && (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontFamily: font.h1,
                          fontSize: 12,
                          color: "var(--gb-text-muted)",
                        }}
                      >
                        Show
                        <select
                          value={modalTouchpointView}
                          onChange={(e) => setModalTouchpointView(e.target.value)}
                          style={{
                            ...inputStyle,
                            width: "auto",
                            minWidth: 132,
                            padding: "8px 10px",
                            fontSize: 12,
                            fontFamily: font.h1,
                            cursor: "pointer",
                          }}
                        >
                          <option value="recent">Recent {TOUCHPOINT_HISTORY_PREVIEW}</option>
                          <option value="all">All ({timelineEntriesNewest.length})</option>
                        </select>
                      </label>
                    )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {visibleModalTouchpoints.map((entry, idx) => {
                      const d = parseDay(entry.contactedAt)
                      const meta = timelineChannelMeta(entry.channel)
                      const olderEntry = visibleModalTouchpoints[idx + 1]
                      const olderMs = olderEntry ? parseDay(olderEntry.contactedAt) : 0
                      const gapDays = olderMs && d ? daysBetweenTouchpoints(olderMs, d) : 0

                      return (
                        <div key={entry.id}>
                          {gapDays >= 7 && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                margin: "0 0 10px 12px",
                                fontFamily: font.h1,
                                fontSize: 11,
                                color: "var(--gb-text-muted)",
                              }}
                            >
                              <span style={{ flex: 1, height: 1, background: "var(--gb-border-subtle)" }} />
                              <span>{gapDays} days later</span>
                              <span style={{ flex: 1, height: 1, background: "var(--gb-border-subtle)" }} />
                            </div>
                          )}
                          <div
                            style={{
                              padding: "14px 16px",
                              borderRadius: 14,
                              background: "var(--gb-bg-panel)",
                              border: "1px solid var(--gb-border-subtle)",
                              borderLeft: `4px solid ${meta.stroke}`,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontFamily: font.h1, fontSize: 15, fontWeight: 700, color: "var(--gb-text)" }}>
                                  {formatTouchDate(d)}
                                </div>
                                {d > 0 && (
                                  <div style={{ fontFamily: font.h1, fontSize: 12, color: "var(--gb-text-muted)", marginTop: 2 }}>
                                    {formatRelativeTouch(d)}
                                  </div>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontFamily: font.h1,
                                  fontWeight: 600,
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  background: meta.fill,
                                  color: meta.stroke,
                                  border: `1px solid ${meta.stroke}44`,
                                }}
                              >
                                {entry.channel || "Other"}
                              </span>
                            </div>
                            <div
                              style={{
                                marginTop: 12,
                                fontSize: 14,
                                lineHeight: 1.6,
                                fontFamily: font.h1,
                                color: entry.note ? "var(--gb-text-secondary)" : "var(--gb-text-muted)",
                                fontStyle: entry.note ? "normal" : "italic",
                              }}
                            >
                              {entry.note?.trim()
                                ? entry.note
                                : "No notes for this touchpoint. Add context when logging outreach so you remember what you discussed."}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {modalTouchpointView === "recent" && hiddenModalTouchpointCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setModalTouchpointView("all")}
                      style={{
                        width: "100%",
                        marginTop: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid var(--gb-border)",
                        background: "var(--gb-surface-muted)",
                        color: "var(--gb-text)",
                        fontFamily: font.h1,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Show {hiddenModalTouchpointCount} more touchpoint{hiddenModalTouchpointCount === 1 ? "" : "s"}
                    </button>
                  )}
                </>
              )}
            </div>
            <div
              style={{
                padding: "12px 24px",
                borderTop: "1px solid var(--gb-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 12, fontFamily: font.h1, color: "var(--gb-text-muted)" }}>
                {timelineEntries.length} touchpoint{timelineEntries.length !== 1 ? "s" : ""} logged
              </span>
              <button
                type="button"
                onClick={() => setTimelineContactId(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--gb-border)",
                  background: "var(--gb-surface-muted)",
                  color: "var(--gb-text)",
                  fontFamily: font.h1,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
