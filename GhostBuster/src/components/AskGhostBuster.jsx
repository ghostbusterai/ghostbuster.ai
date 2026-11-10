import React, { useEffect, useRef, useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle, primaryBtn, secondaryBtn } from "../uiStyles"
import AiDisclaimer from "./AiDisclaimer"
import GhostBusterLogo from "./GhostBusterLogo"

const EXAMPLES = [
  "Who should I follow up with this week?",
  "Who do I know at Stripe?",
  "What did I talk about in my last coffee chat?",
  "Which applications haven't I heard back from?",
]

const TYPE_LABEL = {
  contact: "Contact",
  outreach: "Outreach",
  reminder: "Reminder",
  application: "Application",
  note: "Ghostwriter",
  resume: "Résumé",
}

/** Inline text: **bold** and [[record-id]] citations (shown as numbered chips). */
function renderInline(text, sourceIndex, onSource, keyBase) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\[\[[a-z]+-[\d-]+\]\])/g)
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`
    const cite = part.match(/^\[\[([a-z]+-[\d-]+)\]\]$/)
    if (cite) {
      const n = sourceIndex.get(cite[1])
      if (!n) return null
      return (
        <button
          key={key}
          type="button"
          onClick={() => onSource(cite[1])}
          title="Open source"
          style={{
            margin: "0 2px",
            padding: "0 6px",
            fontSize: 11,
            lineHeight: "16px",
            borderRadius: 999,
            border: "1px solid var(--gb-border)",
            background: "var(--gb-surface-muted)",
            color: "var(--gb-text-strong)",
            cursor: "pointer",
            verticalAlign: "1px",
          }}
        >
          {n}
        </button>
      )
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>
    return <React.Fragment key={key}>{part}</React.Fragment>
  })
}

/** Paragraphs and "-"/"*"/"1." lists; everything else is plain text. */
function Answer({ text, sources, onSource }) {
  const sourceIndex = new Map(sources.map((s, i) => [s.id, i + 1]))
  const blocks = []
  let list = null
  String(text)
    .split("\n")
    .forEach((raw, i) => {
      const lineText = raw.trim()
      const item = lineText.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/)
      if (item) {
        if (!list) {
          list = []
          blocks.push({ list })
        }
        list.push(item[1])
        return
      }
      list = null
      if (lineText) blocks.push({ p: lineText.replace(/^#+\s*/, ""), i })
    })
  return (
    <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--gb-text)" }}>
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i} style={{ margin: "6px 0", paddingLeft: 20 }}>
            {b.list.map((li, j) => (
              <li key={j} style={{ margin: "3px 0" }}>
                {renderInline(li, sourceIndex, onSource, `${i}-${j}`)}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} style={{ margin: "6px 0" }}>
            {renderInline(b.p, sourceIndex, onSource, `${i}`)}
          </p>
        )
      )}
    </div>
  )
}

const bubble = {
  background: "var(--gb-bg-panel)",
  border: "1px solid var(--gb-border-subtle)",
  borderRadius: 12,
  padding: "10px 12px",
}

const SIZE = 60 // launcher diameter
const MARGIN = 12
const POS_KEY = "gb-ask-launcher-pos"

function readSavedPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || "null")
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null
  } catch {
    return null
  }
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))

/**
 * Floating "Ask GhostBuster" chat: a logo button that opens a chat panel. The button starts in the
 * bottom right and can be dragged anywhere; its spot is remembered on this device.
 */
export default function AskGhostBuster({ setPage, raised = false, hidden = false }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([]) // { role, content, sources? }
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const launcherRef = useRef(null)
  const [pos, setPos] = useState(readSavedPos) // top-left of the button, or null for the default corner
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const drag = useRef(null) // { startX, startY, originX, originY, moved }
  const justDragged = useRef(false)

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, loading, open])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e) => e.key === "Escape" && setOpen(false)
    // Clicking anywhere outside the panel (and its button) closes it; the conversation is kept.
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || launcherRef.current?.contains(e.target)) return
      setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [open])

  async function ask(question) {
    const q = String(question || "").trim()
    if (!q || loading) return
    setError("")
    setInput("")
    const history = messages.map(({ role, content }) => ({ role, content }))
    setMessages((m) => [...m, { role: "user", content: q }])
    setLoading(true)
    try {
      const out = await api.ask(q, history)
      setMessages((m) => [...m, { role: "assistant", content: out.answer || "", sources: out.sources || [] }])
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.")
      setMessages((m) => m.slice(0, -1)) // let them retry the same question
      setInput(q)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function openSource(id) {
    const msg = [...messages].reverse().find((m) => m.sources?.some((s) => s.id === id))
    const src = msg?.sources.find((s) => s.id === id)
    if (src?.page) setPage(src.page)
  }

  // Default spot: bottom right, above the page's own corner button (56px tall at bottom 20) on pages
  // that have one. Once dragged, the button stays where the user put it (kept on screen on resize).
  const launcherBottom = raised ? 88 : 20
  const bx = pos ? clamp(pos.x, MARGIN, viewport.w - SIZE - MARGIN) : viewport.w - 20 - SIZE
  const by = pos ? clamp(pos.y, MARGIN, viewport.h - SIZE - MARGIN) : viewport.h - launcherBottom - SIZE

  function onPointerDown(e) {
    if (e.button !== 0) return
    drag.current = { startX: e.clientX, startY: e.clientY, originX: bx, originY: by, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 5) return // small wiggles are still clicks
    d.moved = true
    setPos({
      x: clamp(d.originX + dx, MARGIN, viewport.w - SIZE - MARGIN),
      y: clamp(d.originY + dy, MARGIN, viewport.h - SIZE - MARGIN),
    })
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    justDragged.current = true // the click that follows a drag shouldn't toggle the panel
    setPos((p) => {
      try {
        if (p) localStorage.setItem(POS_KEY, JSON.stringify(p))
      } catch {
        /* storage unavailable: position just won't persist */
      }
      return p
    })
  }

  // Panel: right-aligned with the button, above it when there's room, otherwise below.
  const panelW = Math.min(400, viewport.w - 32)
  const panelH = Math.min(600, viewport.h - 120)
  const panelLeft = clamp(bx + SIZE - panelW, 16, viewport.w - panelW - 16)
  const roomAbove = by - MARGIN - panelH >= 16
  const roomBelow = by + SIZE + MARGIN + panelH <= viewport.h - 16
  const panelTop = roomAbove
    ? by - MARGIN - panelH
    : roomBelow
      ? by + SIZE + MARGIN
      : clamp(by - panelH / 2, 16, viewport.h - panelH - 16)

  if (hidden) return null

  const launcher = (
    <button
      ref={launcherRef}
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onClick={() => {
        if (justDragged.current) {
          justDragged.current = false
          return
        }
        setOpen((o) => !o)
      }}
      aria-label={open ? "Close Ask GhostBuster" : "Ask GhostBuster"}
      title="Ask GhostBuster (drag to move)"
      style={{
        position: "fixed",
        left: bx,
        top: by,
        zIndex: 1000,
        width: SIZE,
        height: SIZE,
        touchAction: "none",
        borderRadius: "50%",
        border: "1px solid var(--gb-border)",
        background: "var(--gb-bg-elevated)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {open ? (
        <span style={{ fontSize: 26, lineHeight: 1, color: "var(--gb-text-strong)" }}>×</span>
      ) : (
        <GhostBusterLogo size={44} />
      )}
    </button>
  )

  if (!open) return launcher

  return (
    <>
      {launcher}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Ask GhostBuster"
        style={{
          position: "fixed",
          left: panelLeft,
          top: panelTop,
          zIndex: 1000,
          width: panelW,
          height: panelH,
          display: "flex",
          flexDirection: "column",
          background: "var(--gb-bg-elevated)",
          border: "1px solid var(--gb-border)",
          borderRadius: 16,
          boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
          overflow: "hidden",
          fontFamily: font.body,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: "1px solid var(--gb-border-subtle)",
          }}
        >
          <GhostBusterLogo size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 15, color: "var(--gb-text-strong)" }}>
              Ask GhostBuster
            </div>
            <div style={{ fontSize: 12, color: "var(--gb-text-faint)" }}>Answers from your saved data</div>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([])
                setError("")
              }}
              disabled={loading}
              style={{ ...secondaryBtn(), padding: "6px 10px", fontSize: 12 }}
            >
              New chat
            </button>
          )}
        </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
              Ask about your contacts, outreach, reminders, applications, meeting notes, and résumés.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => ask(ex)}
                  style={{ ...secondaryBtn(), fontWeight: 500, textAlign: "left", fontSize: 13 }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              style={{
                alignSelf: "flex-end",
                maxWidth: "85%",
                background: "var(--gb-surface-muted)",
                border: "1px solid var(--gb-border)",
                borderRadius: 14,
                padding: "10px 14px",
                fontSize: 14,
                color: "var(--gb-text-strong)",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          ) : (
            <div key={i} style={bubble}>
              <Answer text={m.content} sources={m.sources || []} onSource={openSource} />
              {m.sources?.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--gb-border-subtle)" }}>
                  <div style={{ fontSize: 12, color: "var(--gb-text-faint)", marginBottom: 6 }}>Sources</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {m.sources.map((s, j) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPage(s.page)}
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--gb-border)",
                          background: "transparent",
                          color: "var(--gb-text)",
                          cursor: "pointer",
                          fontFamily: font.body,
                        }}
                      >
                        {j + 1}. {TYPE_LABEL[s.type] || "Record"}: {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
        {loading && (
          <div style={{ fontSize: 14, color: "var(--gb-text-muted)", padding: "4px 2px" }}>Searching your records…</div>
        )}
        {error && <p style={{ margin: 0, color: "var(--gb-danger)", fontSize: 13 }}>{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          padding: 12,
          borderTop: "1px solid var(--gb-border-subtle)",
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              ask(input)
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Ask about your network…"
          aria-label="Ask GhostBuster a question"
          style={{ ...inputStyle(), resize: "none", minHeight: 42, maxHeight: 120 }}
        />
        <button type="submit" disabled={loading || !input.trim()} style={{ ...primaryBtn(), padding: "10px 16px", opacity: loading || !input.trim() ? 0.6 : 1 }}>
          Ask
        </button>
      </form>
        <AiDisclaimer
          style={{ padding: "0 12px 10px", fontSize: 11 }}
          text="AI answers can be wrong. Check the linked sources."
        />
      </div>
    </>
  )
}
