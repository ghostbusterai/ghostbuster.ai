import React, { useState, useEffect, useMemo, useRef } from "react"
import { api } from "../api"
import { font } from "../theme"
import { dangerBtn, inputStyle, primaryBtn, secondaryBtn, uiClass } from "../uiStyles"
import { PageShell, PageHero, ContentCard, CardTitle, EmptyState } from "../layout"
import ViewMoreButton from "./ViewMoreButton"
import { LIST_PREVIEW_LIMIT, previewHiddenCount, previewSlice } from "../listPreview"

const CHANNELS = ["Email", "LinkedIn", "In-person", "Call", "Other"]

/** Visual encoding for the graphical timeline */
const CHANNEL_TIMELINE = {
  Email: { stroke: "var(--gb-accent)", glow: "rgba(157,206,92,0.35)", fill: "var(--gb-accent-soft)" },
  LinkedIn: { stroke: "#6eb5ff", glow: "rgba(110,181,255,0.35)", fill: "rgba(110,181,255,0.1)" },
  "In-person": { stroke: "#c4a5ff", glow: "rgba(196,165,255,0.3)", fill: "rgba(196,165,255,0.08)" },
  Call: { stroke: "#5be4d8", glow: "rgba(91,228,216,0.32)", fill: "rgba(91,228,216,0.1)" },
  Other: { stroke: "#94a3b8", glow: "rgba(148,163,184,0.28)", fill: "rgba(148,163,184,0.08)" },
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

function formatWeekRange(startMs, endMs) {
  const opts = { month: "short", day: "numeric" }
  return `${new Date(startMs).toLocaleDateString(undefined, opts)} – ${new Date(endMs).toLocaleDateString(undefined, opts)}`
}

/** Oldest week first (left); each bucket is 7 days ending at `now`. */
function weekTouchBuckets(logs, contactId, weeks = 12) {
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const buckets = []
  for (let i = weeks - 1; i >= 0; i--) {
    const end = now - i * weekMs
    const start = end - weekMs
    const hits = logs.filter(
      (l) => l.contactId === contactId && parseDay(l.contactedAt) >= start && parseDay(l.contactedAt) < end
    )
    buckets.push({
      active: hits.length > 0,
      count: hits.length,
      start,
      end: end - 1,
      edgeLabel: null,
    })
  }
  if (buckets.length > 0) {
    buckets[0].edgeLabel = "12 wk"
    buckets[buckets.length - 1].edgeLabel = "Now"
  }
  return buckets
}

function weekTouchTitle(bucket) {
  const range = formatWeekRange(bucket.start, bucket.end)
  if (!bucket.active) return `${range} · No touches`
  return `${range} · ${bucket.count} touch${bucket.count !== 1 ? "es" : ""}`
}

function TrackerRhythmChart({ buckets, compact = false }) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count))
  return (
    <div className={`gb-tracker-rhythm${compact ? " gb-tracker-rhythm--compact" : ""}`}>
      <div className="gb-tracker-rhythm__header">
        <span className="gb-tracker-rhythm__title">12-week rhythm</span>
        <span className="gb-tracker-rhythm__hint">Hover a bar for that week</span>
      </div>
      <div
        className="gb-tracker-rhythm__bars"
        role="img"
        aria-label="Weekly outreach: each bar is one week, left is oldest, right is this week"
      >
        {buckets.map((b, i) => {
          const heightPct = b.active ? Math.max(32, Math.round((b.count / maxCount) * 100)) : 16
          return (
            <div key={i} className="gb-tracker-rhythm__col" title={weekTouchTitle(b)}>
              <div
                className={`gb-tracker-rhythm__bar${b.active ? " gb-tracker-rhythm__bar--on" : ""}`}
                style={{ height: `${heightPct}%` }}
              />
              <span className="gb-tracker-rhythm__edge">{b.edgeLabel || "\u00a0"}</span>
            </div>
          )
        })}
      </div>
      <div className="gb-tracker-rhythm__axis">
        <span>Older weeks</span>
        <span>This week</span>
      </div>
    </div>
  )
}

function ChannelLegend() {
  return (
    <div className="gb-channel-legend" aria-label="Colors by outreach channel">
      {Object.keys(CHANNEL_TIMELINE).map((ch) => {
        const meta = CHANNEL_TIMELINE[ch]
        return (
          <span key={ch} className="gb-channel-legend__item">
            <span className="gb-channel-legend__swatch" style={{ background: meta.stroke }} aria-hidden />
            {ch}
          </span>
        )
      })}
    </div>
  )
}

