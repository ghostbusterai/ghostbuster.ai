import React, { useEffect, useRef, useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle, primaryBtn, secondaryBtn } from "../uiStyles"
import { PageShell, PageHero, ContentCard } from "../layout"
import AiDisclaimer from "./AiDisclaimer"

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

export default function AskGhostBuster({ setPage }) {
  const [messages, setMessages] = useState([]) // { role, content, sources? }
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, loading])

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

  return (
    <PageShell>
      <PageHero
        eyebrow="Your networking memory"
        title="Ask GhostBuster"
        subtitle="Ask about your contacts, outreach, reminders, applications, meeting notes, and résumés. Answers come only from what you've saved, with links to the sources."
      />

      <AiDisclaimer
        style={{ marginBottom: 20 }}
        text="Answers are AI-generated from your saved data and may contain errors. Check the linked sources before acting on them."
      />

      {messages.length === 0 && (
        <ContentCard>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--gb-text-muted)" }}>Try asking:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => ask(ex)} style={{ ...secondaryBtn(), fontWeight: 500 }}>
                {ex}
              </button>
            ))}
          </div>
        </ContentCard>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
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
            <ContentCard key={i} marginBottom={0}>
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
            </ContentCard>
          )
        )}
        {loading && (
          <div style={{ fontSize: 14, color: "var(--gb-text-muted)", padding: "4px 2px" }}>Searching your records…</div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <ContentCard style={{ borderColor: "rgba(255,107,107,0.35)" }}>
          <p style={{ margin: 0, color: "var(--gb-danger)", fontSize: 14 }}>{error}</p>
        </ContentCard>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        style={{ display: "flex", gap: 10, alignItems: "flex-end" }}
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
          rows={2}
          maxLength={2000}
          placeholder="Ask about your network…"
          aria-label="Ask GhostBuster a question"
          style={{ ...inputStyle(), resize: "vertical", minHeight: 48 }}
        />
        <button type="submit" disabled={loading || !input.trim()} style={{ ...primaryBtn(), opacity: loading || !input.trim() ? 0.6 : 1 }}>
          Ask
        </button>
        {messages.length > 0 && (
          <button type="button" onClick={() => { setMessages([]); setError("") }} style={secondaryBtn()} disabled={loading}>
            New chat
          </button>
        )}
      </form>
    </PageShell>
  )
}
