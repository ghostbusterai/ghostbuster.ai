import React, { useEffect, useState } from "react"
import { api, BASE } from "../api"
import { font } from "../theme"
import { secondaryBtn, primaryBtn } from "../uiStyles"
import { ContentCard } from "../layout"

/** sessionStorage key App sets when returning from Google's consent screen for this feature. */
export const GMAIL_CONTACTS_RETURN_KEY = "gb-gmail-contacts-return"

function localDateString() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * "Add contacts from Gmail": the on/off switch, the result of the last scan (with Undo), and
 * suggestions to approve. Scanning itself runs on the server with the Gmail follow-up scan.
 */
export default function GmailContacts({ onContactsChanged }) {
  const [enabled, setEnabled] = useState(false)
  const [available, setAvailable] = useState(true) // false for demo accounts / no Google config
  const [suggestions, setSuggestions] = useState([])
  const [busy, setBusy] = useState("") // "", "scan", "toggle", email
  const [result, setResult] = useState(null) // { added, suggested }
  const [error, setError] = useState("")

  async function loadSuggestions() {
    try {
      const { suggestions: list } = await api.getGmailContactSuggestions()
      setSuggestions(list || [])
    } catch (e) {
      if (e.status === 403) setAvailable(false)
    }
  }

  async function scan() {
    setBusy("scan")
    setError("")
    try {
      const r = await api.scanGmailFollowups({ localDate: localDateString() })
      setResult({ added: r.contactsAdded || 0, suggested: r.contactSuggestions || 0 })
      if (r.contactsAdded) onContactsChanged?.()
      await loadSuggestions()
    } catch (e) {
      if (e.data?.needsPermission) setEnabled(false)
      setError(e.message || "Couldn't scan Gmail.")
    } finally {
      setBusy("")
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const status = await api.getGoogleCalendarStatus()
        if (cancelled) return
        if (!status?.configured) return setAvailable(false)
        setEnabled(Boolean(status?.gmailScan?.importContacts))
      } catch {
        if (!cancelled) setAvailable(false)
        return
      }
      await loadSuggestions()
      // Just came back from granting Gmail access: run the first scan now.
      let ret = null
      try {
        ret = JSON.parse(sessionStorage.getItem(GMAIL_CONTACTS_RETURN_KEY) || "null")
        sessionStorage.removeItem(GMAIL_CONTACTS_RETURN_KEY)
      } catch {
        /* ignore */
      }
      if (cancelled || !ret) return
      if (ret.ok) {
        setEnabled(true)
        scan()
      } else {
        setError(ret.message || "Gmail access wasn't granted.")
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggle() {
    setBusy("toggle")
    setError("")
    try {
      await api.setGmailContactImport(!enabled)
      const next = !enabled
      setEnabled(next)
      setBusy("")
      if (next) scan()
    } catch (e) {
      setBusy("")
      if (e.data?.needsPermission && e.data.authUrl) {
        window.location.href = `${BASE}${e.data.authUrl}`
        return
      }
      setError(e.message || "Couldn't change the setting.")
    }
  }

  async function undo() {
    setBusy("undo")
    try {
      const { removed } = await api.undoGmailContactImport()
      setResult((r) => (r ? { ...r, added: 0, undone: removed } : r))
      onContactsChanged?.()
    } catch (e) {
      setError(e.message || "Couldn't undo.")
    } finally {
      setBusy("")
    }
  }

  async function add(email) {
    setBusy(email)
    try {
      await api.addGmailContactSuggestion(email)
      setSuggestions((list) => list.filter((s) => s.email !== email))
      onContactsChanged?.()
    } catch (e) {
      setError(e.message || "Couldn't add.")
    } finally {
      setBusy("")
    }
  }

  async function dismiss(email) {
    setBusy(email)
    try {
      await api.dismissGmailContactSuggestion(email)
      setSuggestions((list) => list.filter((s) => s.email !== email))
    } catch (e) {
      setError(e.message || "Couldn't dismiss.")
    } finally {
      setBusy("")
    }
  }

  async function addAll() {
    for (const s of suggestions) await add(s.email)
  }

  if (!available) return null

  return (
    <ContentCard>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: font.h1, fontWeight: 700, color: "var(--gb-text-strong)" }}>
            Add contacts from Gmail {enabled ? "· on" : ""}
          </div>
          <div style={{ fontSize: 13, color: "var(--gb-text-muted)", marginTop: 4, lineHeight: 1.5 }}>
            Adds people you've emailed back and forth with about work or school in the last 90 days. Sender, subject
            and Gmail's short preview are sent to Claude to tell them apart from personal mail; full emails are never
            read or stored.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {enabled && (
            <button type="button" onClick={scan} disabled={Boolean(busy)} style={secondaryBtn()}>
              {busy === "scan" ? "Checking Gmail…" : "Scan now"}
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            disabled={Boolean(busy)}
            style={enabled ? secondaryBtn() : primaryBtn()}
          >
            {enabled ? "Turn off" : "Turn on"}
          </button>
        </div>
      </div>

      {busy === "scan" && (
        <p style={{ fontSize: 13, color: "var(--gb-text-muted)", margin: "10px 0 0" }}>
          Reading your recent conversations. This can take a minute.
        </p>
      )}
      {error && <p style={{ color: "var(--gb-danger)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
      {result && busy !== "scan" && (
        <p style={{ fontSize: 13, color: "var(--gb-text)", margin: "10px 0 0" }}>
          {result.undone != null
            ? `Removed ${result.undone} ${result.undone === 1 ? "person" : "people"} added from Gmail.`
            : `Added ${result.added} ${result.added === 1 ? "person" : "people"} from Gmail.`}
          {result.added > 0 && result.undone == null && (
            <>
              {" "}
              <button
                type="button"
                onClick={undo}
                disabled={Boolean(busy)}
                style={{ background: "none", border: "none", padding: 0, color: "var(--gb-accent)", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}
              >
                Undo
              </button>
            </>
          )}
          {result.suggested > 0 && ` ${result.suggested} more to review below.`}
        </p>
      )}

      {suggestions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "var(--gb-text-faint)", flex: 1, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: font.mono }}>
              Found in your Gmail
            </div>
            <button type="button" onClick={addAll} disabled={Boolean(busy)} style={{ ...secondaryBtn(), padding: "4px 10px", fontSize: 12 }}>
              Add all
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((s) => (
              <div
                key={s.email}
                style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", border: "1px solid var(--gb-border-subtle)", borderRadius: 10, padding: "8px 10px", background: "var(--gb-bg-panel)" }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, color: "var(--gb-text-strong)", fontSize: 14 }}>
                    {s.name || s.email}
                    {(s.role || s.company) && (
                      <span style={{ fontWeight: 400, color: "var(--gb-text-muted)" }}> · {[s.role, s.company].filter(Boolean).join(", ")}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gb-text-muted)" }}>{s.reason || s.email}</div>
                </div>
                <button type="button" onClick={() => add(s.email)} disabled={Boolean(busy)} style={{ ...secondaryBtn(), padding: "4px 10px", fontSize: 12 }}>
                  Add
                </button>
                <button type="button" onClick={() => dismiss(s.email)} disabled={Boolean(busy)} style={{ ...secondaryBtn(), padding: "4px 10px", fontSize: 12, opacity: 0.75 }}>
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </ContentCard>
  )
}
