import React, { useState, useEffect } from "react"
import Dashboard from "./components/Dashboard"
import ContactHub from "./components/ContactHub"
import Reminders from "./components/Reminders"
import MessageComposer from "./components/MessageComposer"
import Tracker from "./components/Tracker"
import Updates from "./components/Updates"
import ProfileMenu from "./components/ProfileMenu"
import SettingsMenu from "./components/SettingsMenu"
import NotificationBell from "./components/NotificationBell"
import Notifications from "./components/Notifications"
import { font, accentNeon } from "./theme"
import GhostBusterLogo from "./components/GhostBusterLogo"
import { GETTING_STARTED_RESTORED_EVENT } from "./profile"

const NAV = [
  { id: "dashboard", label: "Home" },
  { id: "contacts", label: "Contacts" },
  { id: "tracker", label: "Tracker" },
  { id: "updates", label: "Resume" },
  { id: "reminders", label: "Reminders" },
  { id: "compose", label: "Compose" },
]

export default function App() {
  const [page, setPage] = useState("dashboard")
  const [composePrefill, setComposePrefill] = useState(null)
  const [googleNotice, setGoogleNotice] = useState(null)
  const [googleNoticeTarget, setGoogleNoticeTarget] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const google = params.get("google")
    const returnTo = params.get("page")
    const returnPage = returnTo === "compose" ? "compose" : "reminders"
    if (google === "connected") {
      if (returnTo === "settings") {
        setSettingsOpen(true)
        setGoogleNoticeTarget("settings")
      } else {
        setPage(returnPage)
        setGoogleNoticeTarget(returnPage)
      }
      setGoogleNotice({
        type: "success",
        text:
          returnTo === "compose"
            ? "Google connected. You can save drafts and schedule emails."
            : returnTo === "settings"
              ? "Google account connected."
              : "Google Calendar connected.",
      })
    } else if (google === "error") {
      if (returnTo === "settings") {
        setSettingsOpen(true)
        setGoogleNoticeTarget("settings")
      } else {
        setPage(returnPage)
        setGoogleNoticeTarget(returnPage)
      }
      setGoogleNotice({
        type: "error",
        text: params.get("message") || "Could not connect Google account.",
      })
    }
    if (google) {
      window.history.replaceState({}, "", window.location.pathname || "/")
    }
  }, [])

  useEffect(() => {
    function goHome() {
      setPage("dashboard")
    }
    window.addEventListener(GETTING_STARTED_RESTORED_EVENT, goHome)
    return () => window.removeEventListener(GETTING_STARTED_RESTORED_EVENT, goHome)
  }, [])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100%",
        background: "#0a0a0f",
        color: "#f0f0f5",
        fontFamily: font.body,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          background: "#0a0a0f",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
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
              color: "#f0f0f5",
              fontFamily: font.display,
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: "-0.3px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: accentNeon,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GhostBusterLogo size={19} />
            </span>
            GhostBuster
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
                    padding: "12px 14px",
                    margin: 0,
                    border: "none",
                    background: "transparent",
                    color: active ? "#f0f0f5" : "rgba(240,240,245,0.55)",
                    fontSize: 11,
                    fontFamily: font.mono,
                    fontWeight: active ? 600 : 500,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    borderBottom: active ? `2px solid ${accentNeon}` : "2px solid transparent",
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
            <SettingsMenu
              setPage={setPage}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              googleNotice={googleNoticeTarget === "settings" ? googleNotice : null}
              onConsumeGoogleNotice={() => {
                setGoogleNotice(null)
                setGoogleNoticeTarget(null)
              }}
            />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "100%",
          padding: "32px clamp(16px, 3vw, 40px) 48px",
          overflowY: "auto",
          minWidth: 0,
        }}
      >
        {page === "dashboard" && <Dashboard setPage={setPage} />}
        {page === "notifications" && <Notifications setPage={setPage} />}
        {page === "contacts" && <ContactHub />}
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
        {page === "compose" && (
          <MessageComposer
            composePrefill={composePrefill}
            onConsumePrefill={() => setComposePrefill(null)}
            googleNotice={googleNoticeTarget === "compose" ? googleNotice : null}
            onConsumeGoogleNotice={() => {
              setGoogleNotice(null)
              setGoogleNoticeTarget(null)
            }}
          />
        )}
      </main>
    </div>
  )
}
