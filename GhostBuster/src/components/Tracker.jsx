import React, { useState, useEffect, useMemo } from "react"
import { api } from "../api"
import { font } from "../theme"

const CHANNELS = ["Email", "LinkedIn", "In-person", "Call", "Other"]

/** Visual encoding for the graphical timeline */
const CHANNEL_TIMELINE = {
  Email: { stroke: "#b8ff57", glow: "rgba(184,255,87,0.5)", fill: "rgba(184,255,87,0.12)", mark: "✉" },
  LinkedIn: { stroke: "#6eb5ff", glow: "rgba(110,181,255,0.45)", fill: "rgba(110,181,255,0.12)", mark: "in" },
  "In-person": { stroke: "#c4a5ff", glow: "rgba(196,165,255,0.4)", fill: "rgba(196,165,255,0.1)", mark: "◎" },
  Call: { stroke: "#5be4d8", glow: "rgba(91,228,216,0.45)", fill: "rgba(91,228,216,0.12)", mark: "📞" },
  Other: { stroke: "#94a3b8", glow: "rgba(148,163,184,0.35)", fill: "rgba(148,163,184,0.1)", mark: "·" },
}

function timelineChannelMeta(ch) {
  return CHANNEL_TIMELINE[ch] || CHANNEL_TIMELINE.Other
}

/** Vertical gap between nodes scales with days between touchpoints (capped). */
function connectorHeightPx(prevMs, nextMs) {
  if (!prevMs || !nextMs) return 22
  const days = (nextMs - prevMs) / (24 * 60 * 60 * 1000)
  return Math.min(120, Math.max(20, 14 + days * 3.2))
}

const LS_LOGS = "gb_outreach_logs"
const LS_PROFILE = "gb_profile"

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
  if (daysSince <= 21) return { key: "green", label: "Warm", color: "#b8ff57", bg: "rgba(184,255,87,0.12)" }
  if (daysSince <= 45) return { key: "yellow", label: "Check in soon", color: "#ffc96b", bg: "rgba(255,201,107,0.12)" }
  return { key: "red", label: "Overdue", color: "#ff6b6b", bg: "rgba(255,107,107,0.12)" }
}

function daysSince(ms) {
  if (!ms) return Infinity
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
}

function needsResumeNudge(contactId, contact, logs, lastResumeUpdate) {
  if (!lastResumeUpdate) return false
  const resumeMs = parseDay(lastResumeUpdate)
  if (!resumeMs) return false
  const lastMs = lastTouchMs(contactId, contact, logs)
  return lastMs < resumeMs
}

