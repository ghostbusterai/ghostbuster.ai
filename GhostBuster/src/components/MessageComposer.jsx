import React, { useState, useEffect } from "react"
import { api } from "../api"
import { font } from "../theme"

const SITUATIONS = [
  "Cold outreach — never met",
  "Follow up after career fair",
  "Follow up after coffee chat",
  "Reconnecting after a while",
  "Sharing a resume update",
  "Sharing a new accomplishment",
  "Asking for a referral",
  "Thanking after an interview",
  "Checking in on application status",
]

const TONES = [
  "Warm & professional (balanced)",
  "Formal & concise",
  "Friendly & conversational",
  "Casual (still respectful)",
  "Enthusiastic / upbeat",
  "Direct & minimal",
]

export default function MessageComposer({ composePrefill = null, onConsumePrefill = () => {} }) {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState("")
  const [situation, setSituation] = useState("")
  const [tone, setTone] = useState(TONES[0])
  const [purpose, setPurpose] = useState("")
  const [extraContext, setExtraContext] = useState("")
  const [previousCommunication, setPreviousCommunication] = useState("")
  const [yourBackground, setYourBackground] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { contacts: list } = await api.getContacts()
        if (!cancelled) setContacts(list)
      } catch {
        if (!cancelled) setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const contact = contacts.find(c => c.id === Number(selectedContact))

  useEffect(() => {
    if (!composePrefill) return
    const p = composePrefill
    if (p.contactId != null && p.contactId !== "") setSelectedContact(String(p.contactId))
    if (p.situation) setSituation(p.situation)
    if (p.tone) setTone(p.tone)
    if (p.purpose !== undefined) setPurpose(p.purpose ?? "")
    if (p.extraContext !== undefined) setExtraContext(p.extraContext ?? "")
    if (p.yourBackground !== undefined) setYourBackground(p.yourBackground ?? "")
    if (p.previousCommunication !== undefined) setPreviousCommunication(p.previousCommunication ?? "")
    if (p.preGeneratedResult) {
      setResult(p.preGeneratedResult)
      setError(null)
      setLoading(false)
    }
    onConsumePrefill?.()
  }, [composePrefill, onConsumePrefill])

  async function compose() {
    if (!situation) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const data = await api.compose({
        contactInfo: contact
          ? [
              `Name: ${contact.name}`,
              `Company: ${contact.company || "unknown"}`,
              `Role: ${contact.role || "unknown"}`,
              `LinkedIn: ${contact.linkedin || "none"}`,
              `Website: ${contact.website || "none"}`,
              `Notes: ${contact.notes || "none"}`,
            ].join(", ")
          : null,
        situation,
        tone,
        purpose,
        yourBackground,
        previousCommunication,
        extraContext,
      })
      setResult(data.result)
    } catch (err) {
      setError(err.message || "Could not connect to server. Make sure it's running.")
    }

    setLoading(false)
  }

  function copy() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle = {
    background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "10px 14px", color: "#f0f0f5",
    fontSize: 14, fontFamily: font.body, width: "100%", outline: "none",
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontFamily: font.mono, letterSpacing: "0.14em", color: "rgba(240,240,245,0.3)", textTransform: "uppercase", marginBottom: 8 }}>AI Powered</div>
        <h1 style={{ fontFamily: font.display, fontWeight: 800, fontSize: 36, letterSpacing: "-1px", marginBottom: 8 }}>Message Composer</h1>
        <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, fontFamily: font.body }}>Generate a personalized outreach message in seconds.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 32, width: "100%" }}>

        {/* Left — Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Contact picker */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>CONTACT (optional)</label>
            <select
              value={selectedContact}
              onChange={e => {
                setSelectedContact(e.target.value)
                setPreviousCommunication("")
              }}
              style={inputStyle}
            >
              <option value="">No specific contact</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `— ${c.company}` : ""}</option>)}
            </select>
            {contact && (
              <div style={{
                marginTop: 10, padding: "12px 14px", borderRadius: 9,
                background: "rgba(184,255,87,0.05)", border: "1px solid rgba(184,255,87,0.15)",
                fontSize: 13, color: "rgba(240,240,245,0.55)", lineHeight: 1.6
              }}>
                {contact.role && <div>🏷 {contact.role}</div>}
                {contact.company && <div>🏢 {contact.company}</div>}
                {contact.notes && <div>📝 {contact.notes}</div>}
              </div>
            )}
          </div>

          {/* Situation */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>SITUATION *</label>
            <select value={situation} onChange={e => setSituation(e.target.value)} style={inputStyle}>
              <option value="">Select a situation...</option>
              {SITUATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Tone */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>TONE</label>
            <select value={tone} onChange={e => setTone(e.target.value)} style={inputStyle}>
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>PURPOSE</label>
            <p style={{ fontSize: 12, color: "rgba(240,240,245,0.28)", margin: "0 0 8px 0", lineHeight: 1.55 }}>
              What you want from this message (e.g. schedule a call, ask for advice, confirm next steps). The draft will aim toward that outcome without being pushy.
            </p>
            <textarea
              placeholder="e.g. Land a 20-minute coffee chat to learn about their team’s intern pipeline and whether they’d take a quick résumé glance."
              value={purpose} onChange={e => setPurpose(e.target.value)}
              style={{ ...inputStyle, height: 80, resize: "vertical" }}
            />
          </div>

          {/* Your background */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>YOUR BACKGROUND</label>
            <textarea
              placeholder="e.g. Junior at CMU studying Computer Science, interested in product management..."
              value={yourBackground} onChange={e => setYourBackground(e.target.value)}
              style={{ ...inputStyle, height: 80, resize: "vertical" }}
            />
          </div>

          {/* Previous communication */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>PREVIOUS COMMUNICATION</label>
            <p style={{ fontSize: 12, color: "rgba(240,240,245,0.28)", margin: "0 0 8px 0", lineHeight: 1.55 }}>
              Paste full threads or detailed notes — the more concrete, the better. Include their wording when you can, open questions, what you promised, and dates they gave. The draft will reference those specifics (up to ~200 words when you add history here).
            </p>
            <textarea
              placeholder={"e.g.\nThem (Mar 2): \"Happy to chat after my team’s release — try me mid-April.\"\nMe: Asked about interning on X team.\nThem: Suggested I look at the roles page and send a resume + 2 bullets on the ML project we discussed."}
              value={previousCommunication} onChange={e => setPreviousCommunication(e.target.value)}
              style={{ ...inputStyle, height: 140, minHeight: 96, resize: "vertical", lineHeight: 1.45 }}
            />
          </div>

          {/* Extra context */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>EXTRA CONTEXT</label>
            <textarea
              placeholder="e.g. We met at the Google career fair, talked about their ML team..."
              value={extraContext} onChange={e => setExtraContext(e.target.value)}
              style={{ ...inputStyle, height: 80, resize: "vertical" }}
            />
          </div>

          <button
            onClick={compose}
            disabled={!situation || loading}
            style={{
              background: situation && !loading ? "#b8ff57" : "rgba(184,255,87,0.2)",
              color: situation && !loading ? "#0a0f09" : "rgba(184,255,87,0.4)",
              border: situation && !loading ? "1px solid rgba(10,15,9,0.22)" : "1px solid rgba(184,255,87,0.2)",
              boxShadow: "none",
              padding: "13px 28px",
              borderRadius: 10,
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 15,
              cursor: situation && !loading ? "pointer" : "not-allowed",
              transition: "background 0.15s, border-color 0.15s, color 0.15s",
            }}
          >
            {loading ? "Composing..." : "✨ Generate Message"}
          </button>
        </div>

        {/* Right — Output */}
        <div>
          <label style={{ fontSize: 12, fontFamily: font.mono, color: "rgba(240,240,245,0.4)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>GENERATED MESSAGE</label>
          {result && !loading && (
            <p style={{ fontSize: 12, color: "rgba(240,240,245,0.28)", margin: "0 0 8px 0", lineHeight: 1.45 }}>
              Edit the draft below before copying or sending.
            </p>
          )}
          <div style={{
            background: "#111118", border: `1px solid ${result ? "rgba(184,255,87,0.2)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: 14, padding: result && !loading ? 16 : 24, minHeight: 320,
            display: "flex", flexDirection: "column", justifyContent: result && !loading ? "flex-start" : "center",
            alignItems: result && !loading ? "stretch" : "center",
          }}>
            {loading && (
              <div style={{ textAlign: "center", color: "rgba(240,240,245,0.3)" }}>
                <div style={{ fontSize: 28, marginBottom: 12, animation: "spin 1s linear infinite" }}>✨</div>
                <div style={{ fontSize: 14, fontFamily: font.mono }}>Composing your message...</div>
              </div>
            )}

            {error && (
              <div style={{ color: "#ff6b6b", fontSize: 14, lineHeight: 1.6 }}>
                ⚠ {error}
              </div>
            )}

            {result && !loading && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  aria-label="Generated message — editable"
                  style={{
                    ...inputStyle,
                    flex: 1,
                    minHeight: 260,
                    fontFamily: font.mono,
                    fontSize: 13,
                    lineHeight: 1.8,
                    resize: "vertical",
                    border: "1px solid rgba(184,255,87,0.15)",
                    background: "#0a0a0f",
                  }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={copy} style={{
                    background: copied ? "rgba(184,255,87,0.15)" : "rgba(255,255,255,0.05)",
                    border: "1px solid", borderColor: copied ? "rgba(184,255,87,0.3)" : "rgba(255,255,255,0.1)",
                    color: copied ? "#b8ff57" : "rgba(240,240,245,0.6)",
                    padding: "8px 18px", borderRadius: 8, fontSize: 13,
                    cursor: "pointer", fontFamily: font.mono, transition: "all 0.15s",
                    boxShadow: "none",
                  }}>
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                  <button onClick={compose} style={{
                    background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(240,240,245,0.4)", padding: "8px 18px", borderRadius: 8,
                    fontSize: 13, cursor: "pointer", fontFamily: font.mono,
                    boxShadow: "none",
                  }}>Regenerate</button>
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div style={{ textAlign: "center", color: "rgba(240,240,245,0.2)", fontSize: 14, fontFamily: font.mono }}>
                Your message will appear here
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
