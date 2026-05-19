import React, { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import { suggestContactsForUpdate } from "../updateRelevance"
import { font } from "../theme"

const LS_UPDATES = "gb_resume_updates"
const LS_PROFILE = "gb_profile"

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
}

function mergeProfileLastResume(effectiveDate) {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PROFILE) || "{}")
    const prev = raw.lastResumeUpdate || ""
    if (!prev || effectiveDate > prev) {
      raw.lastResumeUpdate = effectiveDate
      localStorage.setItem(LS_PROFILE, JSON.stringify(raw))
    }
  } catch {
    /* ignore */
  }
}

export default function Updates({ setPage, setComposePrefill }) {
  const [updates, setUpdates] = useState([])
  const [contacts, setContacts] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [details, setDetails] = useState("")
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [relevanceModal, setRelevanceModal] = useState(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [{ updates: u }, { contacts: c }] = await Promise.all([
        api.getResumeUpdates(),
        api.getContacts(),
      ])
      setUpdates(u || [])
      setContacts(c || [])
      localStorage.setItem(LS_UPDATES, JSON.stringify(u || []))
      localStorage.setItem("gb_contacts", JSON.stringify(c || []))
    } catch (e) {
      setLoadError(e.message)
      setUpdates(JSON.parse(localStorage.getItem(LS_UPDATES) || "[]"))
      setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!relevanceModal) return
    function onKey(e) {
      if (e.key === "Escape") setRelevanceModal(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [relevanceModal])

  async function saveUpdate(e) {
    e.preventDefault()
    if (!title.trim() || !details.trim()) return
    setActionError(null)
    setSaving(true)
    const payload = {
      title: title.trim(),
      details: details.trim(),
      effectiveDate,
    }
    const haystack = `${payload.title}\n${payload.details}`

    try {
      const { update, relevance } = await api.createResumeUpdate(payload)
      setUpdates((prev) => {
        const next = [update, ...prev]
        localStorage.setItem(LS_UPDATES, JSON.stringify(next))
        return next
      })
      mergeProfileLastResume(update.effectiveDate)
      setTitle("")
      setDetails("")
      setEffectiveDate(new Date().toISOString().slice(0, 10))
      if (relevance && relevance.length > 0) {
        setRelevanceModal({ update, relevance })
      }
    } catch (err) {
      if (loadError) {
        const update = {
          id: Date.now(),
          title: payload.title,
          details: payload.details,
          effectiveDate: payload.effectiveDate,
          createdAt: new Date().toISOString(),
        }
        const relevance = suggestContactsForUpdate(contacts, haystack)
        const next = [update, ...updates]
        setUpdates(next)
        localStorage.setItem(LS_UPDATES, JSON.stringify(next))
        mergeProfileLastResume(update.effectiveDate)
        setTitle("")
        setDetails("")
        setEffectiveDate(new Date().toISOString().slice(0, 10))
        if (relevance.length > 0) setRelevanceModal({ update, relevance })
      } else {
        setActionError(err.message)
      }
    }
    setSaving(false)
  }

  async function remove(id) {
    setActionError(null)
    try {
      await api.deleteResumeUpdate(id)
      setUpdates((prev) => prev.filter((u) => u.id !== id))
      const next = updates.filter((u) => u.id !== id)
      localStorage.setItem(LS_UPDATES, JSON.stringify(next))
    } catch (err) {
      if (loadError) {
        const next = updates.filter((u) => u.id !== id)
        setUpdates(next)
        localStorage.setItem(LS_UPDATES, JSON.stringify(next))
      } else {
        setActionError(err.message)
      }
    }
  }

  function openComposeForContact(row, update) {
    setComposePrefill({
      contactId: row.contactId,
      situation: "Sharing a resume update",
      tone: "Warm & professional (balanced)",
      purpose:
        "Briefly summarize this career/résumé update, tie it to why I'm writing them (using the relevance hints), and suggest a light next step.",
      extraContext: `Update: "${update.title}" (effective ${update.effectiveDate}).\nWhy GhostBuster flagged them: ${row.reasons.join(" ")}`,
    })
    setRelevanceModal(null)
    setPage("compose")
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: font.mono,
            letterSpacing: "0.14em",
            color: "rgba(240,240,245,0.3)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Résumé updates
        </div>
        <h1
          style={{
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 36,
            letterSpacing: "-1px",
            marginBottom: 8,
          }}
        >
          Resume updates
        </h1>
        <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, maxWidth: 680, lineHeight: 1.55, fontFamily: font.body }}>
          Log résumé or career changes here. We scan your text against contact cards (company, role, notes, website)
          and, when something lines up, show a heads-up so you can reach out with context.
        </p>
        {loadError && (
          <p style={{ color: "#ffc96b", fontSize: 13, marginTop: 10 }}>
            API offline — saving locally. Run the server to sync and use the same relevance rules on the backend.
          </p>
        )}
        {actionError && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{actionError}</p>}
      </div>

      <div
        style={{
          background: "#111118",
          border: "1px solid rgba(184,255,87,0.15)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 36,
        }}
      >
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, marginBottom: 16 }}>
          New update
        </div>
        <form onSubmit={saveUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              style={{
                fontSize: 11,
                fontFamily: font.mono,
                color: "rgba(240,240,245,0.4)",
                display: "block",
                marginBottom: 6,
              }}
            >
              TITLE *
            </label>
            <input
              placeholder="e.g. Added ML internship, shipped dashboard redesign"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label
                style={{
                  fontSize: 11,
                  fontFamily: font.mono,
                  color: "rgba(240,240,245,0.4)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                EFFECTIVE DATE
              </label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label
              style={{
                fontSize: 11,
                fontFamily: font.mono,
                color: "rgba(240,240,245,0.4)",
                display: "block",
                marginBottom: 6,
              }}
            >
              DETAILS * (used to match companies, roles, and your notes on contacts)
            </label>
            <textarea
              placeholder="Paste bullet points, new skills, company names, project keywords… The more specific, the better the contact matches."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={7}
              style={{ ...inputStyle, resize: "vertical", minHeight: 140 }}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !title.trim() || !details.trim()}
            style={{
              alignSelf: "flex-start",
              background: saving || !title.trim() || !details.trim() ? "rgba(184,255,87,0.2)" : "#b8ff57",
              color: saving || !title.trim() || !details.trim() ? "rgba(184,255,87,0.4)" : "#0a0f09",
              border: saving || !title.trim() || !details.trim() ? "1px solid rgba(184,255,87,0.25)" : "1px solid rgba(10,15,9,0.22)",
              boxShadow: "none",
              padding: "11px 22px",
              borderRadius: 9,
              fontWeight: 700,
              cursor: saving || !title.trim() || !details.trim() ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save update"}
          </button>
        </form>
      </div>

      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, marginBottom: 14 }}>
        History
      </div>
      {loading ? (
        <div style={{ color: "rgba(240,240,245,0.35)" }}>Loading…</div>
      ) : updates.length === 0 ? (
        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: 36,
            textAlign: "center",
            color: "rgba(240,240,245,0.35)",
          }}
        >
          No updates yet — add your first one above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {updates.map((u) => (
            <div
              key={u.id}
              style={{
                background: "#111118",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "18px 20px",
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{u.title}</div>
                <div style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(184,255,87,0.65)", marginTop: 6 }}>
                  Effective {u.effectiveDate || "—"}
                  {u.createdAt ? ` · logged ${new Date(u.createdAt).toLocaleDateString()}` : ""}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 14,
                    color: "rgba(240,240,245,0.55)",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {u.details}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(u.id)}
                style={{
                  flexShrink: 0,
                  background: "transparent",
                  border: "1px solid rgba(255,107,107,0.35)",
                  color: "#ff6b6b",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: "pointer",
                  boxShadow: "none",
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {relevanceModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rel-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 220,
            background: "rgba(6,6,10,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setRelevanceModal(null)}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              maxHeight: "min(85vh, 640px)",
              background: "#111118",
              border: "1px solid rgba(255,201,107,0.35)",
              borderRadius: 18,
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div
                id="rel-title"
                style={{
                  fontFamily: font.display,
                  fontWeight: 800,
                  fontSize: 21,
                  letterSpacing: "-0.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 26 }}>✦</span> Heads-up
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 14, color: "rgba(240,240,245,0.5)", lineHeight: 1.5 }}>
                This update may be worth sharing with these people — we matched keywords from your text to their
                company, role, notes, or website.
              </p>
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(184,255,87,0.06)",
                  border: "1px solid rgba(184,255,87,0.12)",
                  fontSize: 13,
                  color: "rgba(240,240,245,0.75)",
                }}
              >
                <strong style={{ color: "#b8ff57" }}>{relevanceModal.update.title}</strong>
              </div>
            </div>
            <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
              {relevanceModal.relevance.map((row) => (
                <div
                  key={row.contactId}
                  style={{
                    marginBottom: 16,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{row.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(240,240,245,0.4)", marginTop: 2 }}>
                    {[row.role, row.company].filter(Boolean).join(" @ ") || "—"}
                  </div>
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "rgba(240,240,245,0.65)", fontSize: 13, lineHeight: 1.5 }}>
                    {row.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => openComposeForContact(row, relevanceModal.update)}
                    style={{
                      marginTop: 12,
                      background: "rgba(184,255,87,0.12)",
                      border: "1px solid rgba(184,255,87,0.35)",
                      color: "#b8ff57",
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: font.body,
                      boxShadow: "none",
                    }}
                  >
                    Draft message for {row.name.split(/\s+/)[0] || row.name} →
                  </button>
                </div>
              ))}
            </div>
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setRelevanceModal(null)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#f0f0f5",
                  padding: "9px 18px",
                  borderRadius: 9,
                  fontSize: 13,
                  cursor: "pointer",
                  boxShadow: "none",
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