export default function Tracker({ setPage, setComposePrefill }) {
  const [contacts, setContacts] = useState([])
  const [logs, setLogs] = useState([])
  const [profile, setProfile] = useState({ lastResumeUpdate: "" })
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

  const [resumeDate, setResumeDate] = useState("")
  const [savingResume, setSavingResume] = useState(false)

  /** When set, show full-screen timeline for this contact's logged touchpoints */
  const [timelineContactId, setTimelineContactId] = useState(null)

  async function loadAll() {
    setLoadError(null)
    try {
      const [{ contacts: c }, { logs: lg }, { profile: p }] = await Promise.all([
        api.getContacts(),
        api.getOutreachLogs(),
        api.getProfile(),
      ])
      setContacts(c)
      setLogs(lg)
      setProfile(p || { lastResumeUpdate: "" })
      setResumeDate((p && p.lastResumeUpdate) || "")
      localStorage.setItem(LS_LOGS, JSON.stringify(lg))
      localStorage.setItem(LS_PROFILE, JSON.stringify(p || { lastResumeUpdate: "" }))
    } catch (e) {
      setLoadError(e.message)
      setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
      setLogs(JSON.parse(localStorage.getItem(LS_LOGS) || "[]"))
      const pr = JSON.parse(localStorage.getItem(LS_PROFILE) || "{}")
      const prof = { lastResumeUpdate: pr.lastResumeUpdate || "" }
      setProfile(prof)
      setResumeDate(prof.lastResumeUpdate)
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
    if (!filterContactId) return logs
    const id = Number(filterContactId)
    return logs.filter((l) => l.contactId === id)
  }, [logs, filterContactId])

  const sortedFilteredContacts = useMemo(
    () => sortContactsForTracker(filteredContacts, logs, sortBy),
    [filteredContacts, logs, sortBy]
  )

  const filteredSingle = filterContactId && sortedFilteredContacts.length === 1

  const timelineContact = useMemo(
    () => (timelineContactId == null ? null : contacts.find((c) => c.id === timelineContactId) || null),
    [contacts, timelineContactId]
  )

  /** Oldest first so the timeline reads past → present */
  const timelineEntries = useMemo(() => {
    if (timelineContactId == null) return []
    return logs
      .filter((l) => l.contactId === timelineContactId)
      .sort((a, b) => parseDay(a.contactedAt) - parseDay(b.contactedAt))
  }, [logs, timelineContactId])

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

  async function saveResumeDate() {
    setActionError(null)
    setSavingResume(true)
    try {
      const { profile: p } = await api.patchProfile({ lastResumeUpdate: resumeDate })
      setProfile(p)
      localStorage.setItem(LS_PROFILE, JSON.stringify(p))
    } catch (err) {
      if (loadError) {
        const p = { lastResumeUpdate: resumeDate }
        setProfile(p)
        localStorage.setItem(LS_PROFILE, JSON.stringify(p))
      } else {
        setActionError(err.message)
      }
    }
    setSavingResume(false)
  }

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

  function openResumeCompose(contact) {
    const resume = profile.lastResumeUpdate || resumeDate || ""
    const resumeLine = resume
      ? `I last updated my résumé on ${resume}.`
      : "I recently refreshed my résumé."
    setComposePrefill({
      contactId: contact.id,
      situation: "Sharing a resume update",
      tone: "Warm & professional (balanced)",
      purpose:
        "Briefly let them know my résumé is updated, offer to share it if helpful, and invite a light next step (feedback, referrals, or staying in touch) without pressure.",
      extraContext: `${resumeLine} This contact: ${contact.name}${contact.company ? ` at ${contact.company}` : ""}.`,
    })
    setPage("compose")
  }

  const inputStyle = {
    background: "#0a0a0f",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#f0f0f5",
    fontSize: 14,
    fontFamily: font.body,
    width: "100%",
    outline: "none",
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: font.mono,
            letterSpacing: "0.14em",
            color: "rgba(240,240,245,0.3)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Relationship health
        </div>
        <h1
          style={{
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 36,
            letterSpacing: "-1px",
            marginBottom: 8,
          }}
        >
          Tracker
        </h1>
        <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, maxWidth: 720, lineHeight: 1.55, fontFamily: font.body }}>
          Filter by contact to focus on one relationship, or view everyone sorted by how “warm” the connection is.
          Colors show time since your last touch; the strip is the last 12 weeks of logged outreach. After you save a
          résumé update date, contacts you have not messaged since then get a nudge — open Compose to generate a
          professional note to share your update.
        </p>
        {loadError && (
          <p style={{ color: "#ffc96b", fontSize: 13, marginTop: 10 }}>
            API offline — using local copy. Run the server to sync across devices.
          </p>
        )}
        {actionError && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{actionError}</p>}
      </div>

      {/* Resume update — manual date; drives “share update” prompts */}
      <div
        style={{
          background: "#111118",
          border: "1px solid rgba(184,255,87,0.2)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 28,
        }}
      >
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Résumé last updated
        </div>
        <p style={{ fontSize: 13, color: "rgba(240,240,245,0.4)", marginBottom: 14, lineHeight: 1.55, fontFamily: font.body }}>
          When you refresh your résumé, set the date here. We can’t read your files automatically — this date
          highlights contacts who have not heard from you since then and opens Compose with a tailored “sharing my
          update” draft.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" value={resumeDate} onChange={(e) => setResumeDate(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
          <button
            type="button"
            onClick={saveResumeDate}
            disabled={savingResume}
            style={{
              background: "#b8ff57",
              color: "#0a0f09",
              border: "1px solid rgba(10,15,9,0.22)",
              boxShadow: "none",
              padding: "10px 20px",
              borderRadius: 9,
              fontWeight: 700,
              cursor: savingResume ? "wait" : "pointer",
            }}
          >
            {savingResume ? "Saving…" : "Save date"}
          </button>
        </div>
      </div>

      {/* Warmth legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 18,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, fontFamily: font.mono, color: "rgba(240,240,245,0.35)" }}>LEGEND</span>
        {[
          { c: "#b8ff57", label: "Warm (≤21d)" },
          { c: "#ffc96b", label: "Check in soon (22–45d)" },
          { c: "#ff6b6b", label: "Overdue (&gt;45d)" },
          { c: "#6b7280", label: "No touch logged" },
        ].map((x) => (
          <span
            key={x.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "rgba(240,240,245,0.55)",
              padding: "4px 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: x.c }} />
            {x.label}
          </span>
        ))}
      </div>

      {/* Filter + sort */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)" }}>CONTACT</label>
          <select
            value={filterContactId}
            onChange={(e) => setFilterContactId(e.target.value)}
            style={{ ...inputStyle, maxWidth: 320 }}
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
          <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)" }}>SORT</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle, maxWidth: 280 }}>
            <option value="warmth">Warmth — needs attention first</option>
            <option value="touch">Last touch — oldest first</option>
            <option value="name">Name — A to Z</option>
          </select>
        </div>
      </div>

      {filteredSingle && sortedFilteredContacts[0] && (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(184,255,87,0.06)",
            border: "1px solid rgba(184,255,87,0.15)",
            fontSize: 14,
            color: "rgba(240,240,245,0.75)",
          }}
        >
          <strong style={{ color: "#f0f0f5" }}>{sortedFilteredContacts[0].name}</strong>
          {" — "}
          outreach frequency and warmth below are for this contact only. Touchpoint history is filtered the same way.
        </div>
      )}

      {/* Log touchpoint */}
      <div
        style={{
          background: "#111118",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 28,
        }}
      >
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, marginBottom: 16 }}>
          Log outreach
        </div>
        <form onSubmit={saveLog} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <select value={logContactId} onChange={(e) => setLogContactId(e.target.value)} style={inputStyle} required>
            <option value="">Contact *</option>
            {contacts.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} style={inputStyle} required />
          <select value={logChannel} onChange={(e) => setLogChannel(e.target.value)} style={inputStyle}>
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
            style={inputStyle}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <button
              type="submit"
              disabled={!logContactId || savingLog}
              style={{
                background: logContactId && !savingLog ? "#b8ff57" : "rgba(184,255,87,0.2)",
                color: logContactId && !savingLog ? "#0a0f09" : "rgba(184,255,87,0.4)",
                border:
                  logContactId && !savingLog ? "1px solid rgba(10,15,9,0.22)" : "1px solid rgba(184,255,87,0.2)",
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
      </div>

      {/* Per-contact warmth */}
      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
        Connection warmth
      </div>
      <p style={{ fontSize: 13, color: "rgba(240,240,245,0.38)", marginBottom: 14, maxWidth: 640, fontFamily: font.body }}>
        Click a contact row to open a timeline of every logged touchpoint, channel, and note. You can also click a row
        in Touchpoint history below.
      </p>
      {loading ? (
        <div style={{ color: "rgba(240,240,245,0.35)" }}>Loading…</div>
      ) : sortedFilteredContacts.length === 0 ? (
        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
            color: "rgba(240,240,245,0.35)",
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
            const resumeNudge = needsResumeNudge(c.id, c, logs, profile.lastResumeUpdate)
            return (
              <div
                key={c.id}
                style={{
                  background: "#111118",
                  border: `1px solid ${w.key === "green" ? "rgba(184,255,87,0.25)" : w.key === "yellow" ? "rgba(255,201,107,0.25)" : w.key === "red" ? "rgba(255,107,107,0.25)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 14,
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
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
                        color: "rgba(184,255,87,0.55)",
                        marginTop: 4,
                        letterSpacing: 0.3,
                      }}
                    >
                      Open communication timeline →
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(240,240,245,0.45)", marginTop: 2, fontFamily: font.body }}>
                      {[c.role, c.company].filter(Boolean).join(" @ ")}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(240,240,245,0.35)", marginTop: 8, fontFamily: font.mono }}>
                      Last touch:{" "}
                      {lastMs
                        ? `${new Date(lastMs).toLocaleDateString()} (${d === Infinity ? "?" : d}d ago)`
                        : "none logged"}
                      {" · "}
                      Outreach logged: {n7} / 7d · {n30} / 30d · {n90} / 90d
                      {avgGap != null && ` · ~${avgGap}d avg between touches`}
                    </div>
                    <div
                      title="Last 12 weeks (left = older): green = at least one logged touch that week"
                      style={{
                        display: "flex",
                        gap: 4,
                        marginTop: 10,
                        maxWidth: 420,
                        alignItems: "stretch",
                      }}
                    >
                      {weeks.map((on, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: 22,
                            borderRadius: 4,
                            background: on ? "rgba(184,255,87,0.55)" : "rgba(255,255,255,0.06)",
                            border: on ? "1px solid rgba(184,255,87,0.4)" : "1px solid rgba(255,255,255,0.06)",
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(240,240,245,0.25)", marginTop: 4, fontFamily: font.mono }}>
                      12-week rhythm (logged touchpoints only)
                    </div>
                    <div
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontFamily: font.mono,
                        color: w.color,
                        background: w.bg,
                      }}
                    >
                      {w.label}
                    </div>
                    {resumeNudge && (
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12,
                          color: "#5be4d8",
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "rgba(91,228,216,0.08)",
                          border: "1px solid rgba(91,228,216,0.2)",
                        }}
                      >
                        Résumé updated after your last touch — consider sharing an update with them.
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openResumeCompose(c)
                  }}
                  style={{
                    background: "rgba(184,255,87,0.1)",
                    border: "1px solid rgba(184,255,87,0.25)",
                    color: "#b8ff57",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: font.body,
                    whiteSpace: "nowrap",
                  }}
                >
                  Draft résumé update →
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent logs table */}
      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, margin: "36px 0 6px" }}>
        Touchpoint history
      </div>
      <p style={{ fontSize: 13, color: "rgba(240,240,245,0.38)", marginBottom: 14, fontFamily: font.body }}>
        Click any row (except Delete) to open that contact&apos;s timeline.
      </p>
      {filteredLogs.length === 0 ? (
        <div style={{ color: "rgba(240,240,245,0.35)", fontSize: 14 }}>No logs yet — add one above.</div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)", textAlign: "left" }}>
                <th style={{ padding: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.45)" }}>Date</th>
                <th style={{ padding: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.45)" }}>Contact</th>
                <th style={{ padding: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.45)" }}>Channel</th>
                <th style={{ padding: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.45)" }}>Note</th>
                <th style={{ padding: 12 }} />
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((l) => {
                const person = contacts.find((x) => x.id === l.contactId)
                return (
                  <tr
                    key={l.id}
                    onClick={() => setTimelineContactId(l.contactId)}
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(184,255,87,0.04)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    <td style={{ padding: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.7)" }}>
                      {l.contactedAt}
                    </td>
                    <td style={{ padding: 12 }}>{person?.name || "—"}</td>
                    <td style={{ padding: 12, color: "rgba(240,240,245,0.55)" }}>{l.channel || "—"}</td>
                    <td style={{ padding: 12, color: "rgba(240,240,245,0.45)", maxWidth: 280 }}>{l.note || "—"}</td>
                    <td style={{ padding: 12 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => deleteLog(l.id)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,107,107,0.3)",
                          color: "#ff6b6b",
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
              background: "#111118",
              border: "1px solid rgba(255,255,255,0.1)",
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
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <h2
                  id="timeline-title"
                  style={{
                    fontFamily: font.display,
                    fontWeight: 800,
                    fontSize: 22,
                    margin: 0,
                    letterSpacing: "-0.5px",
                  }}
                >
                  Communication timeline
                </h2>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, color: "#f0f0f5" }}>{timelineContact.name}</div>
                <div style={{ fontSize: 13, color: "rgba(240,240,245,0.45)", marginTop: 4 }}>
                  {[timelineContact.role, timelineContact.company].filter(Boolean).join(" @ ")}
                  {!timelineContact.role && !timelineContact.company ? "—" : ""}
                </div>
                {timelineContact.notes ? (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color: "rgba(240,240,245,0.5)",
                      lineHeight: 1.5,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{ fontFamily: font.mono, color: "rgba(240,240,245,0.35)" }}>NOTES · </span>
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
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#f0f0f5",
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
                <div style={{ textAlign: "center", padding: "32px 16px", color: "rgba(240,240,245,0.4)", fontSize: 14 }}>
                  No touchpoints logged for this contact yet. Use <strong style={{ color: "rgba(240,240,245,0.65)" }}>Log outreach</strong> above
                  to record when you reach out and what you discussed — it will appear here.
                </div>
              ) : (
                <>
                  {/* Horizontal “swimlane” — position = real calendar time */}
                  {timelineAxis && (
                    <div
                      style={{
                        marginBottom: 28,
                        padding: "16px 14px 20px",
                        borderRadius: 14,
                        background: "linear-gradient(165deg, rgba(184,255,87,0.08), rgba(10,10,18,0.6))",
                        border: "1px solid rgba(184,255,87,0.12)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: font.mono,
                          letterSpacing: 1.2,
                          color: "rgba(240,240,245,0.4)",
                          marginBottom: 10,
                          textTransform: "uppercase",
                        }}
                      >
                        Activity across time
                      </div>
                      <div style={{ position: "relative", height: 72, marginTop: 4 }}>
                        {/* glow under track */}
                        <div
                          style={{
                            position: "absolute",
                            left: 8,
                            right: 8,
                            top: 38,
                            height: 14,
                            borderRadius: 8,
                            background: "linear-gradient(90deg, rgba(184,255,87,0.12), rgba(91,228,216,0.15), rgba(184,255,87,0.08))",
                            filter: "blur(6px)",
                            opacity: 0.85,
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: 8,
                            right: 8,
                            top: 40,
                            height: 8,
                            borderRadius: 4,
                            background: "linear-gradient(90deg, rgba(255,255,255,0.08), rgba(184,255,87,0.2), rgba(91,228,216,0.18))",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        />
                        {/* “Now” cap */}
                        <div
                          title="Today"
                          style={{
                            position: "absolute",
                            right: 4,
                            top: 34,
                            width: 3,
                            height: 22,
                            borderRadius: 2,
                            background: "rgba(240,240,245,0.5)",
                            boxShadow: "0 0 12px rgba(240,240,245,0.35)",
                          }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 58,
                            fontSize: 9,
                            fontFamily: font.mono,
                            color: "rgba(240,240,245,0.35)",
                          }}
                        >
                          now
                        </span>
                        {timelineEntries.map((entry, axisIdx) => {
                          const t = parseDay(entry.contactedAt)
                          const { t0, span } = timelineAxis
                          const raw = t > 0 ? ((t - t0) / span) * 100 : 0
                          const priorSameDay = timelineEntries
                            .slice(0, axisIdx)
                            .filter((o) => parseDay(o.contactedAt) === t && t > 0).length
                          const pct = Math.min(94, Math.max(3, raw + priorSameDay * 2.8))
                          const meta = timelineChannelMeta(entry.channel)
                          const tip = t
                            ? new Date(t).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: undefined,
                              })
                            : entry.contactedAt
                          return (
                            <div
                              key={`axis-${entry.id}`}
                              title={`${tip} · ${entry.channel || "Touchpoint"}`}
                              style={{
                                position: "absolute",
                                left: `calc(8px + (100% - 16px) * ${pct / 100})`,
                                top: 32,
                                transform: "translateX(-50%)",
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                background: meta.fill,
                                border: `3px solid ${meta.stroke}`,
                                boxShadow: `0 0 14px ${meta.glow}`,
                                cursor: "default",
                              }}
                            />
                          )
                        })}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 4,
                          paddingLeft: 4,
                          paddingRight: 4,
                          fontSize: 10,
                          fontFamily: font.mono,
                          color: "rgba(240,240,245,0.32)",
                        }}
                      >
                        <span>
                          {new Date(timelineAxis.t0).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span style={{ color: "rgba(184,255,87,0.45)" }}>dots = logged touchpoints</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px 14px",
                          marginTop: 12,
                          paddingTop: 10,
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {CHANNELS.map((ch) => {
                          const m = timelineChannelMeta(ch)
                          return (
                            <span
                              key={ch}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 10,
                                fontFamily: font.mono,
                                color: "rgba(240,240,245,0.38)",
                              }}
                            >
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: m.fill,
                                  border: `2px solid ${m.stroke}`,
                                  boxShadow: `0 0 6px ${m.glow}`,
                                }}
                              />
                              {ch}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Vertical spine: connector height ∝ days between events */}
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: font.mono,
                      letterSpacing: 1.2,
                      color: "rgba(240,240,245,0.4)",
                      marginBottom: 14,
                      textTransform: "uppercase",
                    }}
                  >
                    Detail · oldest at top
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
                    {timelineEntries.map((entry, idx) => {
                      const d = parseDay(entry.contactedAt)
                      const label = d
                        ? new Date(d).toLocaleDateString(undefined, {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : entry.contactedAt
                      const meta = timelineChannelMeta(entry.channel)
                      const prevMs = idx > 0 ? parseDay(timelineEntries[idx - 1].contactedAt) : 0
                      const gapH = idx > 0 ? connectorHeightPx(prevMs, d || prevMs) : 0
                      const gapDays =
                        idx > 0 && prevMs && d
                          ? Math.max(0, Math.round((d - prevMs) / (24 * 60 * 60 * 1000)))
                          : 0

                      return (
                        <div key={entry.id} style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
                          {idx > 0 && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "stretch",
                                marginLeft: 22,
                                minHeight: gapH,
                                marginBottom: 2,
                              }}
                            >
                              <div
                                style={{
                                  width: 5,
                                  borderRadius: 3,
                                  background: `linear-gradient(180deg, ${meta.stroke}55, rgba(255,255,255,0.04))`,
                                  boxShadow: `inset 0 0 8px ${meta.glow}`,
                                  flexShrink: 0,
                                }}
                              />
                              {gapDays >= 8 && (
                                <div
                                  style={{
                                    alignSelf: "center",
                                    marginLeft: 12,
                                    padding: "4px 10px",
                                    borderRadius: 20,
                                    fontSize: 10,
                                    fontFamily: font.mono,
                                    color: "rgba(240,240,245,0.4)",
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                  }}
                                >
                                  {gapDays}d between
                                </div>
                              )}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              gap: 16,
                              alignItems: "flex-start",
                              padding: "14px 16px",
                              borderRadius: 14,
                              background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(10,10,18,0.3))",
                              border: `1px solid ${meta.stroke}33`,
                              boxShadow: `0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.2)`,
                            }}
                          >
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: entry.channel === "LinkedIn" ? 11 : 20,
                                fontWeight: entry.channel === "LinkedIn" ? 800 : 400,
                                fontFamily: entry.channel === "LinkedIn" ? font.mono : font.body,
                                color: meta.stroke,
                                background: meta.fill,
                                border: `2px solid ${meta.stroke}`,
                                boxShadow: `0 0 20px ${meta.glow}`,
                              }}
                            >
                              {meta.mark}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontFamily: font.mono,
                                  fontSize: 12,
                                  color: meta.stroke,
                                  letterSpacing: 0.3,
                                }}
                              >
                                {label}
                              </div>
                              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontFamily: font.mono,
                                    padding: "3px 10px",
                                    borderRadius: 8,
                                    background: meta.fill,
                                    color: meta.stroke,
                                    border: `1px solid ${meta.stroke}44`,
                                  }}
                                >
                                  {entry.channel || "Channel"}
                                </span>
                                <span style={{ fontSize: 11, color: "rgba(240,240,245,0.25)" }}>#{idx + 1}</span>
                              </div>
                              <div
                                style={{
                                  marginTop: 12,
                                  fontSize: 14,
                                  lineHeight: 1.55,
                                  color: entry.note ? "rgba(240,240,245,0.9)" : "rgba(240,240,245,0.32)",
                                  fontStyle: entry.note ? "normal" : "italic",
                                }}
                              >
                                {entry.note?.trim() ? entry.note : "No context note — add notes when logging outreach to capture the conversation."}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
            <div
              style={{
                padding: "12px 24px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                fontSize: 11,
                fontFamily: font.mono,
                color: "rgba(240,240,245,0.35)",
              }}
            >
              Press Esc or click outside to close · {timelineEntries.length} touchpoint{timelineEntries.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
