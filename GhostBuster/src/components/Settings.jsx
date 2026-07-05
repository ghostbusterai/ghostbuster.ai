import React, { useState, useEffect, useCallback } from "react"
import { api, BASE } from "../api"
import { font } from "../theme"
import { useTheme } from "../ThemeContext"
import { inputStyle, sectionCard, secondaryBtn } from "../uiStyles"
import {
  normalizeProfile,
  readLocalProfile,
  saveLocalProfile,
  isGettingStartedHidden,
  restoreGettingStartedTutorial,
  GETTING_STARTED_SESSION_KEY,
} from "../profile"
import {
  COMPOSE_TONES,
  readPreferences,
  savePreferences,
} from "../preferences"
import { getReminderUrgencyStyle } from "../reminderUtils"

const REMINDER_URGENCY = ["critical", "overdue", "today", "soon", "upcoming"]

const WARMTH_LEGEND = [
  { c: "var(--gb-accent)", label: "Warm", detail: "Last touch within 21 days" },
  { c: "var(--gb-warning)", label: "Check in soon", detail: "22–45 days since last touch" },
  { c: "var(--gb-danger)", label: "Overdue", detail: "More than 45 days since last touch" },
]

export default function Settings({
  setPage,
  googleNotice = null,
  onConsumeGoogleNotice = () => {},
  embedded = false,
}) {
  const [profile, setProfile] = useState(() => readLocalProfile())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [restoringTutorial, setRestoringTutorial] = useState(false)
  const [hidingTutorial, setHidingTutorial] = useState(false)
  const [googleStatus, setGoogleStatus] = useState({ connected: false, configured: false })
  const [googleLoading, setGoogleLoading] = useState(true)
  const [googleNoticeLocal, setGoogleNoticeLocal] = useState(null)
  const [prefs, setPrefs] = useState(() => readPreferences())
  const { colorScheme, setColorScheme } = useTheme()

  const loadProfile = useCallback(async () => {
    setError(null)
    try {
      const { profile: p } = await api.getProfile()
      const next = normalizeProfile(p)
      setProfile(next)
      saveLocalProfile(next)
    } catch {
      setProfile(readLocalProfile())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const status = await api.getGoogleCalendarStatus()
        if (!cancelled) setGoogleStatus(status)
      } catch {
        if (!cancelled) setGoogleStatus({ connected: false, configured: false })
      } finally {
        if (!cancelled) setGoogleLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!googleNotice) return
    setGoogleNoticeLocal(googleNotice)
    onConsumeGoogleNotice()
  }, [googleNotice, onConsumeGoogleNotice])

  function updatePrefs(partial) {
    const next = savePreferences(partial)
    setPrefs(next)
  }

  async function showGettingStartedAgain() {
    setRestoringTutorial(true)
    setError(null)
    try {
      const { profile: p } = await api.patchProfile({ hideGettingStarted: false })
      const next = normalizeProfile(p)
      setProfile(next)
      saveLocalProfile(next)
    } catch {
      const next = normalizeProfile({ ...readLocalProfile(), hideGettingStarted: false })
      setProfile(next)
      saveLocalProfile(next)
    }
    restoreGettingStartedTutorial()
    setRestoringTutorial(false)
  }

  async function hideGettingStartedPermanently() {
    setHidingTutorial(true)
    setError(null)
    try {
      const { profile: p } = await api.patchProfile({ hideGettingStarted: true })
      const next = normalizeProfile(p)
      setProfile(next)
      saveLocalProfile(next)
    } catch {
      const next = normalizeProfile({ ...readLocalProfile(), hideGettingStarted: true })
      setProfile(next)
      saveLocalProfile(next)
    }
    try {
      sessionStorage.setItem(GETTING_STARTED_SESSION_KEY, "1")
    } catch {
      /* ignore */
    }
    setHidingTutorial(false)
  }

  function connectGoogle() {
    window.location.href = `${BASE}/api/google/auth?returnTo=settings`
  }

  async function disconnectGoogle() {
    try {
      await api.disconnectGoogleCalendar()
      setGoogleStatus({ connected: false, configured: googleStatus.configured })
    } catch (err) {
      setError(err.message)
    }
  }

  const tutorialHidden = isGettingStartedHidden(profile)

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {!embedded && (
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: font.mono,
              letterSpacing: "0.14em",
              color: "var(--gb-text-dim)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Preferences
          </div>
          <h1
            style={{
              fontFamily: font.h1,
              fontWeight: 800,
              fontSize: 36,
              letterSpacing: "-1px",
              marginBottom: 8,
            }}
          >
            Settings
          </h1>
          <p style={{ color: "var(--gb-text-muted)", fontSize: 15, maxWidth: 680, lineHeight: 1.55 }}>
            Tutorial, reminders, compose defaults, integrations, and how urgency works across the app.
          </p>
        </div>
      )}
      {error && (
        <p style={{ color: "var(--gb-danger)", fontSize: 13, marginBottom: embedded ? 12 : 10 }}>{error}</p>
      )}
      {googleNoticeLocal && (
        <p
          style={{
            color: googleNoticeLocal.type === "success" ? "var(--gb-accent)" : "var(--gb-danger)",
            fontSize: 13,
            marginBottom: embedded ? 12 : 10,
          }}
        >
          {googleNoticeLocal.text}
        </p>
      )}

      <section style={sectionCard("var(--gb-accent-border)", embedded)}>
        <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Appearance
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
          Choose a dark or light background. Accent colors adjust automatically for readability.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { id: "dark", label: "Dark", preview: { bg: "#0a0a0f", text: "#f0f0f5", accent: "#b8ff57" } },
            { id: "light", label: "Light", preview: { bg: "#ffffff", text: "#181b22", accent: "#4d8c18" } },
          ].map(({ id, label, preview }) => {
            const active = colorScheme === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setColorScheme(id)}
                aria-pressed={active}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 10,
                  cursor: "pointer",
                  background: active ? "var(--gb-accent-soft)" : "var(--gb-surface-hover)",
                  border: active ? "1px solid var(--gb-accent-border)" : "1px solid var(--gb-border)",
                  boxShadow: "none",
                }}
              >
                <div
                  style={{
                    height: 52,
                    borderRadius: 8,
                    marginBottom: 10,
                    background: preview.bg,
                    border: "1px solid var(--gb-border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 10px",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: `2px solid ${preview.accent}`,
                      background: id === "light" ? "#f4f9ef" : "rgba(184,255,87,0.12)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: preview.text, fontFamily: font.mono, opacity: 0.85 }}>
                    GhostBuster
                  </span>
                </div>
                <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14, color: "var(--gb-text)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 12, color: "var(--gb-text-faint)", marginTop: 2 }}>
                  {active ? "Active" : `Switch to ${label.toLowerCase()}`}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section style={sectionCard(undefined, embedded)}>
        <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Home tutorial
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
          {loading
            ? "Loading…"
            : tutorialHidden
              ? "The Getting started panel is hidden on Home. You can bring it back anytime."
              : "The Getting started panel is visible on Home."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={showGettingStartedAgain}
            disabled={loading || !tutorialHidden || restoringTutorial}
            style={{
              background: loading || !tutorialHidden || restoringTutorial ? "var(--gb-surface-hover)" : "var(--gb-surface-active)",
              color: loading || !tutorialHidden || restoringTutorial ? "var(--gb-text-faint)" : "var(--gb-text-strong)",
              border: "1px solid var(--gb-border)",
              padding: "10px 16px",
              borderRadius: 9,
              fontFamily: font.body,
              fontWeight: 600,
              fontSize: 13,
              cursor: loading || !tutorialHidden || restoringTutorial ? "not-allowed" : "pointer",
              boxShadow: "none",
            }}
          >
            {restoringTutorial ? "Opening…" : "Show getting started on Home"}
          </button>
          {!loading && !tutorialHidden && (
            <button
              type="button"
              onClick={hideGettingStartedPermanently}
              disabled={hidingTutorial}
              style={{
                background: "transparent",
                color: "var(--gb-text-subtle)",
                border: "1px solid var(--gb-border)",
                padding: "10px 16px",
                borderRadius: 9,
                fontFamily: font.body,
                fontSize: 13,
                cursor: hidingTutorial ? "not-allowed" : "pointer",
                boxShadow: "none",
              }}
            >
              {hidingTutorial ? "Saving…" : "Don't show again"}
            </button>
          )}
        </div>
      </section>

      <section style={sectionCard("rgba(255,201,107,0.18)", embedded)}>
        <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Reminders & calendar
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
          Default behavior when you add a new follow-up reminder on the Reminders page.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 14,
            color: "var(--gb-text-secondary)",
            lineHeight: 1.45,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          <input
            type="checkbox"
            checked={prefs.defaultSyncToCalendar}
            onChange={(e) => updatePrefs({ defaultSyncToCalendar: e.target.checked })}
            style={{ marginTop: 3, accentColor: "var(--gb-accent-bright)" }}
          />
          <span>
            Add new reminders to Google Calendar by default
            <span style={{ display: "block", fontSize: 12, color: "var(--gb-text-faint)", marginTop: 4 }}>
              You can still toggle this per reminder. Requires Google connected below.
            </span>
          </span>
        </label>
        <button type="button" onClick={() => setPage("reminders")} style={secondaryBtn()}>
          Open reminders →
        </button>
      </section>

      <section style={sectionCard("rgba(184,255,87,0.14)", embedded)}>
        <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Compose defaults
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
          Pre-select your preferred tone when opening Compose. Career goals from your profile can pre-fill background.
        </p>
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="settings-default-tone"
            style={{
              fontSize: 11,
              fontFamily: font.mono,
              color: "var(--gb-text-faint)",
              display: "block",
              marginBottom: 6,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Default tone
          </label>
          <select
            id="settings-default-tone"
            value={prefs.defaultComposeTone}
            onChange={(e) => updatePrefs({ defaultComposeTone: e.target.value })}
            style={inputStyle()}
          >
            {COMPOSE_TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 14,
            color: "var(--gb-text-secondary)",
            lineHeight: 1.45,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          <input
            type="checkbox"
            checked={prefs.prefillBackgroundFromGoals}
            onChange={(e) => updatePrefs({ prefillBackgroundFromGoals: e.target.checked })}
            style={{ marginTop: 3, accentColor: "var(--gb-accent-bright)" }}
          />
          <span>
            Pre-fill “Your background” from career goals
            <span style={{ display: "block", fontSize: 12, color: "var(--gb-text-faint)", marginTop: 4 }}>
              Edit career goals in your profile menu (top-right avatar).
            </span>
          </span>
        </label>
        <button type="button" onClick={() => setPage("compose")} style={secondaryBtn()}>
          Open compose →
        </button>
      </section>

      <section style={sectionCard("rgba(91,228,216,0.18)", embedded)}>
        <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Google account
        </div>
        {googleLoading ? (
          <div style={{ color: "var(--gb-text-faint)", fontSize: 14 }}>Loading…</div>
        ) : !googleStatus.configured ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
            Google sign-in is not configured on this server. Calendar sync and Gmail drafts in Compose require
            server setup.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
              {googleStatus.connected
                ? "Connected for Google Calendar reminder sync and Gmail drafts in Compose."
                : "Connect once to sync reminders to Google Calendar and save or schedule emails from Compose."}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: font.mono,
                  color: googleStatus.connected ? "rgba(184,255,87,0.8)" : "rgba(255,201,107,0.85)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {googleStatus.connected ? "Connected" : "Not connected"}
              </span>
              {googleStatus.connected ? (
                <button
                  type="button"
                  onClick={disconnectGoogle}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--gb-border)",
                    color: "var(--gb-text-subtle)",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: "pointer",
                    boxShadow: "none",
                  }}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={connectGoogle}
                  style={{
                    background: "var(--gb-accent-soft)",
                    border: "1px solid var(--gb-accent-border)",
                    color: "var(--gb-accent)",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "none",
                  }}
                >
                  Connect Google
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section style={sectionCard(undefined, embedded)}>
        <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Connection warmth
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
          Tracker and Home use these thresholds to flag contacts who need a check-in.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {WARMTH_LEGEND.map(({ c, label, detail }) => (
            <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 }}>
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: c,
                  marginTop: 4,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--gb-text-secondary)" }}>
                <strong style={{ fontWeight: 600 }}>{label}</strong>
                <span style={{ display: "block", color: "var(--gb-text-faint)", marginTop: 2, lineHeight: 1.35 }}>
                  {detail}
                </span>
              </span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setPage("tracker")} style={secondaryBtn()}>
          Open tracker →
        </button>
      </section>

      <section style={{ ...sectionCard(undefined, embedded), marginBottom: embedded ? 0 : 24 }}>
        <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Notifications
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
          The header bell counts pending reminders. Urgency colors match Reminders and the Notifications page.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {REMINDER_URGENCY.map((u) => {
            const style = getReminderUrgencyStyle(u)
            const detail =
              u === "critical"
                ? "7+ days overdue"
                : u === "overdue"
                  ? "Past due date"
                  : u === "today"
                    ? "Due today"
                    : u === "soon"
                      ? "Due within 3 days"
                      : "Later follow-ups"
            return (
              <div key={u} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: font.mono,
                    color: style.color,
                    background: style.bg,
                    border: `1px solid ${style.border}`,
                    borderRadius: 6,
                    padding: "3px 8px",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  {style.label}
                </span>
                <span style={{ color: "var(--gb-text-muted)" }}>{detail}</span>
              </div>
            )
          })}
        </div>
        <button type="button" onClick={() => setPage("notifications")} style={secondaryBtn()}>
          Open notifications →
        </button>
      </section>
    </div>
  )
}
