import React, { useState, useEffect, useRef, useCallback } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle } from "../uiStyles"
import Settings from "./Settings"
import {
  DEFAULT_PROFILE,
  normalizeProfile,
  profileInitials,
  readLocalProfile,
  saveLocalProfile,
  isGettingStartedHidden,
  restoreGettingStartedTutorial,
} from "../profile"

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M19.4 13a7.97 7.97 0 0 0 .1-2l2-1.2-2-3.46-2.3.7a8.1 8.1 0 0 0-1.7-1l-.4-2.4H9.9l-.4 2.4a8.1 8.1 0 0 0-1.7 1l-2.3-.7-2 3.46 2 1.2a7.97 7.97 0 0 0 .1 2l-2 1.2 2 3.46 2.3-.7a8.1 8.1 0 0 0 1.7 1l.4 2.4h4.2l.4-2.4a8.1 8.1 0 0 0 1.7-1l2.3.7 2-3.46-2-1.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLogOut() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DropdownRow({ icon, label, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      role="menuitem"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        margin: 0,
        border: "none",
        borderRadius: 8,
        background: hover ? "var(--gb-surface-active)" : "transparent",
        color: hover ? "var(--gb-text)" : "var(--gb-text-secondary)",
        fontFamily: font.body,
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        textAlign: "left",
        boxShadow: "none",
        transition: "background 0.12s ease, color 0.12s ease",
      }}
    >
      <span
        style={{
          color: hover ? "var(--gb-text-muted)" : "var(--gb-text-faint)",
          display: "flex",
          flexShrink: 0,
          width: 20,
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
      {label}
    </button>
  )
}

function MenuDivider() {
  return (
    <div
      role="separator"
      style={{
        height: 1,
        background: "var(--gb-border-subtle)",
        margin: "4px 10px",
      }}
    />
  )
}

function UserHeader({ authUser, displayName, email }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <AvatarCircle authUser={authUser} displayName={displayName} size={40} />
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#3b82f6",
            border: "2px solid var(--gb-bg-elevated)",
          }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: font.body,
            fontWeight: 600,
            fontSize: 14,
            color: "var(--gb-text)",
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </div>
        {email ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--gb-text-muted)",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: 1,
            }}
          >
            {email}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--gb-text-faint)", marginTop: 1 }}>
            Local guest session
          </div>
        )}
      </div>
    </div>
  )
}

function AvatarCircle({ authUser, displayName, size = 40 }) {
  const initials = profileInitials(displayName)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "var(--gb-surface-active)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "var(--gb-accent)",
        fontFamily: font.mono,
        fontSize: size * 0.32,
        fontWeight: 700,
      }}
    >
      {authUser?.picture ? (
        <img
          src={authUser.picture}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          referrerPolicy="no-referrer"
        />
      ) : (
        initials || <IconUser />
      )}
    </div>
  )
}

const panelShadow = "0 12px 16px -4px rgba(0,0,0,0.45), 0 4px 6px -2px rgba(0,0,0,0.25)"

