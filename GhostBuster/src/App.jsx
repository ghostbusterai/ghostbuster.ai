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
import AskGhostBuster from "./components/AskGhostBuster"
import Applications from "./components/Applications"
import Login from "./components/Login"
import CinematicBackground from "./components/CinematicBackground"
import AppLoading from "./components/AppLoading"
import { font } from "./theme"
import GhostBusterLogo from "./components/GhostBusterLogo"
import BrandName from "./components/BrandName"
import { PAGE_PADDING_X } from "./layout"
import { GETTING_STARTED_RESTORED_EVENT } from "./profile"
import { api } from "./api"
import { requestPendingFillReports, GHOSTWRITER_START_EVENT } from "./autofillBridge"
import { GMAIL_FOLLOWUPS_EVENT } from "./components/Reminders"

function localDateString() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const NAV = [
  { id: "dashboard", label: "Home" },
  { id: "contacts", label: "Contacts" },
  { id: "tracker", label: "Tracker" },
  { id: "updates", label: "Resume" },
  { id: "applications", label: "Job applications" },
  { id: "reminders", label: "Reminders" },
  { id: "ghostwriter", label: "Writer" },
  { id: "about", label: "About us" },
]

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
          returnTo === "gmailscan"
            ? "Gmail follow-up reminders are on. GhostBuster checks your recruiter emails a couple of times a day."
            : returnTo === "compose" || returnTo === "contacts"
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
    if (!auth && !google && returnTo === "ghostwriter") {
      setPageState("ghostwriter")
      window.history.replaceState({}, "", window.location.pathname || "/")
    }
    if (auth || google) {
      window.history.replaceState({}, "", window.location.pathname || "/")
    }
  }, [])

  useEffect(() => {
    const onStart = () => setPageState("ghostwriter")
    window.addEventListener(GHOSTWRITER_START_EVENT, onStart)
    return () => window.removeEventListener(GHOSTWRITER_START_EVENT, onStart)
  }, [])

  useEffect(() => {
    let cancelled = false
    const AUTH_TIMEOUT_MS = 8000

    async function loadSession() {
      const demoCode = new URLSearchParams(window.location.search).get("demo")
      if (demoCode) {
        window.history.replaceState({}, "", window.location.pathname || "/")
        try {
          const { user } = await api.demoLogin(demoCode)
          if (!cancelled) {
            setAuthUser(user)
            setAuthError(null)
            requestPendingFillReports()
          }
          return
        } catch (e) {
          if (!cancelled) setAuthError(e.message)
        }
      }

      const retryUntil = Date.now() + 18000

      function authTimeout(ms = AUTH_TIMEOUT_MS) {
        return new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error("Can't reach API (timed out).")), ms)
        })
      }

      async function tryGetMe() {
        return Promise.race([api.getMe(), authTimeout()])
      }

      try {
        let user = null
        let lastErr = null
        while (!cancelled && Date.now() < retryUntil) {
          try {
            const data = await tryGetMe()
            user = data?.user
            lastErr = null
            break
          } catch (e) {
            lastErr = e
            const msg = e?.message || ""
            const transient = /Can't reach API|timed out|Failed to fetch|NetworkError|Load failed/i.test(msg)
            if (!transient) break
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => window.setTimeout(r, 700))
          }
        }

        if (cancelled) return

        if (user) {
          setAuthUser(user)
          setAuthError(null)
          requestPendingFillReports()
          if (!user.demo) {
            api
              .scanGmailFollowups({ auto: true, localDate: localDateString() })
              .then((r) => {
                if (r?.created) window.dispatchEvent(new CustomEvent(GMAIL_FOLLOWUPS_EVENT, { detail: r }))
              })
              .catch(() => {})
          }
          return
        }

        setAuthUser(null)
        const msg = lastErr?.message || ""
        if (/Can't reach API|returned HTML|timed out|Failed to fetch|NetworkError|connection failed|Load failed/i.test(msg)) {
          setAuthError(
            "Connection failed — the GhostBuster API is not reachable. From the GhostBuster folder run: npm run dev (starts API + UI), or in another terminal: cd ghostbuster-server && npm start. Then refresh this page."
          )
        }
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    }

    loadSession()
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

  function handleAccountDeleted() {
    setAuthUser(null)
    setAccountMenuOpen(false)
    setAccountMenuView("menu")
    setPage("dashboard")
  }

  if (authLoading) {
    return <AppLoading />
  }

  if (!authUser) {
    return <Login error={authError} onDemoLogin={setAuthUser} />
  }

  return (
    <div
      className="gb-app gb-app--cinema gb-ui-premium gb-ui-spacex"
      style={{ color: "var(--gb-text)", fontFamily: font.body }}
    >
      {authUser.demo && (
        <div
          role="note"
          style={{
            padding: "8px clamp(16px, 3vw, 40px)",
            background: "rgba(255,201,107,0.12)",
            borderBottom: "1px solid rgba(255,201,107,0.28)",
            color: "var(--gb-text-muted)",
            fontSize: 13,
            fontFamily: font.body,
          }}
        >
          You&apos;re in a demo account with sample data. It&apos;s deleted after a week, AI requests are limited, and
          Gmail and Calendar aren&apos;t available.
        </div>
      )}
      <CinematicBackground enableVideo={false} />
      <div className="gb-app-content">
        <header className="gb-header gb-header--cinema">
          <div className="gb-header-bar">
            <div className="gb-brand-lockup" aria-label="GhostBuster home">
              <span className="gb-brand-ring">
                <GhostBusterLogo size={HEADER_LOGO_SIZE} />
              </span>
              <BrandName variant="header" />
            </div>

            <nav className="gb-nav-rail" role="tablist" aria-label="Main navigation">
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
                    className={`gb-nav-tab${active ? " gb-nav-tab--active" : ""}`}
                  >
                    {n.label}
                  </button>
                )
              })}
            </nav>

            <div className="gb-header-actions">
              <NotificationBell setPage={setPage} currentPage={page} />
              <ProfileMenu
                authUser={authUser}
                onLogout={handleLogout}
                onAccountDeleted={handleAccountDeleted}
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
          key={page}
          className={`gb-main gb-page-enter${page === "dashboard" ? " gb-dashboard-layout" : ""}`}
          style={{
            paddingLeft: PAGE_PADDING_X,
            paddingRight: PAGE_PADDING_X,
            paddingBottom: 80,
          }}
        >
          {page === "dashboard" && <Dashboard setPage={setPage} />}
          {page === "notifications" && <Notifications setPage={setPage} />}
          {page === "contacts" && (
            <ContactHub
              setPage={setPage}
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
          {page === "applications" && <Applications />}
          {page === "ghostwriter" && <Ghostwriter />}
          {page === "about" && <About />}
        </main>
      </div>
      <AskGhostBuster
        setPage={setPage}
        raised={page === "contacts" || page === "tracker"}
        hidden={page === "contacts" && composeOpen}
      />
    </div>
  )
}