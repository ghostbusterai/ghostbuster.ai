import React, { useState, useEffect } from "react"
import Dashboard from "./components/Dashboard"
import ContactHub from "./components/ContactHub"
import Reminders from "./components/Reminders"
import Tracker from "./components/Tracker"
import Updates from "./components/Updates"
import ProfileMenu from "./components/ProfileMenu"
import NotificationBell from "./components/NotificationBell"
import Notifications from "./components/Notifications"
import About from "./components/About"
import Ghostwriter from "./components/Ghostwriter"
import Login from "./components/Login"
import { font } from "./theme"
import GhostBusterLogo from "./components/GhostBusterLogo"
import BrandName from "./components/BrandName"
import { PAGE_PADDING_X } from "./layout"
import { GETTING_STARTED_RESTORED_EVENT } from "./profile"
import { api } from "./api"

const NAV = [
  { id: "dashboard", label: "Home" },
  { id: "contacts", label: "Contacts" },
  { id: "tracker", label: "Tracker" },
  { id: "updates", label: "Resume" },
  { id: "reminders", label: "Reminders" },
  { id: "ghostwriter", label: "Ghostwriter" },
  { id: "about", label: "About" },
]

/** Header brand + nav scale (tabs 11→13, brand + logo scaled ~18%) */
const HEADER_TAB_FONT_SIZE = 13
const HEADER_BRAND_FONT_SIZE = 19
const HEADER_LOGO_SIZE = 35

