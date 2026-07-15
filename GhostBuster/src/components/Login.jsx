import React from "react"
import { font, accentNeon } from "../theme"
import GhostBusterLogo from "./GhostBusterLogo"
import { BASE } from "../api"

export default function Login({ error }) {
  const loginHref = `${BASE}/api/auth/google`

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(184,255,87,0.14), transparent 55%),
          radial-gradient(ellipse 60% 40% at 100% 100%, rgba(110,181,255,0.08), transparent 50%),
          #0a0a0f
        `,
        color: "#f0f0f5",
        fontFamily: font.body,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: accentNeon,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GhostBusterLogo size={28} />
          </span>
          <span
            style={{
              fontFamily: font.display,
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: "-0.4px",
            }}
          >
            GhostBuster
          </span>
        </div>

        <h1
          style={{
            margin: "0 0 12px",
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: "clamp(22px, 4vw, 28px)",
            letterSpacing: "-0.4px",
            lineHeight: 1.25,
          }}
        >
          Your networking assistant
        </h1>
        <p
          style={{
            margin: "0 0 32px",
            fontSize: 15,
            lineHeight: 1.55,
            color: "rgba(240,240,245,0.55)",
          }}
        >
          Sign in to save contacts, draft outreach, and keep follow-ups on track — private to your account.
        </p>

        {error && (
          <p
            style={{
              margin: "0 0 20px",
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(255,107,107,0.12)",
              border: "1px solid rgba(255,107,107,0.28)",
              color: "#ff8a8a",
              fontSize: 13,
              lineHeight: 1.45,
              textAlign: "left",
            }}
          >
            {error}
          </p>
        )}

        <a
          href={loginHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 20px",
            borderRadius: 10,
            background: "#fff",
            color: "#1f1f1f",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 15,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
          }}
        >
          <GoogleMark />
          Continue with Google
        </a>

        <p
          style={{
            margin: "20px 0 0",
            fontSize: 12,
            color: "rgba(240,240,245,0.35)",
            lineHeight: 1.45,
          }}
        >
          After signing in you can optionally connect Gmail & Calendar for drafts and reminders.
        </p>
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
