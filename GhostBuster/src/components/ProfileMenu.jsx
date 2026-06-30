import React, { useState, useEffect, useRef, useCallback } from "react"
import { api } from "../api"
import { font, accentNeon } from "../theme"
import {
  DEFAULT_PROFILE,
  normalizeProfile,
  profileInitials,
  readLocalProfile,
  saveLocalProfile,
  isGettingStartedHidden,
  restoreGettingStartedTutorial,
} from "../profile"

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
  boxSizing: "border-box",
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE })
  const [name, setName] = useState("")
  const [careerGoals, setCareerGoals] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [restoringTutorial, setRestoringTutorial] = useState(false)
  const rootRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { profile: p } = await api.getProfile()
      const next = normalizeProfile(p)
      setProfile(next)
      setName(next.name)
      setCareerGoals(next.careerGoals)
      saveLocalProfile(next)
    } catch {
      const local = readLocalProfile()
      setProfile(local)
      setName(local.name)
      setCareerGoals(local.careerGoals)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === "Escape") setOpen(false)
    }
    function onClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onClick)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onClick)
    }
  }, [open])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    const payload = {
      name: name.trim(),
      careerGoals: careerGoals.trim(),
    }
    try {
      const { profile: p } = await api.patchProfile(payload)
      const next = normalizeProfile(p)
      setProfile(next)
      setName(next.name)
      setCareerGoals(next.careerGoals)
      saveLocalProfile(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      const next = normalizeProfile({ ...profile, ...payload })
      setProfile(next)
      saveLocalProfile(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      if (!err.message?.includes("Can't reach API")) {
        setError(err.message)
      }
    }
    setSaving(false)
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
    setOpen(false)
  }

  const initials = profileInitials(profile.name)
  const tutorialHidden = isGettingStartedHidden(profile)
  const dirty =
    name.trim() !== (profile.name || "").trim() ||
    careerGoals.trim() !== (profile.careerGoals || "").trim()

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0, marginLeft: "auto" }}>
      <button
        type="button"
        aria-label="Profile settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: open ? `2px solid ${accentNeon}` : "1px solid rgba(255,255,255,0.14)",
          background: open ? "rgba(184,255,87,0.12)" : "rgba(255,255,255,0.06)",
          color: initials ? accentNeon : "rgba(240,240,245,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontFamily: font.mono,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
          boxShadow: "none",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        {initials || <UserIcon />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Profile settings"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: "min(360px, calc(100vw - 32px))",
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 800,
                fontSize: 17,
                letterSpacing: "-0.3px",
              }}
            >
              Your profile
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: "rgba(240,240,245,0.45)",
                lineHeight: 1.45,
              }}
            >
              Set your name and career goals — GhostBuster uses this to personalize your experience.
            </p>
          </div>

          <form onSubmit={save} style={{ padding: "16px 18px 18px" }}>
            {loading ? (
              <div style={{ color: "rgba(240,240,245,0.35)", fontSize: 14 }}>Loading…</div>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label
                    htmlFor="profile-name"
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
                    Name
                  </label>
                  <input
                    id="profile-name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                    autoComplete="name"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label
                    htmlFor="profile-goals"
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
                    Career goals
                  </label>
                  <textarea
                    id="profile-goals"
                    placeholder="e.g. Break into product management, land a summer internship at a fintech startup, grow my network in climate tech…"
                    value={careerGoals}
                    onChange={(e) => setCareerGoals(e.target.value)}
                    rows={5}
                    style={{ ...inputStyle, resize: "vertical", minHeight: 110, lineHeight: 1.5 }}
                  />
                </div>

                {error && (
                  <p style={{ color: "#ff6b6b", fontSize: 12, marginBottom: 10 }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={saving || !dirty}
                  style={{
                    width: "100%",
                    background: saving || !dirty ? "rgba(184,255,87,0.2)" : accentNeon,
                    color: saving || !dirty ? "rgba(184,255,87,0.4)" : "#0a0f09",
                    border: "1px solid rgba(10,15,9,0.22)",
                    padding: "10px 16px",
                    borderRadius: 9,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: saving || !dirty ? "not-allowed" : "pointer",
                    boxShadow: "none",
                  }}
                >
                  {saving ? "Saving…" : saved && !dirty ? "Saved" : "Save profile"}
                </button>
              </>
            )}
          </form>

          {!loading && (
            <div
              style={{
                padding: "0 18px 18px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                marginTop: -2,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontFamily: font.mono,
                  color: "rgba(240,240,245,0.4)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                  paddingTop: 16,
                }}
              >
                Getting started
              </div>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  color: "rgba(240,240,245,0.5)",
                  lineHeight: 1.45,
                }}
              >
                {tutorialHidden
                  ? "Bring the Home tutorial back if you closed it."
                  : "The tutorial is currently visible on Home."}
              </p>
              <button
                type="button"
                onClick={showGettingStartedAgain}
                disabled={!tutorialHidden || restoringTutorial}
                style={{
                  width: "100%",
                  background: !tutorialHidden || restoringTutorial ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
                  color: !tutorialHidden || restoringTutorial ? "rgba(240,240,245,0.35)" : "rgba(240,240,245,0.85)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  padding: "10px 16px",
                  borderRadius: 9,
                  fontFamily: font.body,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: !tutorialHidden || restoringTutorial ? "not-allowed" : "pointer",
                  boxShadow: "none",
                }}
              >
                {restoringTutorial ? "Opening…" : "Show getting started on Home"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
