import React, { useState, useEffect, useCallback } from "react"
import { api, BASE } from "../api"
import { font } from "../theme"
import { useTheme } from "../ThemeContext"
import { CardTitle, PageHero, PageShell } from "../layout"
import {
  inputStyle,
  sectionCard,
  secondaryBtn,
  dangerBtn,
  dangerSolidBtn,
  accentSoftBtn,
  ghostBtn,
} from "../uiStyles"
import {
  LS_PROFILE,
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
import BrandName from "./BrandName"
import AiMetricsCard from "./AiMetricsCard"

const REMINDER_URGENCY = ["overdue", "today", "soon", "upcoming"]

const WARMTH_LEGEND = [
  { c: "var(--gb-accent)", label: "Warm", detail: "Last touch within 21 days" },
  { c: "var(--gb-warning)", label: "Check in soon", detail: "22–45 days since last touch" },
  { c: "var(--gb-danger)", label: "Overdue", detail: "More than 45 days since last touch" },
]

function SettingsGroup({ title, children, embedded, first = false }) {
  if (!embedded) return <>{children}</>
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        className="gb-settings-group__label"
        style={{
          marginBottom: 8,
          paddingTop: first ? 0 : 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export default function Settings({
  setPage,
  googleNotice = null,
  onConsumeGoogleNotice = () => {},
  onAccountDeleted = null,
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
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

  async function deleteAccountAndData() {
    if (deletingAccount) return
    setDeletingAccount(true)
    setError(null)
    try {
      await api.deleteAccount()
      try {
        localStorage.removeItem(LS_PROFILE)
        sessionStorage.removeItem(GETTING_STARTED_SESSION_KEY)
      } catch {
        /* ignore */
      }
      if (typeof onAccountDeleted === "function") onAccountDeleted()
    } catch (err) {
      setError(err.message || "Could not delete account.")
      setDeletingAccount(false)
    }
  }

  const tutorialHidden = isGettingStartedHidden(profile)

  const appearanceSection = (
    <section {...sectionCard(undefined, embedded)}>
      <CardTitle helper="Choose a dark or light background. Accent colors adjust automatically for readability.">
        Appearance
      </CardTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { id: "dark", label: "Dark", preview: { bg: "#45454c", text: "#ececee", accent: "#9dce5c" } },
          { id: "light", label: "Light", preview: { bg: "#ffffff", text: "#181b22", accent: "#4d8c18" } },
        ].map(({ id, label, preview }) => {
          const active = colorScheme === id
          return (
            <button
              key={id}
              type="button"
              className="gb-appearance-tile"
              onClick={() => setColorScheme(id)}
              aria-pressed={active}
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
                    background: id === "light" ? "#f4f9ef" : "rgba(157,206,92,0.14)",
                    flexShrink: 0,
                  }}
                />
                <BrandName variant="sm" />
              </div>
              <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 14, color: "var(--gb-text)" }}>
                {label}
              </div>
              <div style={{ fontSize: 12, color: "var(--gb-text-faint)", marginTop: 2, fontFamily: font.body }}>
                {active ? "Active" : `Switch to ${label.toLowerCase()}`}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )

  const tutorialSection = (
    <section {...sectionCard(undefined, embedded)}>
      <CardTitle
        helper={
          loading
            ? "Loading…"
            : tutorialHidden
              ? "The Getting started panel is hidden on Home. You can bring it back anytime."
              : "The Getting started panel is visible on Home."
        }
      >
        Home tutorial
      </CardTitle>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={showGettingStartedAgain}
          disabled={loading || !tutorialHidden || restoringTutorial}
          {...secondaryBtn()}
        >
          {restoringTutorial ? "Opening…" : "Show getting started on Home"}
        </button>
        {!loading && !tutorialHidden && (
          <button type="button" onClick={hideGettingStartedPermanently} disabled={hidingTutorial} {...ghostBtn()}>
            {hidingTutorial ? "Saving…" : "Don't show again"}
          </button>
        )}
      </div>
    </section>
  )

  const googleSection = (
    <section {...sectionCard("rgba(91,228,216,0.18)", embedded)}>
      <CardTitle>Google account</CardTitle>
      {googleLoading ? (
        <div style={{ color: "var(--gb-text-faint)", fontSize: 14 }}>Loading…</div>
      ) : !googleStatus.configured ? (
        <p style={{ margin: 0, fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5, fontFamily: font.body }}>
          Google sign-in is not configured on this server. Calendar sync and Gmail drafts in Compose require
          server setup.
        </p>
      ) : (
        <>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5, fontFamily: font.body }}>
            {googleStatus.connected
              ? "Connected for Calendar sync, Gmail drafts in Compose, and read-only inbox scanning on Applications (status updates from recruiting email)."
              : "Connect once for Calendar reminder sync, Compose drafts, and Applications → Sync from Gmail (read-only recruiting inbox — reconnect after we add new Google permissions)."}
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
              <button type="button" onClick={disconnectGoogle} {...secondaryBtn()}>
                Disconnect
              </button>
            ) : (
              <button type="button" onClick={connectGoogle} {...accentSoftBtn()}>
                Connect Google
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )

  const remindersSection = (
    <section {...sectionCard("rgba(255,201,107,0.18)", embedded)}>
      <CardTitle helper="Suggested follow-ups are generated automatically from contact warmth and your résumé date. Default behavior when you add your own reminder on the Reminders page.">
        Reminders & calendar
      </CardTitle>
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
            You can still toggle this per reminder. Requires Google connected above.
          </span>
        </span>
      </label>
      <button type="button" onClick={() => setPage("reminders")} {...secondaryBtn()}>
        Open reminders →
      </button>
    </section>
  )

  const composeSection = (
    <section {...sectionCard(undefined, embedded)}>
      <CardTitle helper="Pre-select your preferred tone when opening Compose. Career goals from your profile can pre-fill background.">
        Compose defaults
      </CardTitle>
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
            Edit career goals under your profile (avatar menu → View profile).
          </span>
        </span>
      </label>
      <button type="button" onClick={() => setPage("compose")} {...secondaryBtn()}>
        Open compose on Contacts →
      </button>
    </section>
  )

  const warmthSection = (
    <section {...sectionCard(undefined, embedded)}>
      <CardTitle helper="Tracker and Home use these thresholds to flag contacts who need a check-in.">
        Connection warmth
      </CardTitle>
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
      <button type="button" onClick={() => setPage("tracker")} {...secondaryBtn()}>
        Open tracker →
      </button>
    </section>
  )

  const notificationsSection = (
    <section {...sectionCard(undefined, embedded)}>
      <CardTitle helper="The header bell counts pending reminders. Urgency colors match Reminders and the Notifications page.">
        Notifications
      </CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {REMINDER_URGENCY.map((u) => {
          const style = getReminderUrgencyStyle(u)
          const detail =
            u === "overdue"
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
      <button type="button" onClick={() => setPage("notifications")} {...secondaryBtn()}>
        Open notifications →
      </button>
    </section>
  )

  const privacySection = (
    <section
      {...sectionCard("rgba(255,107,107,0.28)", embedded)}
      style={{
        marginBottom: embedded ? 0 : 24,
      }}
    >
      <CardTitle helper="Permanently remove your GhostBuster account and everything stored for it. This cannot be undone.">
        Privacy
      </CardTitle>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--gb-text-muted)", lineHeight: 1.5, fontFamily: font.body }}>
        This deletes your Google login, contacts, notes, reminders, outreach logs, résumés, applications, and any
        stored Gmail or Calendar tokens. Copies already sent to email,
        Calendar, or our AI provider are outside this app.
      </p>
      {!confirmDelete ? (
        <button type="button" onClick={() => setConfirmDelete(true)} {...dangerBtn()}>
          Delete my account and all my data
        </button>
      ) : (
        <div>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--gb-danger)",
              fontFamily: font.body,
            }}
          >
            This signs you out and permanently deletes your account. Other people’s accounts are not affected.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={deleteAccountAndData} disabled={deletingAccount} {...dangerSolidBtn()}>
              {deletingAccount ? "Deleting…" : "Permanently delete everything"}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={deletingAccount} {...secondaryBtn()}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )

  const inner = (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {!embedded && (
        <PageHero
          eyebrow="Preferences"
          title="Settings"
          subtitle="Tutorial, reminders, compose defaults, integrations, and how urgency works across the app."
        />
      )}
      {error && (
        <p style={{ color: "var(--gb-danger)", fontSize: 13, marginBottom: embedded ? 12 : 10, fontFamily: font.body }}>{error}</p>
      )}
      {googleNoticeLocal && (
        <p
          style={{
            color: googleNoticeLocal.type === "success" ? "var(--gb-accent)" : "var(--gb-danger)",
            fontSize: 13,
            marginBottom: embedded ? 12 : 10,
            fontFamily: font.body,
          }}
        >
          {googleNoticeLocal.text}
        </p>
      )}

      {embedded ? (
        <>
          <SettingsGroup title="General" embedded first>
            {appearanceSection}
            {tutorialSection}
          </SettingsGroup>
          <SettingsGroup title="Integrations" embedded>
            {googleSection}
            {remindersSection}
          </SettingsGroup>
          <SettingsGroup title="Compose" embedded>
            {composeSection}
          </SettingsGroup>
          <SettingsGroup title="How it works" embedded>
            {warmthSection}
            {notificationsSection}
          </SettingsGroup>
          <SettingsGroup title="Privacy" embedded>
            {privacySection}
          </SettingsGroup>
          <AiMetricsCard embedded />
        </>
      ) : (
        <>
          {appearanceSection}
          {tutorialSection}
          {remindersSection}
          {composeSection}
          {googleSection}
          {warmthSection}
          {notificationsSection}
          {privacySection}
          <AiMetricsCard />
        </>
      )}
    </div>
  )

  if (embedded) return inner

  return <PageShell>{inner}</PageShell>
}