export default function App() {
  const [page, setPageState] = useState("dashboard")
  const [composeOpen, setComposeOpen] = useState(false)
  const [composePrefill, setComposePrefill] = useState(null)
  const [googleNotice, setGoogleNotice] = useState(null)
  const [googleNoticeTarget, setGoogleNoticeTarget] = useState(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [accountMenuView, setAccountMenuView] = useState("menu")
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  function setPage(next) {
    if (next === "compose") {
      setComposeOpen(true)
      setPageState("contacts")
      return
    }
    setPageState(next)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const auth = params.get("auth")
    const google = params.get("google")
    const returnTo = params.get("page")

    if (auth === "error") {
      setAuthError(params.get("message") || "Could not sign in with Google.")
    }

    if (google === "connected") {
      if (returnTo === "settings") {
        setAccountMenuView("settings")
        setAccountMenuOpen(true)
        setGoogleNoticeTarget("settings")
      } else if (returnTo === "compose" || returnTo === "contacts") {
        setComposeOpen(true)
        setPageState("contacts")
        setGoogleNoticeTarget("compose")
      } else {
        setPageState("reminders")
        setGoogleNoticeTarget("reminders")
      }
      setGoogleNotice({
        type: "success",
        text:
          returnTo === "compose" || returnTo === "contacts"
            ? "Google connected. You can save drafts and schedule emails."
            : returnTo === "settings"
              ? "Google account connected."
              : "Google Calendar connected.",
      })
    } else if (google === "error") {
      if (returnTo === "settings") {
        setAccountMenuView("settings")
        setAccountMenuOpen(true)
        setGoogleNoticeTarget("settings")
      } else if (returnTo === "compose" || returnTo === "contacts") {
        setComposeOpen(true)
        setPageState("contacts")
        setGoogleNoticeTarget("compose")
      } else {
        setPageState("reminders")
        setGoogleNoticeTarget("reminders")
      }
      setGoogleNotice({
        type: "error",
        text: params.get("message") || "Could not connect Google account.",
      })
    }
    if (auth || google) {
      window.history.replaceState({}, "", window.location.pathname || "/")
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { user } = await api.getMe()
        if (!cancelled) {
          setAuthUser(user)
          setAuthError(null)
        }
      } catch {
        if (!cancelled) setAuthUser(null)
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function goHome() {
      setPage("dashboard")
    }
    window.addEventListener(GETTING_STARTED_RESTORED_EVENT, goHome)
    return () => window.removeEventListener(GETTING_STARTED_RESTORED_EVENT, goHome)
  }, [])

  async function handleLogout() {
    try {
      await api.logout()
    } catch {
      /* still clear local session */
    }
    setAuthUser(null)
    setPage("dashboard")
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--gb-bg)",
          color: "var(--gb-text-muted)",
          fontFamily: font.body,
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    )
  }

  if (!authUser) {
    return <Login error={authError} />
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100%",
        background: "var(--gb-bg)",
        color: "var(--gb-text)",
        fontFamily: font.body,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          background: "var(--gb-header-bg)",
          borderBottom: "1px solid var(--gb-border)",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px 28px",
            padding: "14px clamp(16px, 3vw, 40px)",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--gb-text)",
              fontFamily: font.h1,
              fontWeight: 800,
              fontSize: HEADER_BRAND_FONT_SIZE,
              letterSpacing: "-0.3px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: HEADER_LOGO_SIZE,
                height: HEADER_LOGO_SIZE,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 0 0 1px var(--gb-border-subtle)",
              }}
            >
              <GhostBusterLogo size={HEADER_LOGO_SIZE} />
            </span>
            <BrandName variant="header" />
          </div>

          <nav
            role="tablist"
            aria-label="Main navigation"
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 4,
              flex: "1 1 auto",
              justifyContent: "flex-start",
              minWidth: 0,
            }}
          >
            {NAV.map((n) => {
              const active = page === n.id
              return (
                <button
                  key={n.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  id={`tab-${n.id}`}
                  onClick={() => setPage(n.id)}
                  style={{
                    padding: "13px 16px",
                    margin: 0,
                    border: "none",
                    background: "transparent",
                    color: active ? "var(--gb-text)" : "var(--gb-text-subtle)",
                    fontSize: HEADER_TAB_FONT_SIZE,
                    fontFamily: font.mono,
                    fontWeight: active ? 600 : 500,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    borderBottom: active ? "2px solid var(--gb-accent-bright)" : "2px solid transparent",
                    boxSizing: "border-box",
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                >
                  {n.label}
                </button>
              )
            })}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <NotificationBell setPage={setPage} currentPage={page} />
            <ProfileMenu
              authUser={authUser}
              onLogout={handleLogout}
              setPage={setPage}
              open={accountMenuOpen}
              onOpenChange={(v) => {
                setAccountMenuOpen(v)
                if (!v) setAccountMenuView("menu")
              }}
              openView={accountMenuView}
              googleNotice={googleNoticeTarget === "settings" ? googleNotice : null}
              onConsumeGoogleNotice={() => {
                setGoogleNotice(null)
                setGoogleNoticeTarget(null)
              }}
            />
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "100%",
          padding: `24px ${PAGE_PADDING_X} 40px`,
          overflowY: "auto",
          minWidth: 0,
        }}
      >
        {page === "dashboard" && <Dashboard setPage={setPage} />}
        {page === "notifications" && <Notifications setPage={setPage} />}
        {page === "contacts" && (
          <ContactHub
            composeOpen={composeOpen}
            onComposeOpenChange={setComposeOpen}
            composePrefill={composePrefill}
            onConsumePrefill={() => setComposePrefill(null)}
            googleNotice={googleNoticeTarget === "compose" ? googleNotice : null}
            onConsumeGoogleNotice={() => {
              setGoogleNotice(null)
              setGoogleNoticeTarget(null)
            }}
          />
        )}
        {page === "reminders" && (
          <Reminders
            googleNotice={googleNoticeTarget === "reminders" ? googleNotice : null}
            onConsumeGoogleNotice={() => {
              setGoogleNotice(null)
              setGoogleNoticeTarget(null)
            }}
          />
        )}
        {page === "tracker" && <Tracker />}
        {page === "updates" && <Updates setPage={setPage} setComposePrefill={setComposePrefill} />}
        {page === "ghostwriter" && <Ghostwriter />}
        {page === "about" && <About />}
      </main>
    </div>
  )
}
