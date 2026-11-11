import React, { useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle, primaryBtn, secondaryBtn } from "../uiStyles"
import { ContentCard } from "../layout"
import AiDisclaimer from "./AiDisclaimer"

/**
 * "Find people": suggests people to reach out to, found on the public web (LinkedIn excluded).
 * Each suggestion links to its source; the user adds the ones they want to Contacts.
 */
export default function PeopleFinder({ onContactAdded }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ company: "", role: "", school: "", keywords: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null) // { people, note }
  const [added, setAdded] = useState({}) // sourceUrl+name -> true

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const canSearch = Boolean(form.company.trim() || form.role.trim() || form.keywords.trim())

  async function search(e) {
    e?.preventDefault()
    if (!canSearch || loading) return
    setLoading(true)
    setError("")
    setResult(null)
    try {
      setResult(await api.findPeople(form))
    } catch (err) {
      setError(err.message || "Search failed. Try again.")
    } finally {
      setLoading(false)
    }
  }

  async function add(p) {
    const k = p.sourceUrl + p.name
    try {
      await api.createContact({
        name: p.name,
        company: p.company,
        role: p.role,
        notes: [p.why, `Found via: ${p.sourceUrl}`].filter(Boolean).join("\n"),
      })
      setAdded((a) => ({ ...a, [k]: true }))
      onContactAdded?.()
    } catch (err) {
      setError(err.message || "Couldn't add contact.")
    }
  }

  if (!open) {
    return (
      <ContentCard>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontFamily: font.h1, fontWeight: 700, color: "var(--gb-text-strong)" }}>Find people to reach out to</div>
            <div style={{ fontSize: 13, color: "var(--gb-text-muted)", marginTop: 4 }}>
              Describe who you're looking for and GhostBuster searches the public web for people who fit.
            </div>
          </div>
          <button type="button" onClick={() => setOpen(true)} style={secondaryBtn()}>
            Find people
          </button>
        </div>
      </ContentCard>
    )
  }

  const field = (k, placeholder) => (
    <input value={form[k]} onChange={set(k)} placeholder={placeholder} maxLength={200} style={inputStyle()} aria-label={placeholder} />
  )

  return (
    <ContentCard>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: font.h1, fontWeight: 700, color: "var(--gb-text-strong)", flex: 1 }}>
          Find people to reach out to
        </div>
        <button type="button" onClick={() => setOpen(false)} style={{ ...secondaryBtn(), padding: "6px 12px" }}>
          Close
        </button>
      </div>
      <form onSubmit={search} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {field("company", "Company (e.g. Stripe)")}
        {field("role", "Role or team (e.g. software engineer)")}
        {field("school", "School / alumni (optional)")}
        {field("keywords", "Interests (e.g. payments, ML)")}
        <button type="submit" disabled={!canSearch || loading} style={{ ...primaryBtn(), opacity: !canSearch || loading ? 0.6 : 1 }}>
          {loading ? "Searching the web…" : "Find people"}
        </button>
      </form>
      {loading && (
        <p style={{ fontSize: 13, color: "var(--gb-text-muted)", margin: "10px 0 0" }}>This usually takes 20 to 60 seconds.</p>
      )}
      {error && <p style={{ color: "var(--gb-danger)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {result.people.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--gb-text-muted)", margin: 0 }}>
              No one found with a source we could verify. Try a broader role or different keywords.
            </p>
          )}
          {result.people.map((p) => {
            const k = p.sourceUrl + p.name
            return (
              <div
                key={k}
                style={{ border: "1px solid var(--gb-border-subtle)", borderRadius: 12, padding: 12, background: "var(--gb-bg-panel)" }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: "var(--gb-text-strong)" }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: "var(--gb-text-muted)" }}>{[p.role, p.company].filter(Boolean).join(" · ")}</div>
                  </div>
                  <button
                    type="button"
                    disabled={added[k]}
                    onClick={() => add(p)}
                    style={{ ...secondaryBtn(), padding: "6px 12px", opacity: added[k] ? 0.6 : 1 }}
                  >
                    {added[k] ? "Added" : "Add to contacts"}
                  </button>
                </div>
                {p.why && <p style={{ fontSize: 13, color: "var(--gb-text)", margin: "8px 0 0", lineHeight: 1.5 }}>{p.why}</p>}
                {p.suggestedOpener && (
                  <p style={{ fontSize: 13, color: "var(--gb-text-muted)", margin: "6px 0 0", fontStyle: "italic" }}>
                    Opener: “{p.suggestedOpener}”
                  </p>
                )}
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "var(--gb-accent)", wordBreak: "break-all" }}
                >
                  Source: {p.sourceTitle || p.sourceUrl}
                </a>
              </div>
            )
          })}
          {result.note && <p style={{ fontSize: 12, color: "var(--gb-text-faint)", margin: 0 }}>{result.note}</p>}
          <AiDisclaimer text="Suggestions come from public web pages and may be out of date. Check before reaching out." />
        </div>
      )}
    </ContentCard>
  )
}
