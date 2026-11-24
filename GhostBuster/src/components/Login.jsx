import React, { useEffect, useRef, useState } from "react"
import { initScrollReveal } from "../scrollReveal"
import GhostBusterLogo from "./GhostBusterLogo"
import BrandName from "./BrandName"
import CinematicBackground from "./CinematicBackground"
import NetworkingSuccessReel from "./NetworkingSuccessReel"
import { font, accentNeon } from "../theme"
import { BASE, api } from "../api"
import { Icon } from "../icons"

const REVIEWER_DEMO_CODE = "app-reviewer"

export default function Login({ error, onDemoLogin }) {
  const loginScrollRef = useRef(null)
  const loginHref = `${BASE}/api/auth/google`
  const apiDown =
    typeof error === "string" &&
    /connection failed|API isn't running|Can't reach API|not reachable|timed out/i.test(error)
  const [demoEnabled, setDemoEnabled] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoCode, setDemoCode] = useState("")
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoError, setDemoError] = useState(null)

  useEffect(() => {
    api
      .getDemoStatus()
      .then((d) => setDemoEnabled(Boolean(d.enabled)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const root = loginScrollRef.current
    if (!root) return () => {}
    let teardown = () => {}
    const raf = requestAnimationFrame(() => {
      teardown = initScrollReveal(root)
    })
    return () => {
      cancelAnimationFrame(raf)
      teardown()
    }
  }, [])

  async function startDemo(e) {
    e.preventDefault()
    if (!demoCode.trim()) return
    setDemoBusy(true)
    setDemoError(null)
    try {
      const { user } = await api.demoLogin(demoCode.trim())
      onDemoLogin?.(user)
    } catch (err) {
      setDemoError(err.message)
    } finally {
      setDemoBusy(false)
    }
  }

  return (
    <div className="gb-app gb-app--fullscreen gb-app--cinema" style={{ color: "var(--gb-text)", fontFamily: font.body }}>
      <CinematicBackground />
      <div ref={loginScrollRef} className="gb-app-content gb-login-scroll">
        <section className="gb-login-hero gb-login-hero--mission gb-scroll-reveal" aria-label="Sign in to GhostBuster">
          <div className="gb-login-mission gb-reveal-stagger">
            <div className="gb-login-mission__brand">
              <GhostBusterLogo size={32} />
              <BrandName variant="login" />
            </div>

            <p className="gb-mission-eyebrow">Networking assistant · Beta</p>
            <h1 className="gb-mission-title gb-reveal-line">
              <span>Turn intros into offers</span>
            </h1>
            <p className="gb-mission-lede">
              Save contacts, draft outreach, and keep follow-ups on track — private to your account.
            </p>

            {error && (
              <p className="gb-login-alert" role="alert">
                {error}
              </p>
            )}

            {apiDown ? (
              <div className="gb-btn gb-btn--outline gb-btn--outline-light gb-btn--disabled" aria-disabled="true">
                <GoogleMark />
                Continue with Google
              </div>
            ) : (
              <a href={loginHref} className="gb-btn gb-btn--outline gb-btn--outline-light">
                <GoogleMark />
                Continue with Google
                <Icon name="chevron-right" size={14} className="gb-btn__arrow" />
              </a>
            )}

            {demoEnabled && !apiDown && (
              <div className="gb-login-demo" style={{ marginTop: 14, textAlign: "left", width: "100%" }}>
                {demoOpen ? (
                  <form onSubmit={startDemo} style={{ display: "flex", gap: 8 }}>
                    <input
                      value={demoCode}
                      onChange={(e) => setDemoCode(e.target.value)}
                      placeholder="Demo access code"
                      aria-label="Demo access code"
                      autoFocus
                      className="gb-input gb-input--glass"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <button type="submit" disabled={demoBusy} className="gb-btn gb-btn--primary" style={{ flexShrink: 0 }}>
                      {demoBusy ? "Starting…" : "Try demo"}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="gb-btn gb-btn--ghost gb-btn--block"
                    onClick={() => {
                      setDemoCode((c) => c || REVIEWER_DEMO_CODE)
                      setDemoOpen(true)
                    }}
                  >
                    Have a demo code? Try GhostBuster without Google
                  </button>
                )}
                {demoError && <p className="gb-login-alert" style={{ marginTop: 8 }}>{demoError}</p>}
                <p className="gb-mission-footnote" style={{ marginTop: 10, textAlign: "center" }}>
                  Application reviewers: use demo code{" "}
                  <code
                    style={{
                      color: accentNeon,
                      fontWeight: 700,
                      fontSize: 14,
                      padding: "1px 6px",
                      borderRadius: 6,
                      background: "rgba(184,255,87,0.12)",
                    }}
                  >
                    {REVIEWER_DEMO_CODE}
                  </code>
                </p>
              </div>
            )}

            <div className="gb-login-glass" role="note">
              <div className="gb-login-glass__label">Beta privacy notice</div>
              <p className="gb-login-glass__body">
                GhostBuster stores account info from Google sign-in (name, email, profile photo) plus the data you add:
                contacts, notes, reminders, outreach logs, résumés, and applications. If you connect
                Gmail or Calendar, we store tokens so we can save drafts, schedule sends, and sync reminders. AI features
                may send relevant text you provide to our AI provider to generate drafts and summaries. Your data stays in
                your account and is intended only for beta testing.
              </p>
            </div>

            <p className="gb-mission-footnote">
              After signing in you can optionally connect Gmail & Calendar for drafts and reminders.
            </p>
          </div>

          <a href="#networking-wins" className="gb-login-scroll-hint">
            Example journeys — scroll
            <Icon name="chevron-down" size={16} className="gb-login-scroll-hint__arrow" />
          </a>
        </section>

        <div className="gb-scroll-reveal">
          <NetworkingSuccessReel id="networking-wins" variant="scroll" />
        </div>
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.1 39.4 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.6 5.7-6.7 7.1l.1.1 6.3 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  )
}