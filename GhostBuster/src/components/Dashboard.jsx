import React, { useState, useEffect, useMemo } from "react"
import { getReminderDueStatus, isReminderOverdue } from "../reminderUtils"
import { font, accentNeon, neonAlpha } from "../theme"

const LS_LOGS = "gb_outreach_logs"
const LS_UPDATES = "gb_resume_updates"

function tintedCard(rgb, borderAlpha = 0.2) {
  return {
    background: `color-mix(in srgb, rgb(${rgb}) 14%, #111118)`,
    border: `1px solid rgba(${rgb},${borderAlpha})`,
    boxShadow: `0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px -12px rgba(${rgb},0.22)`,
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
  if (days <= 21) return { label: "Warm", fg: accentNeon, bg: neonAlpha(0.12) }
  if (days <= 45) return { label: "Check in", fg: "#ffc96b", bg: "rgba(255,201,107,0.12)" }
  return { label: "Overdue", fg: "#ff6b6b", bg: "rgba(255,107,107,0.12)" }
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

function formatFeedTime(ts) {
  if (!ts || Number.isNaN(ts)) return "—"
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
}

export default function Dashboard({ setPage }) {
  const [contacts, setContacts] = useState([])
  const [reminders, setReminders] = useState([])
  const [outreachLogs, setOutreachLogs] = useState([])
  const [resumeUpdates, setResumeUpdates] = useState([])

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

  const stats = [
    {
      label: "Total Contacts",
      value: contacts.length,
      icon: "👥",
      color: accentNeon,
      rgb: "184, 255, 87",
    },
    {
      label: "Pending Reminders",
      value: dueReminders.length,
      sub: overdueReminders.length > 0 ? `${overdueReminders.length} overdue` : null,
      icon: "🔔",
      color: overdueReminders.length > 0 ? "#ff6b6b" : "#ffc96b",
      rgb: overdueReminders.length > 0 ? "255, 107, 107" : "255, 201, 107",
    },
    {
      label: "Companies",
      value: [...new Set(contacts.map((c) => c.company).filter(Boolean))].length,
      icon: "🏢",
      color: "#5be4d8",
      rgb: "91, 228, 216",
    },
    {
      label: "This Week Outreach",
      value: contacts.filter((c) => {
        if (!c.lastContacted) return false
        const d = new Date(c.lastContacted)
        const now = new Date()
        return (now - d) / (1000 * 60 * 60 * 24) <= 7
      }).length,
      icon: "📨",
      color: "#b482ff",
      rgb: "180, 130, 255",
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
      items.push({
        id: `rem-${r.id}`,
        kind: "reminder",
        ts,
        accent: status.overdue ? "#ff6b6b" : "#ffc96b",
        title: `Reminder · ${r.contactName || "Contact"}`,
        detail: status.overdue ? `Overdue · ${reason}` : reason,
        page: "reminders",
      })
    }

    items.sort((a, b) => b.ts - a.ts)
    return items.slice(0, 14)
  }, [contacts, outreachLogs, resumeUpdates, reminders])

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: font.mono,
            letterSpacing: "0.2em",
            color: "rgba(240,240,245,0.35)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Overview
        </div>
        <h1 style={{ fontFamily: font.display, fontWeight: 800, fontSize: 36, letterSpacing: "-1px", marginBottom: 8 }}>
          Home
        </h1>
        <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, fontFamily: font.body }}>Your networking activity at a glance.</p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 16,
          marginBottom: 48,
          width: "100%",
        }}
      >
        {stats.map((s) => {
          const tg = tintedCard(s.rgb)
          return (
            <div
              key={s.label}
              style={{
                ...tg,
                borderRadius: 16,
                padding: "20px 22px 22px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: font.mono,
                    letterSpacing: "0.14em",
                    color: "rgba(240,240,245,0.42)",
                    textTransform: "uppercase",
                    maxWidth: "70%",
                    lineHeight: 1.35,
                  }}
                >
                  {s.label}
                </div>
                <span style={{ fontSize: 22, lineHeight: 1, opacity: 0.9 }} aria-hidden>
                  {s.icon}
                </span>
              </div>
              <div
                style={{
                  fontFamily: font.mono,
                  fontWeight: 600,
                  fontSize: 42,
                  color: s.color,
                  letterSpacing: "-2px",
                  lineHeight: 0.95,
                  textShadow: `0 0 40px rgba(${s.rgb},0.35)`,
                }}
              >
                {s.value}
              </div>
              {s.sub && (
                <div style={{ marginTop: 8, fontSize: 12, fontFamily: font.mono, color: s.color, opacity: 0.85 }}>
                  {s.sub}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 48, width: "100%" }}>
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, marginBottom: 16, letterSpacing: "-0.02em" }}>
          Quick Actions
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Add Contact", page: "contacts", primary: true },
            { label: "Set Reminder", page: "reminders" },
            { label: "Compose Message", page: "compose" },
            { label: "Resume update", page: "updates" },
          ].map((a) => {
            const primary = a.primary === true
            const borderDefault = primary ? "1px solid rgba(10,15,9,0.22)" : "1px solid rgba(255,255,255,0.22)"
            const borderHover = primary ? "1px solid rgba(10,15,9,0.35)" : "1px solid rgba(255,255,255,0.38)"
            return (
              <button
                key={a.label}
                type="button"
                onClick={() => setPage(a.page)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0,
                  padding: primary ? "12px 22px" : "11px 20px",
                  borderRadius: primary ? 12 : 10,
                  background: primary ? accentNeon : "transparent",
                  border: borderDefault,
                  color: primary ? "#0a0f09" : "#f0f0f5",
                  fontFamily: font.display,
                  fontWeight: primary ? 700 : 600,
                  fontSize: 14,
                  letterSpacing: primary ? "-0.02em" : "0",
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                  boxShadow: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = borderHover
                  if (primary) {
                    e.currentTarget.style.background = "#9ed945"
                  } else {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)"
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = borderDefault
                  e.currentTarget.style.background = primary ? accentNeon : "transparent"
                }}
              >
                {a.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent Contacts + Activity Feed */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 24,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        {/* Recent Contacts */}
        <section
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "22px 24px 20px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, margin: 0, letterSpacing: "-0.02em" }}>
                Recent Contacts
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(240,240,245,0.38)", fontFamily: font.mono }}>
                Sorted by latest touch or date added · status from last outreach
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPage("contacts")}
              style={{
                flexShrink: 0,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(240,240,245,0.7)",
                fontFamily: font.mono,
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
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
                padding: "36px 20px",
                textAlign: "center",
                color: "rgba(240,240,245,0.32)",
                fontSize: 14,
                fontFamily: font.body,
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.08)",
              }}
            >
              No contacts yet —{" "}
              <button
                type="button"
                onClick={() => setPage("contacts")}
                style={{
                  background: "none",
                  border: "none",
                  color: accentNeon,
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: font.display,
                  fontWeight: 600,
                }}
              >
                add your first one →
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
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: neonAlpha(0.14),
                        color: accentNeon,
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
                      <div style={{ fontSize: 12, color: "rgba(240,240,245,0.42)", marginBottom: 8, fontFamily: font.body }}>
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
                              color: reminderBadge === "overdue" ? "#ff6b6b" : "#ffc96b",
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
                        color: "rgba(240,240,245,0.35)",
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

        {/* Activity Feed */}
        <section
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "22px 24px 20px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            maxHeight: 560,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, margin: 0, letterSpacing: "-0.02em" }}>
                Activity Feed
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(240,240,245,0.38)", fontFamily: font.mono }}>
                Outreach, résumé updates, and open reminders
              </p>
            </div>
          </div>

          {activityFeed.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "36px 20px",
                textAlign: "center",
                color: "rgba(240,240,245,0.32)",
                fontSize: 14,
                fontFamily: font.body,
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.08)",
              }}
            >
              No activity yet. Log outreach in Tracker or add a résumé update.
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                marginRight: -6,
                paddingRight: 6,
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {activityFeed.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPage(item.page)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                    margin: 0,
                    padding: "14px 6px 14px 4px",
                    cursor: "pointer",
                    borderRadius: 0,
                    color: "inherit",
                    font: "inherit",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 4,
                        borderRadius: 2,
                        alignSelf: "stretch",
                        minHeight: 44,
                        background: item.accent,
                        flexShrink: 0,
                        opacity: 0.85,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: font.mono,
                            fontSize: 10,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: item.accent,
                            fontWeight: 600,
                          }}
                        >
                          {item.kind === "outreach" ? "Outreach" : item.kind === "update" ? "Résumé" : "Reminder"}
                        </span>
                        <span style={{ fontFamily: font.mono, fontSize: 10, color: "rgba(240,240,245,0.35)" }}>
                          {formatFeedTime(item.ts)}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, lineHeight: 1.35, fontFamily: font.display }}>
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(240,240,245,0.45)",
                          lineHeight: 1.45,
                          fontFamily: font.body,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.detail || "—"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