function TimelineRelationshipChart({ markers, axis }) {
  if (!axis || !markers.length) return null
  return (
    <div className="gb-timeline-viz">
      <h3 className="gb-timeline-viz__title">Relationship over time</h3>
      <p className="gb-timeline-viz__lede">
        Each dot is a day you logged outreach. Colors match how you reached out (see legend below).
      </p>
      <div className="gb-timeline-viz__track">
        <div className="gb-timeline-viz__line" aria-hidden />
        <span className="gb-timeline-viz__today" title="Today" aria-hidden />
        <span className="gb-timeline-viz__today-label">Today</span>
        {markers.map((marker) => (
          <div
            key={marker.ms}
            className="gb-timeline-viz__dot-wrap"
            style={{ left: `calc(8px + (100% - 36px) * ${marker.pct / 100})` }}
            title={marker.tip}
          >
            <div
              className="gb-timeline-viz__dot"
              style={{
                background: marker.meta.fill,
                borderColor: marker.meta.stroke,
                boxShadow: `0 0 14px ${marker.meta.glow}`,
              }}
            />
            {marker.entries.length > 1 ? (
              <span className="gb-timeline-viz__dot-count">{marker.entries.length}</span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="gb-timeline-viz__axis">
        <span>{formatTouchDate(axis.t0)}</span>
        <span>Today</span>
      </div>
      <ChannelLegend />
    </div>
  )
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

function warmthDetail(daysSinceTouch) {
  if (daysSinceTouch === Infinity) return "No outreach logged yet"
  if (daysSinceTouch <= 21) return `Last outreach ${formatDaysAgo(daysSinceTouch)}`
  if (daysSinceTouch <= 45) return `${daysSinceTouch} days since last outreach. Time to check in`
  return `${daysSinceTouch} days since last outreach. Overdue for a follow-up`
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
  const [logPanelOpen, setLogPanelOpen] = useState(false)
  const logAreaRef = useRef(null)

  // Clicking anywhere outside the Log touchpoint window closes it (what you typed is kept).
  useEffect(() => {
    if (!logPanelOpen) return
    const onPointerDown = (e) => {
      if (logAreaRef.current?.contains(e.target)) return
      if (e.target.closest?.("[role='dialog']")) return // other floating windows
      setLogPanelOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [logPanelOpen])
  const [savingLog, setSavingLog] = useState(false)

  /** When set, show full-screen timeline for this contact's logged touchpoints */
  const [timelineContactId, setTimelineContactId] = useState(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [showAllModalTouchpoints, setShowAllModalTouchpoints] = useState(false)

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

  const visibleHistoryLogs = useMemo(
    () => previewSlice(filteredLogs, showAllHistory, LIST_PREVIEW_LIMIT),
    [filteredLogs, showAllHistory]
  )

  const hiddenHistoryCount = previewHiddenCount(filteredLogs, showAllHistory, LIST_PREVIEW_LIMIT)

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

  const visibleModalTouchpoints = useMemo(
    () => previewSlice(timelineEntriesNewest, showAllModalTouchpoints, LIST_PREVIEW_LIMIT),
    [timelineEntriesNewest, showAllModalTouchpoints]
  )

  const hiddenModalTouchpointCount = previewHiddenCount(
    timelineEntriesNewest,
    showAllModalTouchpoints,
    LIST_PREVIEW_LIMIT
  )

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
    setShowAllHistory(false)
  }, [filterContactId])

  useEffect(() => {
    setShowAllModalTouchpoints(false)
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
      setLogPanelOpen(false)
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
        setLogPanelOpen(false)
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
      <div style={{ paddingBottom: 88 }}>
      <PageHero
        eyebrow="Relationship health"
        title="Tracker"
        subtitle="Who's warm, who needs a nudge. Filter and sort below. Log outreach from the button in the corner."
      >
        {loadError && (
          <p style={{ color: "var(--gb-warning)", fontSize: 13, marginTop: 10, marginBottom: 0 }}>
            API offline. Using local copy. Run the server to sync across devices.
          </p>
        )}
        {actionError && <p style={{ color: "var(--gb-danger)", fontSize: 13, marginTop: 8, marginBottom: 0 }}>{actionError}</p>}
      </PageHero>

      {/* Filter + sort */}
      <ContentCard padding="18px 18px 14px" marginBottom={20}>
        <CardTitle style={{ marginBottom: 14 }}>Filter & sort</CardTitle>
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
                {c.company ? ` · ${c.company}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)" }}>SORT</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle(), maxWidth: 280 }}>
            <option value="warmth">Warmth: needs attention first</option>
            <option value="touch">Last touch: oldest first</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>
      </div>
      </ContentCard>

      {filteredSingle && sortedFilteredContacts[0] && (
        <div className="gb-filter-banner">
          <strong>{sortedFilteredContacts[0].name}</strong> only
        </div>
      )}

      {/* Per-contact warmth */}
      <section className="gb-reveal-block" aria-labelledby="tracker-warmth-title">
        <CardTitle helper="Open a contact for the full timeline. Taller bars mean more logged touches that week — hover any bar for the exact dates.">
          <span id="tracker-warmth-title">Connection warmth</span>
        </CardTitle>
      <div className="gb-legend-grid gb-reveal-stagger">
        {[
          { c: "var(--gb-accent)", label: "Warm", detail: "Last touch within 21 days" },
          { c: "#ffc96b", label: "Check in soon", detail: "22–45 days since last touch" },
          { c: "var(--gb-danger)", label: "Overdue", detail: "More than 45 days since last touch" },
          { c: "#6b7280", label: "No touch logged", detail: "No outreach recorded yet" },
        ].map((x) => (
          <span key={x.label} className="gb-legend-chip">
            <span className="gb-legend-chip__dot" style={{ background: x.c }} />
            <span>
              <strong>{x.label}</strong>
              <span className="gb-legend-chip__detail">{x.detail}</span>
            </span>
          </span>
        ))}
      </div>
      {loading ? (
        <div style={{ color: "var(--gb-text-faint)" }}>Loading…</div>
      ) : sortedFilteredContacts.length === 0 ? (
        <EmptyState
          title="Nothing to track yet"
          lede={
            contacts.length === 0
              ? "Add contacts first, then log outreach from the corner compose button."
              : "No contacts match this filter."
          }
        />
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
            const rhythmBuckets = weekTouchBuckets(logs, c.id, 12)
            const cardWarmthClass =
              w.key === "yellow"
                ? " gb-tracker-card--yellow"
                : w.key === "red"
                  ? " gb-tracker-card--red"
                  : w.key === "green"
                    ? " gb-tracker-card--green"
                    : ""
            return (
              <div key={c.id} className={`gb-reveal-block gb-tracker-card${cardWarmthClass}`}>
                <button
                  type="button"
                  className="gb-tracker-card__open"
                  onClick={() => setTimelineContactId(c.id)}
                >
                  <div className="gb-tracker-card__top">
                    <span
                      className="gb-tracker-card__dot"
                      style={{ background: w.color, color: w.color }}
                      aria-hidden
                    />
                    <div className="gb-tracker-card__head">
                      <div>
                        <h3 className="gb-tracker-card__name">{c.name}</h3>
                        {[c.role, c.company].filter(Boolean).length > 0 ? (
                          <p className="gb-tracker-card__sub">{[c.role, c.company].filter(Boolean).join(" @ ")}</p>
                        ) : null}
                        <p className="gb-tracker-card__cta">View outreach history →</p>
                      </div>
                      <span className="gb-tracker-warmth-pill" data-warmth={w.key}>
                        {w.label}
                      </span>
                    </div>
                  </div>
                  <div className="gb-tracker-metrics" aria-label="Touches in rolling windows">
                    <div className="gb-tracker-metric">
                      <span className="gb-tracker-metric__val">{n7}</span>
                      <span className="gb-tracker-metric__lbl">7 days</span>
                    </div>
                    <div className="gb-tracker-metric">
                      <span className="gb-tracker-metric__val">{n30}</span>
                      <span className="gb-tracker-metric__lbl">30 days</span>
                    </div>
                    <div className="gb-tracker-metric">
                      <span className="gb-tracker-metric__val">{n90}</span>
                      <span className="gb-tracker-metric__lbl">90 days</span>
                    </div>
                  </div>
                  <p className="gb-tracker-card__detail">
                    {lastMs
                      ? `Last outreach ${new Date(lastMs).toLocaleDateString()} (${formatDaysAgo(d)}). ${warmthDetail(d)}`
                      : warmthDetail(d)}
                    {avgGap != null ? ` Typical gap between touches: ~${avgGap} days.` : ""}
                  </p>
                  <TrackerRhythmChart buckets={rhythmBuckets} />
                </button>
              </div>
            )
          })}
        </div>
      )}
      </section>

      {/* Recent logs table */}
      <section className="gb-reveal-block" style={{ marginTop: 26 }}>
      <CardTitle helper="A log of every outreach you record. Newest first. Click a row to open that contact's timeline.">
        Touchpoint history
      </CardTitle>
      {filteredLogs.length === 0 ? (
        <div style={{ color: "var(--gb-text-faint)", fontSize: 14 }}>No logs yet. Use the Log touchpoint button.</div>
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
                    className="gb-reveal-block"
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
                      <button type="button" onClick={() => deleteLog(l.id)} {...dangerBtn({ sm: true })}>
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <ViewMoreButton
            hiddenCount={hiddenHistoryCount}
            showAll={showAllHistory}
            onToggle={() => setShowAllHistory((v) => !v)}
            singular="touchpoint"
            style={{ margin: "12px 14px 14px" }}
          />
        </div>
      )}
      </section>

      </div>

      {/* Log touchpoint FAB / expandable panel */}
      <div
        ref={logAreaRef}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        {logPanelOpen ? (
          <div
            style={{
              width: "min(400px, calc(100vw - 32px))",
              background: "var(--gb-bg-elevated)",
              border: "1px solid var(--gb-border)",
              borderRadius: 20,
              boxShadow: "var(--gb-shadow-panel)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid var(--gb-border-subtle)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: font.mono,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--gb-accent-muted)",
                    marginBottom: 4,
                  }}
                >
                  Tracker
                </div>
                <div
                  style={{
                    fontFamily: font.h1,
                    fontWeight: 700,
                    fontSize: 16,
                    color: "var(--gb-text)",
                    lineHeight: 1.3,
                  }}
                >
                  Log a touchpoint
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLogPanelOpen(false)}
                aria-label="Close log touchpoint"
                className={`${uiClass.iconBtn} gb-icon-btn--round`}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={saveLog}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: 16,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontFamily: font.mono,
                    color: "var(--gb-text-faint)",
                    display: "block",
                    marginBottom: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  CONTACT *
                </label>
                <select
                  value={logContactId}
                  onChange={(e) => setLogContactId(e.target.value)}
                  style={inputStyle()}
                  required
                >
                  <option value="">Select a contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.company ? ` · ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontFamily: font.mono,
                    color: "var(--gb-text-faint)",
                    display: "block",
                    marginBottom: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  DATE *
                </label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  style={inputStyle()}
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontFamily: font.mono,
                    color: "var(--gb-text-faint)",
                    display: "block",
                    marginBottom: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  CHANNEL
                </label>
                <select
                  value={logChannel}
                  onChange={(e) => setLogChannel(e.target.value)}
                  style={inputStyle()}
                >
                  {CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontFamily: font.mono,
                    color: "var(--gb-text-faint)",
                    display: "block",
                    marginBottom: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  NOTE
                </label>
                <input
                  placeholder="Short note (optional)"
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  style={inputStyle()}
                />
              </div>
              <button
                type="submit"
                disabled={!logContactId || savingLog}
                {...primaryBtn({ fullWidth: true, style: { marginTop: 4 } })}
              >
                {savingLog ? "Saving…" : "Add touchpoint"}
              </button>
            </form>
          </div>
        ) : (
          <button
            type="button"
            className="gb-compose-fab gb-tracker-fab"
            onClick={() => {
              if (filterContactId) setLogContactId(filterContactId)
              setLogPanelOpen(true)
            }}
            aria-label="Log a touchpoint"
            title="Log a touchpoint"
          >
            <span style={{ fontSize: 26, lineHeight: 1, display: "flex", fontWeight: 700 }} aria-hidden>
              +
            </span>
            Log touchpoint
          </button>
        )}
      </div>

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
                      fontFamily: font.body,
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
                className={`${uiClass.iconBtn} gb-icon-btn--round gb-icon-btn--round-lg`}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "16px 24px 24px", overflowY: "auto", flex: 1 }}>
              {timelineEntries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--gb-text-muted)", fontSize: 14, fontFamily: font.h1, lineHeight: 1.6 }}>
                  No outreach logged yet. Use the{" "}
                  <strong style={{ color: "var(--gb-text)" }}>Log touchpoint</strong> button to record when you reach out, and
                  it will show up here.
                </div>
              ) : (
                <>
                  {timelineSummary && (
                    <div className="gb-tracker-summary-grid">
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
                        <div key={item.label} className="gb-tracker-summary-tile">
                          <div className="gb-tracker-summary-tile__label">{item.label}</div>
                          <div className="gb-tracker-summary-tile__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {timelineContactId != null && timelineEntries.length > 0 ? (
                    <TrackerRhythmChart
                      buckets={weekTouchBuckets(logs, timelineContactId, 12)}
                      compact
                    />
                  ) : null}

                  {timelineAxis && timelineDayMarkers.length > 0 ? (
                    <TimelineRelationshipChart markers={timelineDayMarkers} axis={timelineAxis} />
                  ) : null}

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
                  <ViewMoreButton
                    hiddenCount={hiddenModalTouchpointCount}
                    showAll={showAllModalTouchpoints}
                    onToggle={() => setShowAllModalTouchpoints((v) => !v)}
                    singular="touchpoint"
                    style={{ width: "100%", marginTop: 12, alignSelf: "stretch" }}
                  />
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
              <button type="button" onClick={() => setTimelineContactId(null)} {...secondaryBtn()}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
