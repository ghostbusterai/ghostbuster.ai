import React, { useEffect, useMemo, useRef, useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle } from "../uiStyles"
import { PageShell, PageHero, SectionLabel, ContentCard, CardTitle } from "../layout"
import AiDisclaimer from "./AiDisclaimer"

function speechSupported() {
  return Boolean(typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition))
}

function formatWhen(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function segmentKey(seg, idx) {
  return `${seg.id || "s"}-${idx}-${seg.at || ""}`
}

function rmsFromAnalyser(analyser, buffer) {
  if (!analyser) return 0
  analyser.getByteTimeDomainData(buffer)
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const v = (buffer[i] - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / buffer.length)
}

export default function Ghostwriter() {
  const [list, setList] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [title, setTitle] = useState("")
  const [contactName, setContactName] = useState("")
  const [active, setActive] = useState(null)
  const [segments, setSegments] = useState([])
  const [detectedSpeaker, setDetectedSpeaker] = useState("You")
  const [speakerMode, setSpeakerMode] = useState("auto") // auto | You | Them
  const [meetingAudioConnected, setMeetingAudioConnected] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [summarizing, setSummarizing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [manualNote, setManualNote] = useState("")

  const recognitionRef = useRef(null)
  const shouldListenRef = useRef(false)
  const segmentsRef = useRef(segments)
  const interimRef = useRef("")
  const transcriptEndRef = useRef(null)
  const audioCtxRef = useRef(null)
  const micStreamRef = useRef(null)
  const meetingStreamRef = useRef(null)
  const micAnalyserRef = useRef(null)
  const meetingAnalyserRef = useRef(null)
  const micBufRef = useRef(null)
  const meetingBufRef = useRef(null)
  const energyTimerRef = useRef(null)
  const micLevelRef = useRef(0)
  const meetingLevelRef = useRef(0)
  const speakerModeRef = useRef(speakerMode)
  const themLabelRef = useRef("Them")
  const detectedSpeakerRef = useRef("You")

  const themLabel = contactName.trim() || "Them"

  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  useEffect(() => {
    interimRef.current = interim
  }, [interim])

  useEffect(() => {
    speakerModeRef.current = speakerMode
  }, [speakerMode])

  useEffect(() => {
    themLabelRef.current = themLabel
  }, [themLabel])

  useEffect(() => {
    detectedSpeakerRef.current = detectedSpeaker
  }, [detectedSpeaker])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null)
      try {
        const [{ ghostwriters }, { contacts: c }] = await Promise.all([
          api.getGhostwriters(),
          api.getContacts(),
        ])
        if (!cancelled) {
          setList(ghostwriters || [])
          setContacts(c || [])
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      teardownCapture()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [segments, interim])

  const selected = useMemo(() => list.find((g) => g.id === selectedId) || null, [list, selectedId])
  const canSummarize = segments.length > 0 || Boolean(interim.trim()) || Boolean(manualNote.trim())
  const viewing = active || selected

  function resolveSpeakerLabel() {
    if (speakerModeRef.current === "You") return "You"
    if (speakerModeRef.current === "Them") return themLabelRef.current
    // Auto: compare recent mic vs meeting-tab energy
    if (!meetingAnalyserRef.current) return "You"
    const mic = micLevelRef.current
    const meet = meetingLevelRef.current
    // Prefer meeting audio when it's clearly louder (other person on speakers/tab)
    if (meet > 0.02 && meet > mic * 1.15) return themLabelRef.current
    if (mic > 0.015) return "You"
    return meet >= mic ? themLabelRef.current : "You"
  }

  function stopEnergyLoop() {
    if (energyTimerRef.current) {
      clearInterval(energyTimerRef.current)
      energyTimerRef.current = null
    }
  }

  function startEnergyLoop() {
    stopEnergyLoop()
    energyTimerRef.current = setInterval(() => {
      const mic = rmsFromAnalyser(micAnalyserRef.current, micBufRef.current)
      const meet = rmsFromAnalyser(meetingAnalyserRef.current, meetingBufRef.current)
      micLevelRef.current = mic
      meetingLevelRef.current = meet
      if (speakerModeRef.current === "auto") {
        const label = resolveSpeakerLabel()
        setDetectedSpeaker(label)
      }
    }, 120)
  }

  function teardownCapture() {
    shouldListenRef.current = false
    stopEnergyLoop()
    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) {
      try {
        rec.onend = null
        rec.onerror = null
        rec.onresult = null
        rec.stop()
      } catch {
        /* ignore */
      }
    }
    for (const stream of [micStreamRef.current, meetingStreamRef.current]) {
      if (stream) {
        for (const track of stream.getTracks()) track.stop()
      }
    }
    micStreamRef.current = null
    meetingStreamRef.current = null
    micAnalyserRef.current = null
    meetingAnalyserRef.current = null
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null
    }
    setListening(false)
    setMeetingAudioConnected(false)
    setInterim("")
  }

  async function setupAudioCapture() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    audioCtxRef.current = ctx
    if (ctx.state === "suspended") await ctx.resume()

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })
    micStreamRef.current = micStream
    const micSource = ctx.createMediaStreamSource(micStream)
    const micAnalyser = ctx.createAnalyser()
    micAnalyser.fftSize = 2048
    micSource.connect(micAnalyser)
    micAnalyserRef.current = micAnalyser
    micBufRef.current = new Uint8Array(micAnalyser.fftSize)

    // Ask user to share the Zoom/Meet tab with audio so we can tell "Them" apart from "You"
    try {
      const meetingStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
        preferCurrentTab: false,
      })
      // Keep a tiny muted video element so some browsers keep the audio track alive
      const videoTrack = meetingStream.getVideoTracks()[0]
      if (videoTrack) videoTrack.enabled = false
      const audioTracks = meetingStream.getAudioTracks()
      if (audioTracks.length === 0) {
        for (const t of meetingStream.getTracks()) t.stop()
        setNotice({
          type: "error",
          text:
            'No meeting audio was shared. In the share dialog, choose your online meeting tab and turn on "Share tab audio". Speaker auto-detect will be limited.',
        })
      } else {
        meetingStreamRef.current = meetingStream
        const meetSource = ctx.createMediaStreamSource(meetingStream)
        const meetAnalyser = ctx.createAnalyser()
        meetAnalyser.fftSize = 2048
        meetSource.connect(meetAnalyser)
        meetingAnalyserRef.current = meetAnalyser
        meetingBufRef.current = new Uint8Array(meetAnalyser.fftSize)
        setMeetingAudioConnected(true)
        audioTracks[0].addEventListener("ended", () => {
          setMeetingAudioConnected(false)
          meetingAnalyserRef.current = null
          setNotice({
            type: "error",
            text: "Meeting tab sharing stopped. Re-share the tab to keep auto speaker detection.",
          })
        })
      }
    } catch {
      setNotice({
        type: "error",
        text:
          "Meeting tab not shared. Auto speaker detection works best if you share your online meeting tab with audio. You can still take notes from your mic.",
      })
    }

    startEnergyLoop()
  }

  function startListening() {
    if (!speechSupported()) {
      setError("Live notes need Chrome or Edge (Web Speech API).")
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"

    rec.onresult = (event) => {
      let interimText = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = (result[0]?.transcript || "").trim()
        if (!text) continue
        if (result.isFinal) {
          const speaker = resolveSpeakerLabel()
          setDetectedSpeaker(speaker)
          const seg = {
            id: Date.now() + i,
            speaker,
            text,
            at: new Date().toISOString(),
          }
          setSegments((prev) => [...prev, seg])
          setInterim("")
          interimRef.current = ""
        } else {
          interimText += (interimText ? " " : "") + text
        }
      }
      if (interimText) {
        setInterim(interimText)
        interimRef.current = interimText
        setDetectedSpeaker(resolveSpeakerLabel())
      }
    }

    rec.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone permission blocked. Allow mic access to take live notes.")
        teardownCapture()
        return
      }
      if (event.error === "no-speech" || event.error === "aborted") return
      setNotice({ type: "error", text: `Speech recognition: ${event.error}` })
    }

    rec.onend = () => {
      if (shouldListenRef.current) {
        try {
          rec.start()
        } catch {
          setListening(false)
        }
      } else {
        setListening(false)
      }
    }

    recognitionRef.current = rec
    shouldListenRef.current = true
    try {
      rec.start()
      setListening(true)
      setError(null)
    } catch (e) {
      setError(e.message || "Could not start speech recognition")
      shouldListenRef.current = false
      setListening(false)
    }
  }

  function flushPendingIntoSegments() {
    const pending = (interimRef.current || "").trim() || (manualNote || "").trim()
    if (!pending) return segmentsRef.current
    const seg = {
      id: Date.now(),
      speaker: resolveSpeakerLabel(),
      text: pending,
      at: new Date().toISOString(),
    }
    const next = [...segmentsRef.current, seg]
    setSegments(next)
    segmentsRef.current = next
    setInterim("")
    interimRef.current = ""
    setManualNote("")
    return next
  }

  async function startSession() {
    setError(null)
    setNotice(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser cannot access the microphone.")
      }
      const { ghostwriter } = await api.createGhostwriter({
        title: title.trim() || undefined,
        contactName: contactName.trim() || undefined,
      })
      setActive(ghostwriter)
      setSegments([])
      segmentsRef.current = []
      setSelectedId(ghostwriter.id)
      setList((prev) => [ghostwriter, ...prev.filter((g) => g.id !== ghostwriter.id)])
      setSpeakerMode("auto")
      setDetectedSpeaker("You")
      await setupAudioCapture()
      startListening()
      if (meetingStreamRef.current) {
        setNotice({
          type: "success",
          text: "Listening. Ghostwriter will auto-label You vs the other person using mic + meeting audio.",
        })
      }
    } catch (e) {
      teardownCapture()
      setActive(null)
      setError(e.message || "Could not start Ghostwriter")
    }
  }

  async function persistSegments(nextSegments, extra = {}) {
    if (!active?.id) return null
    const { ghostwriter } = await api.patchGhostwriter(active.id, {
      segments: nextSegments,
      ...extra,
    })
    setActive(ghostwriter)
    setList((prev) => prev.map((g) => (g.id === ghostwriter.id ? ghostwriter : g)))
    return ghostwriter
  }

  async function stopAndSummarize() {
    const current = flushPendingIntoSegments()
    teardownCapture()
    if (!active?.id) return
    if (!current.length) {
      setError("No speech was captured yet. Talk for a moment (or type a quick note), then try again.")
      return
    }
    setSummarizing(true)
    setError(null)
    try {
      await persistSegments(current, {
        status: "completed",
        endedAt: new Date().toISOString(),
      })
      const { ghostwriter } = await api.summarizeGhostwriter(active.id, { segments: current })
      setActive(ghostwriter)
      setSelectedId(ghostwriter.id)
      setList((prev) => prev.map((g) => (g.id === ghostwriter.id ? ghostwriter : g)))
      setNotice({ type: "success", text: "Meeting saved with an AI summary." })
    } catch (e) {
      setError(e.message)
    } finally {
      setSummarizing(false)
    }
  }

  async function openNote(id) {
    teardownCapture()
    setError(null)
    try {
      const { ghostwriter } = await api.getGhostwriter(id)
      setActive(null)
      setSegments(ghostwriter.segments || [])
      setSelectedId(ghostwriter.id)
    } catch (e) {
      setError(e.message)
    }
  }

  async function removeNote(id) {
    if (!window.confirm("Delete this Ghostwriter note?")) return
    try {
      await api.deleteGhostwriter(id)
      if (active?.id === id) {
        teardownCapture()
        setActive(null)
        setSegments([])
      }
      if (selectedId === id) setSelectedId(null)
      setList((prev) => prev.filter((g) => g.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  function addManualNote() {
    const text = manualNote.trim()
    if (!text) return
    const seg = {
      id: Date.now(),
      speaker: resolveSpeakerLabel(),
      text,
      at: new Date().toISOString(),
    }
    setSegments((prev) => [...prev, seg])
    setManualNote("")
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Live meeting notes"
        title="Ghostwriter"
        subtitle="Take live notes during online meetings. Ghostwriter auto-detects whether you or the other person is talking, then writes an AI summary when you end the call."
      />

      <AiDisclaimer style={{ marginBottom: 20 }} />

      {!speechSupported() && (
        <ContentCard style={{ borderColor: "rgba(255,201,107,0.35)", marginBottom: 24 }}>
          <p style={{ margin: 0, color: "var(--gb-warning)", fontSize: 14, lineHeight: 1.5 }}>
            Live transcription works best in Chrome or Edge. Open GhostBuster there and allow microphone access.
          </p>
        </ContentCard>
      )}

      {error && (
        <ContentCard style={{ borderColor: "rgba(255,107,107,0.35)", marginBottom: 24 }}>
          <p style={{ margin: 0, color: "var(--gb-danger)", fontSize: 14 }}>{error}</p>
        </ContentCard>
      )}

      {notice && (
        <ContentCard
          style={{
            borderColor: notice.type === "success" ? "var(--gb-border-subtle)" : "rgba(255,201,107,0.35)",
            background: notice.type === "success" ? "var(--gb-accent-soft)" : "var(--gb-bg-elevated)",
            marginBottom: 24,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "var(--gb-text-muted)" }}>{notice.text}</p>
        </ContentCard>
      )}

      <SectionLabel>Start a Ghostwriter note</SectionLabel>
      <ContentCard marginBottom={24}>
        <CardTitle helper='When you start, allow the mic, then share your online meeting browser tab and enable "Share tab audio" so Ghostwriter can tell speakers apart.'>
          New meeting
        </CardTitle>
        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting title (optional)"
            style={inputStyle()}
            disabled={Boolean(active)}
          />
          <select
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            style={inputStyle()}
            disabled={Boolean(active)}
          >
            <option value="">Other speaker name (optional)</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
                {c.company ? ` (${c.company})` : ""}
              </option>
            ))}
          </select>
          {!active ? (
            <button
              type="button"
              onClick={startSession}
              style={{
                background: "var(--gb-accent-bright)",
                color: "var(--gb-accent-text-on)",
                border: "1px solid rgba(10,15,9,0.22)",
                borderRadius: 10,
                padding: "12px 16px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              Start live notes
            </button>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                onClick={() => (listening ? (shouldListenRef.current = false, recognitionRef.current?.stop(), setListening(false)) : startListening())}
                style={{
                  background: listening ? "rgba(255,107,107,0.12)" : "var(--gb-accent-soft)",
                  color: listening ? "var(--gb-danger)" : "var(--gb-accent)",
                  border: "1px solid var(--gb-border-subtle)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {listening ? "Pause mic" : "Resume mic"}
              </button>
              <button
                type="button"
                disabled={summarizing || !canSummarize}
                onClick={stopAndSummarize}
                title={
                  !canSummarize
                    ? "Talk for a moment first (or type a note below), then end and summarize"
                    : "Save transcript and generate AI summary"
                }
                style={{
                  background: summarizing || !canSummarize ? "rgba(184,255,87,0.2)" : "var(--gb-accent-bright)",
                  color: summarizing || !canSummarize ? "rgba(184,255,87,0.45)" : "var(--gb-accent-text-on)",
                  border: "1px solid rgba(10,15,9,0.22)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: summarizing || !canSummarize ? "not-allowed" : "pointer",
                }}
              >
                {summarizing ? "Summarizing…" : "End call and summarize"}
              </button>
            </div>
          )}
          {active && !canSummarize && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--gb-warning)", lineHeight: 1.45 }}>
              End call unlocks once Ghostwriter hears speech (or you type a note below). Keep talking for a second so a line can finalize.
            </p>
          )}
        </div>
      </ContentCard>

      {active && (
        <>
          <SectionLabel>Speaker detection</SectionLabel>
          <ContentCard marginBottom={24}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {[
                { id: "auto", label: "Auto-detect" },
                { id: "You", label: "Force: You" },
                { id: "Them", label: `Force: ${themLabel}` },
              ].map((opt) => {
                const on = speakerMode === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSpeakerMode(opt.id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: `1px solid ${on ? "var(--gb-border-strong)" : "var(--gb-border-subtle)"}`,
                      background: on ? "var(--gb-accent-soft)" : "transparent",
                      color: on ? "var(--gb-accent)" : "var(--gb-text-subtle)",
                      fontFamily: font.mono,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--gb-text-dim)", lineHeight: 1.5 }}>
              Currently labeling as{" "}
              <strong style={{ color: "var(--gb-accent)" }}>{detectedSpeaker}</strong>
              {" · "}
              Meeting audio:{" "}
              <strong style={{ color: meetingAudioConnected ? "var(--gb-accent)" : "var(--gb-warning)" }}>
                {meetingAudioConnected ? "connected" : "not connected"}
              </strong>
              {listening ? " · Mic listening" : " · Mic paused"}
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--gb-text-faint)", lineHeight: 1.5 }}>
              Browsers cannot read participant names from online meetings. Auto-detect compares your microphone with shared meeting-tab
              audio to decide You vs {themLabel}.
            </p>
          </ContentCard>

          <SectionLabel>Live transcript</SectionLabel>
          <ContentCard marginBottom={16} padding="16px">
            <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {segments.length === 0 && !interim && (
                <p style={{ margin: 0, color: "var(--gb-text-dim)", fontSize: 14 }}>
                  Waiting for speech… Keep GhostBuster open during your call.
                </p>
              )}
              {segments.map((seg, idx) => (
                <div
                  key={segmentKey(seg, idx)}
                  style={{
                    background: "var(--gb-bg-panel)",
                    border: "1px solid var(--gb-border-subtle)",
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: font.mono,
                      fontSize: 11,
                      color: "var(--gb-accent)",
                      letterSpacing: "0.06em",
                      marginBottom: 4,
                    }}
                  >
                    {seg.speaker}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--gb-text-muted)" }}>{seg.text}</div>
                </div>
              ))}
              {interim && (
                <div
                  style={{
                    opacity: 0.65,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "var(--gb-text-dim)",
                    fontStyle: "italic",
                  }}
                >
                  <span style={{ fontFamily: font.mono, fontSize: 11, color: "var(--gb-accent)" }}>
                    {detectedSpeaker}:{" "}
                  </span>
                  {interim}
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </ContentCard>

          <ContentCard marginBottom={24}>
            <CardTitle helper="If speech recognition is slow, type a line and add it. This also unlocks End call and summarize.">
              Quick typed note
            </CardTitle>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Type something you heard…"
                style={{ ...inputStyle(), flex: "1 1 220px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addManualNote()
                  }
                }}
              />
              <button
                type="button"
                onClick={addManualNote}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--gb-text-strong)",
                  border: "1px solid var(--gb-border)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Add line
              </button>
            </div>
          </ContentCard>
        </>
      )}

      {viewing?.summary && (
        <>
          <SectionLabel>AI summary</SectionLabel>
          <ContentCard marginBottom={24}>
            <CardTitle>{viewing.title || "Meeting summary"}</CardTitle>
            <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.65, color: "var(--gb-text-muted)" }}>
              {viewing.summary.overview}
            </p>
            {viewing.summary.keyPoints?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Key points</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--gb-text-muted)", fontSize: 14, lineHeight: 1.55 }}>
                  {viewing.summary.keyPoints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {viewing.summary.actionItems?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Action items</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--gb-text-muted)", fontSize: 14, lineHeight: 1.55 }}>
                  {viewing.summary.actionItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {viewing.summary.followUps?.length > 0 && (
              <div>
                <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Follow-ups</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--gb-text-muted)", fontSize: 14, lineHeight: 1.55 }}>
                  {viewing.summary.followUps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </ContentCard>
        </>
      )}

      {!active && viewing && viewing.segments?.length > 0 && (
        <>
          <SectionLabel>Transcript</SectionLabel>
          <ContentCard marginBottom={24} padding="16px">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {viewing.segments.map((seg, idx) => (
                <div
                  key={segmentKey(seg, idx)}
                  style={{
                    background: "var(--gb-bg-panel)",
                    border: "1px solid var(--gb-border-subtle)",
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontFamily: font.mono, fontSize: 11, color: "var(--gb-accent)", marginBottom: 4 }}>
                    {seg.speaker}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--gb-text-muted)" }}>{seg.text}</div>
                </div>
              ))}
            </div>
          </ContentCard>
        </>
      )}

      <SectionLabel>Saved notes</SectionLabel>
      {loading ? (
        <ContentCard>
          <p style={{ margin: 0, color: "var(--gb-text-dim)" }}>Loading…</p>
        </ContentCard>
      ) : list.length === 0 ? (
        <ContentCard>
          <p style={{ margin: 0, color: "var(--gb-text-dim)", fontSize: 14 }}>
            No Ghostwriter notes yet. Start one above during your next online meeting.
          </p>
        </ContentCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((g) => {
            const on = selectedId === g.id
            return (
              <ContentCard
                key={g.id}
                marginBottom={0}
                padding="14px 16px"
                style={{
                  borderColor: on ? "var(--gb-border-strong)" : "var(--gb-border)",
                  background: on ? "var(--gb-accent-soft)" : "var(--gb-bg-elevated)",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }}>
                  <button
                    type="button"
                    onClick={() => openNote(g.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                      flex: 1,
                      minWidth: 0,
                      color: "inherit",
                    }}
                  >
                    <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                      {g.title || "Untitled meeting"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--gb-text-dim)", fontFamily: font.mono }}>
                      {g.contactName ? `${g.contactName} · ` : ""}
                      {formatWhen(g.updatedAt || g.createdAt)}
                      {g.summary ? " · summarized" : g.status === "recording" ? " · in progress" : ""}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeNote(g.id)}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,107,107,0.28)",
                      color: "#ff8a8a",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </ContentCard>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
