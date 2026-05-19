import React, { useState } from "react"
import { useSession } from "../SessionContext"
import { font, accentNeon, neonAlpha } from "../theme"
import GhostBusterLogo from "./GhostBusterLogo"

export default function AuthScreen() {
  const { supabase } = useSession()
  const [mode, setMode] = useState("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  function clarifySignInError(msg) {
    const m = (msg || "").toLowerCase()
    if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
      return `${msg}

Common causes: wrong password; or the account exists but email is not confirmed yet (Supabase often shows the same error). In Supabase → Authentication → Users, open your user and confirm the email, or turn off “Confirm email” under Providers → Email. You can also try “Send password reset email” below.`
    }
    return msg || "Something went wrong"
  }

  function clarifySignUpError(msg) {
    const m = (msg || "").toLowerCase()
    if (
      m.includes("already registered") ||
      m.includes("already been registered") ||
      m.includes("user already registered")
    ) {
      return `That email already has an account. Use the Sign in tab with the password you chose. If sign-in says invalid credentials, your email may still be unconfirmed — check the inbox for a Supabase confirmation link, or confirm the user in the Supabase dashboard (Authentication → Users).`
    }
    return msg || "Something went wrong"
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setInfo("")
    if (!supabase) return
    const em = email.trim()
    if (!em || !password) {
      setError("Email and password are required.")
      return
    }
    setBusy(true)
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: em,
          password,
        })
        if (err) throw err
        if (data.user && !data.session) {
          setInfo(
            "Check your email to confirm your account — or disable “Confirm email” under Supabase → Authentication → Providers → Email for quick demos."
          )
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: em,
          password,
        })
        if (err) throw err
      }
    } catch (err) {
      setError(mode === "signup" ? clarifySignUpError(err.message) : clarifySignInError(err.message))
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordReset() {
    setError("")
    setInfo("")
    if (!supabase) return
    const em = email.trim()
    if (!em) {
      setError("Enter your email above, then click this button again.")
      return
    }
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${window.location.origin}/`,
      })
      if (err) throw err
      setInfo(
        "If that email exists, Supabase sent a reset link. Add this redirect URL under Supabase → Authentication → URL Configuration → Redirect URLs: " +
          window.location.origin +
          " (and your Site URL) if the link does not work."
      )
    } catch (err) {
      setError(err.message || "Could not send reset email")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#0a0a0f",
        color: "#f0f0f5",
        fontFamily: font.body,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 28,
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: "-0.03em",
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: accentNeon,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GhostBusterLogo size={24} />
          </span>
          GhostBuster
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 20,
            borderBottom: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {[
            { id: "signin", label: "Sign in" },
            { id: "signup", label: "Create account" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id)
                setError("")
                setInfo("")
              }}
              style={{
                padding: "10px 14px",
                margin: 0,
                border: "none",
                background: "transparent",
                color: mode === t.id ? "#f0f0f5" : "rgba(240,240,245,0.45)",
                fontFamily: font.mono,
                fontSize: 11,
                fontWeight: mode === t.id ? 600 : 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                borderBottom: mode === t.id ? `2px solid ${accentNeon}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              fontFamily: font.mono,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(240,240,245,0.45)",
              marginBottom: 8,
            }}
          >
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.04)",
              color: "#f0f0f5",
              fontFamily: font.body,
              fontSize: 15,
            }}
          />
          <label
            style={{
              display: "block",
              fontFamily: font.mono,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(240,240,245,0.45)",
              marginBottom: 8,
            }}
          >
            Password
          </label>
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginBottom: 20,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.04)",
              color: "#f0f0f5",
              fontFamily: font.body,
              fontSize: 15,
            }}
          />
          {error ? (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(255,107,107,0.12)",
                border: "1px solid rgba(255,107,107,0.35)",
                color: "#ffb4b4",
                fontSize: 14,
                whiteSpace: "pre-line",
              }}
            >
              {error}
            </div>
          ) : null}
          {info ? (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 8,
                background: neonAlpha(0.08),
                border: `1px solid ${neonAlpha(0.25)}`,
                color: "rgba(240,240,245,0.88)",
                fontSize: 13,
                lineHeight: 1.45,
                whiteSpace: "pre-line",
              }}
            >
              {info}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 12,
              border: `1px solid ${neonAlpha(0.35)}`,
              background: accentNeon,
              color: "#0a0f09",
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 15,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.75 : 1,
            }}
          >
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        {mode === "signin" ? (
          <button
            type="button"
            disabled={busy}
            onClick={handlePasswordReset}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "transparent",
              color: "rgba(240,240,245,0.75)",
              fontFamily: font.mono,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Send password reset email
          </button>
        ) : null}
        <p
          style={{
            marginTop: 24,
            fontSize: 12,
            lineHeight: 1.5,
            color: "rgba(240,240,245,0.4)",
          }}
        >
          Your data is tied to this account. For a local demo, use the same Supabase project URL and keys in{" "}
          <code style={{ fontFamily: font.mono, fontSize: 11 }}>.env</code> on this machine as in the README.
        </p>
      </div>
    </div>
  )
}