export default function ProfileMenu({
  authUser = null,
  onLogout = null,
  setPage,
  googleNotice = null,
  onConsumeGoogleNotice = () => {},
  open: controlledOpen,
  onOpenChange,
  openView = "menu",
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [view, setView] = useState("menu")
  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE })
  const [name, setName] = useState("")
  const [careerGoals, setCareerGoals] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [restoringTutorial, setRestoringTutorial] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
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
    if (open && openView && openView !== "menu") {
      setView(openView)
    }
  }, [open, openView])

  useEffect(() => {
    if (!open) setView("menu")
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === "Escape") {
        if (view !== "menu") setView("menu")
        else setOpen(false)
      }
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
  }, [open, setOpen, view])

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

  const displayName = profile.name || authUser?.name || "Guest"
  const email = authUser?.email || ""
  const tutorialHidden = isGettingStartedHidden(profile)
  const dirty =
    name.trim() !== (profile.name || "").trim() ||
    careerGoals.trim() !== (profile.careerGoals || "").trim()

  async function handleSignOut() {
    if (!onLogout || signingOut) return
    setSigningOut(true)
    try {
      await onLogout()
    } finally {
      setSigningOut(false)
      setOpen(false)
    }
  }

  const panelWidth =
    view === "settings"
      ? "min(420px, calc(100vw - 32px))"
      : view === "profile"
        ? "min(360px, calc(100vw - 24px))"
        : "min(264px, calc(100vw - 24px))"

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (!open) setView("menu")
          setOpen(!open)
        }}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: open ? "0 0 0 2px var(--gb-border-strong)" : "none",
          transition: "box-shadow 0.15s",
        }}
      >
        <AvatarCircle authUser={authUser} displayName={displayName} size={40} />
      </button>

      {open && (
        <div
          role={view === "menu" ? "menu" : "dialog"}
          aria-label="Account"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: panelWidth,
            maxHeight: "min(85vh, 720px)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "var(--gb-bg-elevated)",
            border: "1px solid var(--gb-border-subtle)",
            borderRadius: 12,
            boxShadow: panelShadow,
            zIndex: 100,
            padding: view === "menu" ? "4px 0 6px" : 0,
          }}
        >
          {view === "menu" && (
            <>
              <UserHeader authUser={authUser} displayName={displayName} email={email} />
              <MenuDivider />
              <div style={{ padding: "0 4px" }}>
                <DropdownRow icon={<IconUser />} label="View profile" onClick={() => setView("profile")} />
                <DropdownRow icon={<IconGear />} label="Account settings" onClick={() => setView("settings")} />
                {typeof onLogout === "function" && (
                  <>
                    <MenuDivider />
                    <DropdownRow
                      icon={<IconLogOut />}
                      label={signingOut ? "Logging out…" : "Log out"}
                      onClick={handleSignOut}
                    />
                  </>
                )}
              </div>
            </>
          )}

          {view === "profile" && (
            <div style={{ overflowY: "auto", maxHeight: "min(85vh, 720px)" }}>
              <div style={{ padding: "0 4px" }}>
                <DropdownRow icon={<IconChevronLeft />} label="Back to menu" onClick={() => setView("menu")} />
              </div>
              <div style={{ padding: "8px 18px 20px" }}>
                <div
                  style={{
                    fontFamily: font.h2,
                    fontWeight: 800,
                    fontSize: 17,
                    letterSpacing: "-0.3px",
                    marginBottom: 8,
                  }}
                >
                  Your profile
                </div>
                <p
                  style={{
                    margin: "0 0 18px",
                    fontSize: 13,
                    color: "var(--gb-text-muted)",
                    lineHeight: 1.5,
                    fontFamily: font.body,
                  }}
                >
                  Set your name and career goals — GhostBuster uses this to personalize your experience.
                </p>

                <form onSubmit={save}>
                  {loading ? (
                    <div style={{ color: "var(--gb-text-faint)", fontSize: 14, marginBottom: 16 }}>Loading…</div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <label
                          htmlFor="profile-name"
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
                          Name
                        </label>
                        <input
                          id="profile-name"
                          placeholder="Your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          style={inputStyle()}
                          autoComplete="name"
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label
                          htmlFor="profile-goals"
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
                          Career goals
                        </label>
                        <textarea
                          id="profile-goals"
                          placeholder="e.g. Break into product management, land a summer internship at a fintech startup, grow my network in climate tech…"
                          value={careerGoals}
                          onChange={(e) => setCareerGoals(e.target.value)}
                          rows={5}
                          style={{ ...inputStyle(), resize: "vertical", minHeight: 110, lineHeight: 1.5 }}
                        />
                      </div>
                      {error && (
                        <p style={{ color: "var(--gb-danger)", fontSize: 12, marginBottom: 10 }}>{error}</p>
                      )}
                      <button
                        type="submit"
                        disabled={saving || !dirty}
                        style={{
                          width: "100%",
                          background: saving || !dirty ? "var(--gb-accent-soft)" : "var(--gb-accent-bright)",
                          color: saving || !dirty ? "var(--gb-accent-muted)" : "var(--gb-accent-text-on)",
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
                      marginTop: 20,
                      paddingTop: 18,
                      borderTop: "1px solid var(--gb-border-subtle)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: font.mono,
                        color: "var(--gb-text-faint)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      Getting started
                    </div>
                    <p
                      style={{
                        margin: "0 0 12px",
                        fontSize: 13,
                        color: "var(--gb-text-subtle)",
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
                        background: !tutorialHidden || restoringTutorial ? "var(--gb-surface-hover)" : "var(--gb-surface-active)",
                        color: !tutorialHidden || restoringTutorial ? "var(--gb-text-faint)" : "var(--gb-text-strong)",
                        border: "1px solid var(--gb-border)",
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
            </div>
          )}

          {view === "settings" && (
            <>
              <div style={{ padding: "0 4px", flexShrink: 0 }}>
                <DropdownRow icon={<IconChevronLeft />} label="Back to menu" onClick={() => setView("menu")} />
              </div>
              <div
                style={{
                  overflowY: "auto",
                  padding: "4px 14px 14px",
                  flex: 1,
                  minHeight: 0,
                  maxHeight: "min(70vh, 620px)",
                }}
              >
                <Settings
                  embedded
                  setPage={(page) => {
                    setOpen(false)
                    setPage(page)
                  }}
                  googleNotice={googleNotice}
                  onConsumeGoogleNotice={onConsumeGoogleNotice}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
