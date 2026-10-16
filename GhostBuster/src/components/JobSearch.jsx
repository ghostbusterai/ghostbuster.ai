import React, { useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle } from "../uiStyles"
import { ContentCard, CardTitle } from "../layout"
import ViewMoreButton from "./ViewMoreButton"
import { previewHiddenCount, previewSlice } from "../listPreview"

export const ATS_LABELS = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
}

/** Live postings from public ATS job boards. `onSave(job, { fill })` adds one to the list. */
export default function JobSearch({ onSave, savedUrls }) {
  const [company, setCompany] = useState("")
  const [query, setQuery] = useState("")
  const [jobs, setJobs] = useState([])
  const [searching, setSearching] = useState(false)
  const [warning, setWarning] = useState(null)
  const [error, setError] = useState(null)
  const [busyUrl, setBusyUrl] = useState(null)
  const [showAll, setShowAll] = useState(false)

  async function search(e) {
    e?.preventDefault()
    const input = company.trim()
    if (!input) return
    const isWorkday = /myworkday(jobs|site)\.com/i.test(input)
    setSearching(true)
    setError(null)
    setWarning(null)
    setShowAll(false)
    try {
      const data = await api.searchJobs(
        isWorkday ? { workdayUrl: input, q: query.trim() } : { company: input, q: query.trim() }
      )
      setJobs(data.jobs || [])
      setWarning(data.warning || (data.jobs?.length ? null : "No open roles matched. Try fewer keywords."))
    } catch (err) {
      setError(err.message)
      setJobs([])
    } finally {
      setSearching(false)
    }
  }

  async function save(job, fill) {
    setBusyUrl(job.url)
    setError(null)
    try {
      await onSave(job, { fill })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyUrl(null)
    }
  }

  const visible = previewSlice(jobs, showAll)
  const hiddenCount = previewHiddenCount(jobs, showAll)

  return (
    <ContentCard padding="18px 18px 16px" marginBottom={24}>
      <CardTitle helper="Live openings from company job boards on Greenhouse, Lever, and Ashby. For Workday companies, paste their myworkdayjobs.com careers URL.">
        Search open roles
      </CardTitle>
      <form onSubmit={search} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <input
          placeholder="Company (e.g. Stripe) or Workday careers URL"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={{ ...inputStyle(), margin: 0 }}
        />
        <input
          placeholder="Keywords (e.g. software intern)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle(), margin: 0 }}
        />
        <button type="submit" disabled={searching || !company.trim()} style={searchBtn(searching || !company.trim())}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p style={msg("var(--gb-danger)")}>{error}</p>}
      {warning && <p style={msg("var(--gb-warning)")}>{warning}</p>}

      {jobs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {visible.map((job) => {
            const saved = savedUrls.has(job.url)
            const busy = busyUrl === job.url
            return (
              <div
                key={job.url}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  border: "1px solid var(--gb-border)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  background: "var(--gb-surface-hover)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 14 }}>{job.title}</div>
                  <div style={{ fontSize: 12, color: "var(--gb-text-faint)", fontFamily: font.mono }}>
                    {[job.company, job.location, ATS_LABELS[job.ats]].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={job.url} target="_blank" rel="noreferrer" style={smallBtn()}>
                    Open
                  </a>
                  {saved ? (
                    <span style={{ ...smallBtn(), opacity: 0.7 }}>Saved</span>
                  ) : (
                    <>
                      <button type="button" disabled={busy} onClick={() => save(job, false)} style={smallBtn()}>
                        Save
                      </button>
                      <button type="button" disabled={busy} onClick={() => save(job, true)} style={smallBtn(true)}>
                        {busy ? "Working…" : "Save & fill"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          <ViewMoreButton hiddenCount={hiddenCount} showAll={showAll} onToggle={() => setShowAll((v) => !v)} singular="role" />
        </div>
      )}
    </ContentCard>
  )
}

function msg(color) {
  return { margin: "10px 0 0", fontSize: 13, color, fontFamily: font.body }
}

function searchBtn(disabled) {
  return {
    background: "var(--gb-accent-bright)",
    color: "var(--gb-accent-text-on)",
    border: "1px solid rgba(10,15,9,0.22)",
    boxShadow: "none",
    padding: "10px 18px",
    borderRadius: 9,
    fontFamily: font.h1,
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  }
}

function smallBtn(accent = false) {
  return {
    background: accent ? "var(--gb-accent-bright)" : "transparent",
    color: accent ? "var(--gb-accent-text-on)" : "var(--gb-accent)",
    border: accent ? "1px solid rgba(10,15,9,0.22)" : "1px solid var(--gb-border)",
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: accent ? 700 : 500,
    fontFamily: font.body,
    textDecoration: "none",
    cursor: "pointer",
    boxShadow: "none",
  }
}
