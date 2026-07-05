import React, { useState, useEffect, useCallback } from "react"
import { api, BASE } from "../api"
import { font, accentNeon } from "../theme"
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

function sectionCard(borderColor = "rgba(255,255,255,0.08)", embedded = false) {
  return {
    background: embedded ? "#0d0d14" : "#111118",
    border: `1px solid ${borderColor}`,
    borderRadius: embedded ? 12 : 16,
    padding: embedded ? 16 : 24,
    marginBottom: embedded ? 14 : 24,
  }
}

const secondaryBtn = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(240,240,245,0.85)",
  padding: "10px 16px",
  borderRadius: 9,
  fontFamily: font.body,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "none",
}

const REMINDER_URGENCY = ["critical", "overdue", "today", "soon", "upcoming"]

const WARMTH_LEGEND = [
  { c: "#b8ff57", label: "Warm", detail: "Last touch within 21 days" },
  { c: "#ffc96b", label: "Check in soon", detail: "22–45 days since last touch" },
  { c: "#ff6b6b", label: "Overdue", detail: "More than 45 days since last touch" },
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
              color: "rgba(240,240,245,0.3)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Preferences
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
            Settings
          </h1>
          <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, maxWidth: 680, lineHeight: 1.55 }}>
            Tutorial, reminders, compose defaults, integrations, and how urgency works across the app.
          </p>
        </div>
      )}
      {error && (
        <p style={{ color: "#ff6b6b", fontSize: 13, marginBottom: embedded ? 12 : 10 }}>{error}</p>
      )}
      {googleNoticeLocal && (
        <p
          style={{
            color: googleNoticeLocal.type === "success" ? accentNeon : "#ff6b6b",
            fontSize: 13,
            marginBottom: embedded ? 12 : 10,
          }}
        >
          {googleNoticeLocal.text}
        </p>
      )}

      <section style={sectionCard(undefined, embedded)}>
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Home tutorial
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "rgba(240,240,245,0.45)", lineHeight: 1.5 }}>
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
              background: loading || !tutorialHidden || restoringTutorial ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
              color: loading || !tutorialHidden || restoringTutorial ? "rgba(240,240,245,0.35)" : "rgba(240,240,245,0.85)",
              border: "1px solid rgba(255,255,255,0.12)",
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
                color: "rgba(240,240,245,0.55)",
                border: "1px solid rgba(255,255,255,0.12)",
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
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Reminders & calendar
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "rgba(240,240,245,0.45)", lineHeight: 1.5 }}>
          Default behavior when you add a new follow-up reminder on the Reminders page.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 14,
            color: "rgba(240,240,245,0.75)",
            lineHeight: 1.45,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          <input
            type="checkbox"
            checked={prefs.defaultSyncToCalendar}
            onChange={(e) => updatePrefs({ defaultSyncToCalendar: e.target.checked })}
            style={{ marginTop: 3, accentColor: accentNeon }}
          />
          <span>
            Add new reminders to Google Calendar by default
            <span style={{ display: "block", fontSize: 12, color: "rgba(240,240,245,0.4)", marginTop: 4 }}>
              You can still toggle this per reminder. Requires Google connected below.
            </span>
          </span>
        </label>
        <button type="button" onClick={() => setPage("reminders")} style={secondaryBtn}>
          Open reminders →
        </button>
      </section>

      <section style={sectionCard("rgba(184,255,87,0.14)", embedded)}>
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Compose defaults
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "rgba(240,240,245,0.45)", lineHeight: 1.5 }}>
          Pre-select your preferred tone when opening Compose. Career goals from your profile can pre-fill background.
        </p>
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="settings-default-tone"
            style={{
              fontSize: 11,
              fontFamily: font.mono,
              color: "rgba(240,240,245,0.4)",
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
            style={{
              width: "100%",
              background: "#0a0a0f",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#f0f0f5",
              fontSize: 14,
              fontFamily: font.body,
              outline: "none",
              boxSizing: "border-box",
            }}
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
            color: "rgba(240,240,245,0.75)",
            lineHeight: 1.45,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          <input
            type="checkbox"
            checked={prefs.prefillBackgroundFromGoals}
            onChange={(e) => updatePrefs({ prefillBackgroundFromGoals: e.target.checked })}
            style={{ marginTop: 3, accentColor: accentNeon }}
          />
          <span>
            Pre-fill “Your background” from career goals
            <span style={{ display: "block", fontSize: 12, color: "rgba(240,240,245,0.4)", marginTop: 4 }}>
              Edit career goals in your profile menu (top-right avatar).
            </span>
          </span>
        </label>
        <button type="button" onClick={() => setPage("compose")} style={secondaryBtn}>
          Open compose →
        </button>
      </section>

      <section style={sectionCard("rgba(91,228,216,0.18)", embedded)}>
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Google account
        </div>
        {googleLoading ? (
          <div style={{ color: "rgba(240,240,245,0.35)", fontSize: 14 }}>Loading…</div>
        ) : !googleStatus.configured ? (
          <p style={{ margin: 0, fontSize: 14, color: "rgba(240,240,245,0.45)", lineHeight: 1.5 }}>
            Google sign-in is not configured on this server. Calendar sync and Gmail drafts in Compose require
            server setup.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "rgba(240,240,245,0.45)", lineHeight: 1.5 }}>
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
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(240,240,245,0.65)",
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
                    background: "rgba(184,255,87,0.12)",
                    border: "1px solid rgba(184,255,87,0.35)",
                    color: accentNeon,
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
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Connection warmth
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "rgba(240,240,245,0.45)", lineHeight: 1.5 }}>
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
              <span style={{ color: "rgba(240,240,245,0.75)" }}>
                <strong style={{ fontWeight: 600 }}>{label}</strong>
                <span style={{ display: "block", color: "rgba(240,240,245,0.4)", marginTop: 2, lineHeight: 1.35 }}>
                  {detail}
                </span>
              </span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setPage("tracker")} style={secondaryBtn}>
          Open tracker →
        </button>
      </section>

      <section style={{ ...sectionCard(undefined, embedded), marginBottom: embedded ? 0 : 24 }}>
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          Notifications
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "rgba(240,240,245,0.45)", lineHeight: 1.5 }}>
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
                <span style={{ color: "rgba(240,240,245,0.45)" }}>{detail}</span>
              </div>
            )
          })}
        </div>
        <button type="button" onClick={() => setPage("notifications")} style={secondaryBtn}>
          Open notifications →
        </button>
      </section>
    </div>
  )
}
