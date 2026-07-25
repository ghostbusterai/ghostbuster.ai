import React, { useState, useEffect, useMemo } from "react"
import { api, BASE } from "../api"
import { font } from "../theme"
import { inputStyle } from "../uiStyles"
import { PageShell, PageHero, ContentCard, CardTitle } from "../layout"
import { COMPOSE_TONES, readPreferences } from "../preferences"
import { readLocalProfile } from "../profile"
import {
  COMPOSE_SITUATIONS,
  getScenarioConfig,
  generateScenarioTemplateMessage,
} from "../composeScenarios"

function defaultScheduleLocal() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatScheduleLabel(isoOrLocal) {
  const d = new Date(isoOrLocal)
  if (Number.isNaN(d.getTime())) return isoOrLocal
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function MessageComposer({
  composePrefill = null,
  onConsumePrefill = () => {},
  googleNotice = null,
  onConsumeGoogleNotice = () => {},
}) {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState("")
  const [situation, setSituation] = useState("")
  const [tone, setTone] = useState(() => readPreferences().defaultComposeTone)
  const [purpose, setPurpose] = useState("")
  const [extraContext, setExtraContext] = useState("")
  const [previousCommunication, setPreviousCommunication] = useState("")
  const [yourBackground, setYourBackground] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState("")
  const [scheduleAt, setScheduleAt] = useState("")
  const [googleStatus, setGoogleStatus] = useState({ connected: false, configured: false })
  const [googleLoading, setGoogleLoading] = useState(true)
  const [gmailBusy, setGmailBusy] = useState(null)
  const [gmailNotice, setGmailNotice] = useState(null)
  const [gmailError, setGmailError] = useState(null)
  const [exampleNotice, setExampleNotice] = useState(null)

  const scenarioConfig = useMemo(() => getScenarioConfig(situation), [situation])

  useEffect(() => {
    const prefs = readPreferences()
    if (!prefs.prefillBackgroundFromGoals) return
    const goals = readLocalProfile().careerGoals?.trim()
    if (goals) setYourBackground((prev) => prev || goals)
  }, [])

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
    let cancelled = false
    ;(async () => {
      try {
        const status = await api.getGoogleCalendarStatus()
        if (!cancelled) setGoogleStatus(status)
      } catch {
        if (!cancelled) setGoogleStatus({ connected: false, configured: false })
      } finally {
        if (!cancelled) setGoogleLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!googleNotice) return
    setGmailNotice(googleNotice)
    onConsumeGoogleNotice()
    api.getGoogleCalendarStatus().then(setGoogleStatus).catch(() => {})
  }, [googleNotice, onConsumeGoogleNotice])

  useEffect(() => {
    if (contact?.email) setRecipientEmail(contact.email)
    else if (!selectedContact) setRecipientEmail("")
  }, [selectedContact, contact?.email])

  useEffect(() => {
    if (result && !scheduleAt) setScheduleAt(defaultScheduleLocal())
  }, [result, scheduleAt])

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

  async function runCompose(overrides = {}) {
    const sit = overrides.situation ?? situation
    if (!sit) return

    const config = getScenarioConfig(sit)
    const purposeVal = overrides.purpose ?? purpose ?? config?.purposeExample ?? ""
    const extraVal = overrides.extraContext ?? extraContext ?? config?.extraContextExample ?? ""
    const toneVal = overrides.tone ?? tone
    const bgVal = overrides.yourBackground ?? yourBackground
    const prevVal = overrides.previousCommunication ?? previousCommunication
    const contactForCompose = overrides.contact ?? contact

    setLoading(true)
    setResult(null)
    setError(null)
    setExampleNotice(null)

    const composeBody = {
      contactInfo: contactForCompose
        ? [
            `Name: ${contactForCompose.name}`,
            `Company: ${contactForCompose.company || "unknown"}`,
            `Role: ${contactForCompose.role || "unknown"}`,
            `LinkedIn: ${contactForCompose.linkedin || "none"}`,
            `Website: ${contactForCompose.website || "none"}`,
            `Notes: ${contactForCompose.notes || "none"}`,
          ].join(", ")
        : null,
      situation: sit,
      tone: toneVal,
      purpose: purposeVal,
      yourBackground: bgVal,
      previousCommunication: prevVal,
      extraContext: extraVal,
    }

    try {
      const data = await api.compose(composeBody)
      setResult(data.result)
    } catch (err) {
      const template = generateScenarioTemplateMessage(sit, {
        contact: contactForCompose,
        yourBackground: bgVal,
        purpose: purposeVal,
        extraContext: extraVal,
      })
      setResult(template)
      const aiUnavailable =
        err.message?.includes("503") ||
        err.message?.includes("not configured") ||
        err.message?.includes("ANTHROPIC")
      if (aiUnavailable) {
        setExampleNotice("AI is offline — loaded an editable starter template for this scenario. Customize it below.")
      } else {
        setError(err.message || "Could not connect to server. Showing a starter template you can edit.")
      }
    }

    setLoading(false)
  }

  async function compose() {
    await runCompose()
  }

  function applyExampleFields() {
    if (!scenarioConfig) return
    setPurpose(scenarioConfig.purposeExample || "")
    setExtraContext(scenarioConfig.extraContextExample || "")
  }

  async function selectScenario(s) {
    const config = getScenarioConfig(s)
    setSituation(s)
    setResult(null)
    setError(null)
    setExampleNotice(null)
    if (config) {
      setPurpose(config.purposeExample || "")
      setExtraContext(config.extraContextExample || "")
    }
    const contactForCompose = contacts.find((c) => c.id === Number(selectedContact))
    await runCompose({
      situation: s,
      purpose: config?.purposeExample || "",
      extraContext: config?.extraContextExample || "",
      contact: contactForCompose,
    })
  }

  function copy() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function connectGoogle() {
    window.location.href = `${BASE}/api/google/auth?returnTo=compose`
  }

  async function refreshGoogleStatus() {
    try {
      const status = await api.getGoogleCalendarStatus()
      setGoogleStatus(status)
      return status
    } catch {
      setGoogleStatus({ connected: false, configured: false })
      return { connected: false, configured: false }
    }
  }

  function handleGmailAuthError(err) {
    const msg = err.message || ""
    if (/connect google/i.test(msg)) {
      setGoogleStatus((prev) => ({ ...prev, connected: false }))
      refreshGoogleStatus()
      return "Your Google session expired or was reset. Click Connect Google below, then try again."
    }
    return msg || "Something went wrong."
  }

  async function saveGmailDraft() {
    if (!result?.trim()) return
    const to = recipientEmail.trim()
    if (!to) {
      setGmailError("Add a recipient email address.")
      return
    }
    setGmailBusy("draft")
    setGmailError(null)
    setGmailNotice(null)
    try {
      await api.saveGmailDraft({
        to,
        messageText: result,
        contactName: contact?.name || "",
      })
      setGmailNotice({ type: "success", text: "Saved to Gmail drafts. Open Gmail to review and send." })
    } catch (err) {
      setGmailError(handleGmailAuthError(err))
    } finally {
      setGmailBusy(null)
    }
  }

  async function scheduleGmailSend() {
    if (!result?.trim()) return
    const to = recipientEmail.trim()
    if (!to) {
      setGmailError("Add a recipient email address.")
      return
    }
    if (!scheduleAt) {
      setGmailError("Pick a date and time to schedule the send.")
      return
    }
    const sendAt = new Date(scheduleAt)
    if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now()) {
      setGmailError("Scheduled time must be in the future.")
      return
    }
    setGmailBusy("schedule")
    setGmailError(null)
    setGmailNotice(null)
    try {
      const { scheduled } = await api.scheduleGmailSend({
        to,
        messageText: result,
        sendAt: sendAt.toISOString(),
        contactName: contact?.name || "",
      })
      setGmailNotice({
        type: "success",
        text: `Email scheduled for ${formatScheduleLabel(scheduled?.sendAt || sendAt.toISOString())}.`,
      })
    } catch (err) {
      setGmailError(handleGmailAuthError(err))
    } finally {
      setGmailBusy(null)
    }
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="AI Powered"
        title="Message Composer"
        subtitle="Pick a scenario to auto-generate a starter message, then edit it before you copy or send."
      />

      <ContentCard padding="16px 16px 14px" marginBottom={28}>
        <CardTitle helper="Click a scenario to generate a starter message.">Quick scenarios</CardTitle>
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {COMPOSE_SITUATIONS.map((s) => {
            const config = getScenarioConfig(s)
            const active = situation === s
            return (
              <button
                key={s}
                type="button"
                title={s}
                disabled={loading}
                onClick={() => selectScenario(s)}
                style={{
                  background: active ? "var(--gb-accent-soft)" : "var(--gb-surface-hover)",
                  border: active ? "1px solid var(--gb-border-strong)" : "1px solid var(--gb-border-strong)",
                  color: active ? "var(--gb-accent)" : "var(--gb-text-secondary)",
                  padding: "8px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontFamily: font.body,
                  fontWeight: active ? 600 : 500,
                  cursor: loading ? "wait" : "pointer",
                  boxShadow: "none",
                  transition: "border-color 0.15s, background 0.15s, color 0.15s",
                }}
              >
                {loading && active ? "Generating…" : config?.shortLabel || s}
              </button>
            )
          })}
        </div>
      </div>
      </ContentCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 32, width: "100%" }}>

        {/* Left — Inputs */}
        <ContentCard style={{ marginBottom: 0 }} padding="18px 18px 16px">
        <CardTitle>Message details</CardTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Contact picker */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>CONTACT (optional)</label>
            <select
              value={selectedContact}
              onChange={e => {
                setSelectedContact(e.target.value)
                setPreviousCommunication("")
              }}
              style={inputStyle()}
            >
              <option value="">No specific contact</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `— ${c.company}` : ""}</option>)}
            </select>
            {contact && (
              <div style={{
                marginTop: 10, padding: "12px 14px", borderRadius: 9,
                background: "var(--gb-surface-hover)", border: "1px solid var(--gb-border-subtle)",
                fontSize: 13, color: "var(--gb-text-subtle)", lineHeight: 1.6
              }}>
                {contact.role && <div>🏷 {contact.role}</div>}
                {contact.company && <div>🏢 {contact.company}</div>}
                {contact.email && <div>✉ {contact.email}</div>}
                {contact.notes && <div>📝 {contact.notes}</div>}
              </div>
            )}
          </div>

          {/* Situation */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>SITUATION *</label>
            <select
              value={situation}
              onChange={(e) => {
                setSituation(e.target.value)
                setExampleNotice(null)
              }}
              style={inputStyle()}
            >
              <option value="">Select a situation...</option>
              {COMPOSE_SITUATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {scenarioConfig && (
              <div
                style={{
                  marginTop: 12,
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(91,228,216,0.05)",
                  border: "1px solid rgba(91,228,216,0.18)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: font.mono,
                    color: "rgba(91,228,216,0.85)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  Suggest example for this scenario
                </div>
                <div style={{ fontSize: 13, color: "var(--gb-text-subtle)", lineHeight: 1.55, marginBottom: 10 }}>
                  <strong style={{ color: "var(--gb-text-secondary)", fontWeight: 600 }}>Purpose: </strong>
                  {scenarioConfig.purposeExample}
                </div>
                <div style={{ fontSize: 13, color: "var(--gb-text-subtle)", lineHeight: 1.55, marginBottom: 14 }}>
                  <strong style={{ color: "var(--gb-text-secondary)", fontWeight: 600 }}>Extra context: </strong>
                  {scenarioConfig.extraContextExample}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    onClick={applyExampleFields}
                    disabled={loading}
                    style={{
                      background: "var(--gb-surface-active)",
                      border: "1px solid var(--gb-border)",
                      color: "var(--gb-text-strong)",
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: font.body,
                      fontWeight: 600,
                      cursor: loading ? "not-allowed" : "pointer",
                      boxShadow: "none",
                    }}
                  >
                    Use example fields
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applyExampleFields()
                      runCompose({
                        situation,
                        purpose: scenarioConfig.purposeExample,
                        extraContext: scenarioConfig.extraContextExample,
                      })
                    }}
                    disabled={loading}
                    style={{
                      background: loading ? "var(--gb-accent-soft)" : "var(--gb-accent-soft)",
                      border: "1px solid var(--gb-border-subtle)",
                      color: loading ? "rgba(184,255,87,0.45)" : "var(--gb-accent)",
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: font.body,
                      fontWeight: 600,
                      cursor: loading ? "wait" : "pointer",
                      boxShadow: "none",
                    }}
                  >
                    {loading ? "Generating…" : "Generate message from scenario"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tone */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>TONE</label>
            <select value={tone} onChange={e => setTone(e.target.value)} style={inputStyle()}>
              {COMPOSE_TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>PURPOSE</label>
            <p style={{ fontSize: 12, color: "var(--gb-text-dim)", margin: "0 0 8px 0", lineHeight: 1.55, fontFamily: font.body }}>
              What you want from this message (e.g. schedule a call, ask for advice, confirm next steps). The draft will aim toward that outcome without being pushy.
            </p>
            <textarea
              placeholder="e.g. Land a 20-minute coffee chat to learn about their team’s intern pipeline and whether they’d take a quick résumé glance."
              value={purpose} onChange={e => setPurpose(e.target.value)}
              style={{ ...inputStyle(), height: 80, resize: "vertical" }}
            />
          </div>

          {/* Your background */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>YOUR BACKGROUND</label>
            <textarea
              placeholder="e.g. Junior at CMU studying Computer Science, interested in product management..."
              value={yourBackground} onChange={e => setYourBackground(e.target.value)}
              style={{ ...inputStyle(), height: 80, resize: "vertical" }}
            />
          </div>

          {/* Previous communication */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>PREVIOUS COMMUNICATION</label>
            <p style={{ fontSize: 12, color: "var(--gb-text-dim)", margin: "0 0 8px 0", lineHeight: 1.55, fontFamily: font.body }}>
              Paste full threads or detailed notes — the more concrete, the better. Include their wording when you can, open questions, what you promised, and dates they gave. The draft will reference those specifics (up to ~200 words when you add history here).
            </p>
            <textarea
              placeholder={"e.g.\nThem (Mar 2): \"Happy to chat after my team’s release — try me mid-April.\"\nMe: Asked about interning on X team.\nThem: Suggested I look at the roles page and send a resume + 2 bullets on the ML project we discussed."}
              value={previousCommunication} onChange={e => setPreviousCommunication(e.target.value)}
              style={{ ...inputStyle(), height: 140, minHeight: 96, resize: "vertical", lineHeight: 1.45 }}
            />
          </div>

          {/* Extra context */}
          <div>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)", display: "block", marginBottom: 7, letterSpacing: 0.5 }}>EXTRA CONTEXT</label>
            <textarea
              placeholder="e.g. We met at the Google career fair, talked about their ML team..."
              value={extraContext} onChange={e => setExtraContext(e.target.value)}
              style={{ ...inputStyle(), height: 80, resize: "vertical" }}
            />
          </div>

          <button
            onClick={compose}
            disabled={!situation || loading}
            style={{
              background: situation && !loading ? "var(--gb-accent-bright)" : "var(--gb-accent-soft)",
              color: situation && !loading ? "var(--gb-accent-text-on)" : "var(--gb-accent-muted)",
              border: situation && !loading ? "1px solid rgba(10,15,9,0.22)" : "1px solid var(--gb-border-subtle)",
              boxShadow: "none",
              padding: "13px 28px",
              borderRadius: 10,
              fontFamily: font.h1,
              fontWeight: 700,
              fontSize: 15,
              cursor: situation && !loading ? "pointer" : "not-allowed",
              transition: "background 0.15s, border-color 0.15s, color 0.15s",
            }}
          >
            {loading ? "Composing..." : "✨ Generate Message"}
          </button>
        </div>
        </ContentCard>

        {/* Right — Output */}
        <ContentCard style={{ marginBottom: 0 }} padding="18px 18px 16px">
          <CardTitle helper="This message is AI-generated and may contain errors or outdated details. Proofread carefully and edit anything that does not sound like you before copying or sending.">
            Generated message
          </CardTitle>
          <div style={{
            background: "var(--gb-bg-elevated)", border: `1px solid ${result ? "var(--gb-border-subtle)" : "var(--gb-surface-active)"}`,
            borderRadius: 14, padding: result && !loading ? 16 : 24, minHeight: 320,
            display: "flex", flexDirection: "column", justifyContent: result && !loading ? "flex-start" : "center",
            alignItems: result && !loading ? "stretch" : "center",
          }}>
            {loading && (
              <div style={{ textAlign: "center", color: "var(--gb-text-dim)" }}>
                <div style={{ fontSize: 28, marginBottom: 12, animation: "spin 1s linear infinite" }}>✨</div>
                <div style={{ fontSize: 14, fontFamily: font.mono }}>Composing your message...</div>
              </div>
            )}

            {error && (
              <div style={{ color: "var(--gb-danger)", fontSize: 14, lineHeight: 1.6 }}>
                ⚠ {error}
              </div>
            )}

            {exampleNotice && (
              <p style={{ fontSize: 12, color: "rgba(255,201,107,0.9)", margin: "0 0 8px 0", lineHeight: 1.45, fontFamily: font.body }}>
                {exampleNotice}
              </p>
            )}
            {result && !loading && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  aria-label="Generated message — editable"
                  style={{
                    ...inputStyle(),
                    flex: 1,
                    minHeight: 260,
                    fontFamily: font.mono,
                    fontSize: 13,
                    lineHeight: 1.8,
                    resize: "vertical",
                    border: "1px solid var(--gb-border-subtle)",
                    background: "var(--gb-bg-input)",
                  }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={copy} style={{
                    background: copied ? "var(--gb-accent-soft)" : "var(--gb-surface-muted)",
                    border: "1px solid", borderColor: copied ? "var(--gb-border-strong)" : "var(--gb-border-strong)",
                    color: copied ? "var(--gb-accent)" : "var(--gb-text-subtle)",
                    padding: "8px 18px", borderRadius: 8, fontSize: 13,
                    cursor: "pointer", fontFamily: font.mono, transition: "all 0.15s",
                    boxShadow: "none",
                  }}>
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                  <button onClick={compose} style={{
                    background: "transparent", border: "1px solid var(--gb-border-subtle)",
                    color: "var(--gb-text-faint)", padding: "8px 18px", borderRadius: 8,
                    fontSize: 13, cursor: "pointer", fontFamily: font.mono,
                    boxShadow: "none",
                  }}>Regenerate</button>
                </div>

                <div style={{
                  marginTop: 20, paddingTop: 20,
                  borderTop: "1px solid var(--gb-border-subtle)",
                }}>
                  <div style={{
                    fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)",
                    letterSpacing: 0.5, marginBottom: 10,
                  }}>GMAIL</div>
                  <p style={{
                    fontSize: 12, color: "var(--gb-text-dim)", margin: "0 0 12px 0", lineHeight: 1.5,
                  }}>
                    Save this message as a draft in Gmail, or schedule GhostBuster to send it at a chosen time.
                  </p>

                  {gmailNotice && (
                    <div style={{
                      marginBottom: 12, padding: "10px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.5,
                      background: gmailNotice.type === "success" ? "rgba(184,255,87,0.08)" : "rgba(255,107,107,0.08)",
                      border: `1px solid ${gmailNotice.type === "success" ? "var(--gb-border-subtle)" : "rgba(255,107,107,0.25)"}`,
                      color: gmailNotice.type === "success" ? "var(--gb-accent)" : "var(--gb-danger)",
                    }}>
                      {gmailNotice.text}
                    </div>
                  )}

                  {gmailError && (
                    <div style={{ marginBottom: 12, fontSize: 13, color: "var(--gb-danger)", lineHeight: 1.5 }}>
                      ⚠ {gmailError}
                      {!googleStatus.connected && googleStatus.configured && (
                        <div style={{ marginTop: 10 }}>
                          <button type="button" onClick={connectGoogle} style={{
                            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                            color: "rgba(240,240,245,0.75)", padding: "8px 16px", borderRadius: 8,
                            fontSize: 13, cursor: "pointer", fontFamily: font.mono, boxShadow: "none",
                          }}>
                            Connect Google
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!googleLoading && !googleStatus.configured && (
                    <div style={{ fontSize: 13, color: "var(--gb-text-faint)", lineHeight: 1.55 }}>
                      Gmail is not configured on the server yet (Google OAuth env vars).
                    </div>
                  )}

                  {!googleLoading && googleStatus.configured && !googleStatus.connected && (
                    <div>
                      <p style={{ fontSize: 13, color: "var(--gb-text-muted)", margin: "0 0 10px 0", lineHeight: 1.5, fontFamily: font.body }}>
                        Connect Google to use the same account as Calendar reminders.
                      </p>
                      <button type="button" onClick={connectGoogle} style={{
                        background: "var(--gb-surface-active)", border: "1px solid var(--gb-border)",
                        color: "var(--gb-text-secondary)", padding: "8px 16px", borderRadius: 8,
                        fontSize: 13, cursor: "pointer", fontFamily: font.mono, boxShadow: "none",
                      }}>
                        Connect Google
                      </button>
                    </div>
                  )}

                  {!googleLoading && googleStatus.connected && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={{
                          fontSize: 11, fontFamily: font.mono, color: "var(--gb-text-faint)",
                          display: "block", marginBottom: 6, letterSpacing: 0.5,
                        }}>TO</label>
                        <input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="contact@company.com"
                          style={inputStyle()}
                        />
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        <button
                          type="button"
                          onClick={saveGmailDraft}
                          disabled={gmailBusy != null}
                          style={{
                            background: gmailBusy === "draft" ? "var(--gb-accent-soft)" : "var(--gb-accent-soft)",
                            border: "1px solid var(--gb-border-subtle)",
                            color: gmailBusy != null ? "rgba(184,255,87,0.45)" : "var(--gb-accent)",
                            padding: "8px 16px", borderRadius: 8, fontSize: 13,
                            cursor: gmailBusy != null ? "not-allowed" : "pointer",
                            fontFamily: font.mono, boxShadow: "none",
                          }}
                        >
                          {gmailBusy === "draft" ? "Saving…" : "Save to Gmail drafts"}
                        </button>
                      </div>

                      <div>
                        <label style={{
                          fontSize: 11, fontFamily: font.mono, color: "var(--gb-text-faint)",
                          display: "block", marginBottom: 6, letterSpacing: 0.5,
                        }}>SCHEDULE SEND</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                          <input
                            type="datetime-local"
                            value={scheduleAt}
                            onChange={(e) => setScheduleAt(e.target.value)}
                            style={{ ...inputStyle(), width: "auto", flex: "1 1 200px" }}
                          />
                          <button
                            type="button"
                            onClick={scheduleGmailSend}
                            disabled={gmailBusy != null}
                            style={{
                              background: gmailBusy === "schedule" ? "var(--gb-surface-hover)" : "var(--gb-surface-active)",
                              border: "1px solid var(--gb-border)",
                              color: gmailBusy != null ? "var(--gb-text-faint)" : "var(--gb-text-secondary)",
                              padding: "8px 16px", borderRadius: 8, fontSize: 13,
                              cursor: gmailBusy != null ? "not-allowed" : "pointer",
                              fontFamily: font.mono, boxShadow: "none",
                            }}
                          >
                            {gmailBusy === "schedule" ? "Scheduling…" : "Schedule send"}
                          </button>
                        </div>
                        <p style={{
                          fontSize: 11, color: "var(--gb-text-dim)", margin: "8px 0 0 0", lineHeight: 1.45,
                        }}>
                          GhostBuster sends from your Gmail at the scheduled time (server must stay running).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div style={{ textAlign: "center", color: "var(--gb-text-dim)", fontSize: 14, fontFamily: font.mono }}>
                Your message will appear here
              </div>
            )}
          </div>
        </ContentCard>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </PageShell>
  )
}
