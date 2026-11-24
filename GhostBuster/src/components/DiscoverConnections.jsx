import React, { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import { font } from "../theme"
import { uiClass, primaryBtn, secondaryBtn } from "../uiStyles"
import { ContentCard, CardTitle, SegmentedFilter } from "../layout"
import ViewMoreButton from "./ViewMoreButton"
import { previewHiddenCount, previewSlice } from "../listPreview"
import AiDisclaimer from "./AiDisclaimer"
import { Icon } from "../icons"

const SOURCE_LABEL = {
  github: "GitHub",
  web: "Web",
  ai: "AI",
  profile: "For you",
  search: "Search",
}

export default function DiscoverConnections({ onSaved, setPage }) {
  const [tab, setTab] = useState("forYou")
  const [searchMode, setSearchMode] = useState("name")

  const [personName, setPersonName] = useState("")
  const [includeWeb, setIncludeWeb] = useState(true)
  const [role, setRole] = useState("")
  const [industry, setIndustry] = useState("")
  const [company, setCompany] = useState("")
  const [school, setSchool] = useState("Carnegie Mellon University")
  const [location, setLocation] = useState("")
  const [keywords, setKeywords] = useState("")
  const [includeGithub, setIncludeGithub] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [suggestions, setSuggestions] = useState([])
  const [source, setSource] = useState(null)
  const [warning, setWarning] = useState(null)
  const [error, setError] = useState(null)
  const [searching, setSearching] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [profileSummary, setProfileSummary] = useState(null)

  const loadProfileSuggestions = useCallback(async () => {
    setSearching(true)
    setError(null)
    setWarning(null)
    setShowAll(false)
    setSuggestions([])
    try {
      const data = await api.discoverConnectionsFromProfile()
      setSuggestions(data.suggestions || [])
      setSource(data.source || null)
      setWarning(data.warning || null)
      setProfileSummary(data.profileSummary || null)
      if (!(data.suggestions || []).length) {
        setWarning("No suggestions yet. Add career goals in Settings and upload a résumé.")
      }
    } catch (err) {
      setError(err.message)
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (tab === "forYou") loadProfileSuggestions()
  }, [tab, loadProfileSuggestions])

  async function runSearch(e) {
    e?.preventDefault()
    if (searchMode === "name") {
      if (!personName.trim()) {
        setError("Enter a name to search the public web.")
        return
      }
    } else if (!role.trim() && !company.trim() && !keywords.trim() && !industry.trim()) {
      setError("Add a role, company, industry, or keywords.")
      return
    }

    setSearching(true)
    setError(null)
    setWarning(null)
    setShowAll(false)
    setProfileSummary(null)
    try {
      const data = await api.discoverConnections({
        name: searchMode === "name" ? personName.trim() : "",
        role: searchMode === "role" ? role.trim() : "",
        industry: searchMode === "role" ? industry.trim() : "",
        company: company.trim(),
        school: searchMode === "role" ? school.trim() : "",
        location: searchMode === "role" ? location.trim() : "",
        keywords: searchMode === "role" ? keywords.trim() : "",
        includeGithub,
        includeWeb: includeWeb && searchMode === "name" && Boolean(personName.trim()),
      })
      setSuggestions(data.suggestions || [])
      setSource(data.source || null)
      setWarning(data.warning || null)
      if (!(data.suggestions || []).length) {
        setWarning("No matches yet. Try broader keywords or a different company.")
      }
    } catch (err) {
      setError(err.message)
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }

  async function saveLead(s) {
    const displayName =
      s.name?.trim() ||
      [s.role, s.company].filter(Boolean).join(" · ").slice(0, 80) ||
      "New connection"
    const notes = [
      s.why,
      s.outreachAngle ? `Outreach: ${s.outreachAngle}` : "",
      s.sourceHint ? `Where to find them: ${s.sourceHint}` : "",
      `Discovered via GhostBuster (${s.source || "search"}). Verify before messaging.`,
    ]
      .filter(Boolean)
      .join("\n\n")

    setSavingId(s.id)
    setError(null)
    try {
      await api.createContact({
        name: displayName,
        company: s.company || "",
        role: s.role || "",
        linkedin: s.linkedin || "",
        website: s.website || s.github || "",
        notes,
      })
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const visible = previewSlice(suggestions, showAll)
  const hiddenCount = previewHiddenCount(suggestions, showAll)

  const nameSearchReady = Boolean(personName.trim())
  const roleSearchReady = role.trim() || company.trim() || keywords.trim() || industry.trim()
  const canSearch = searchMode === "name" ? nameSearchReady : roleSearchReady

  return (
    <ContentCard className="gb-discover-panel" padding="20px 22px 18px" marginBottom={0}>
      <div className="gb-discover-head">
        <CardTitle helper="Suggested people use your GhostBuster goals and résumé. Search finds someone specific or explores roles.">
          Find people online
        </CardTitle>
        <SegmentedFilter
          className="gb-discover-tabs"
          value={tab}
          onChange={setTab}
          options={[
            { id: "forYou", label: "Suggested for you" },
            { id: "search", label: "Search" },
          ]}
        />
      </div>

      {tab === "forYou" && (
        <div className="gb-discover-profile-band">
          {profileSummary ? (
            <>
              <div className="gb-discover-profile-band__row">
                <span className="gb-discover-profile-band__label">Goals</span>
                <p className="gb-discover-profile-band__text">
                  {profileSummary.hasGoals
                    ? profileSummary.careerGoals
                    : "Add career goals in Settings so we can tailor who to meet."}
                </p>
              </div>
              <p className="gb-discover-profile-band__meta">
                {profileSummary.hasResume ? "Résumé on file" : "Upload a résumé for sharper matches"}
                {profileSummary.recentUpdateTitle
                  ? ` · Latest update: ${profileSummary.recentUpdateTitle}`
                  : ""}
                {profileSummary.school ? ` · ${profileSummary.school}` : ""}
              </p>
            </>
          ) : (
            <p className="gb-discover-profile-band__text">
              We match recruiters, alumni, and peers to your profile — not random cold lists.
            </p>
          )}
          <div className="gb-discover-profile-band__actions">
            <button
              type="button"
              disabled={searching}
              className={primaryBtn({ sm: true }).className}
              style={primaryBtn({ sm: true }).style}
              onClick={loadProfileSuggestions}
            >
              {searching ? "Updating…" : "Refresh suggestions"}
            </button>
            {!profileSummary?.hasGoals && typeof setPage === "function" && (
              <button
                type="button"
                className={secondaryBtn({ sm: true }).className}
                style={secondaryBtn({ sm: true }).style}
                onClick={() => setPage("settings")}
              >
                Add goals in Settings
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "search" && (
        <form className="gb-discover-form gb-discover-form--search" onSubmit={runSearch}>
          <div className="gb-discover-form__mode">
            <SegmentedFilter
              value={searchMode}
              onChange={setSearchMode}
              options={[
                { id: "name", label: "By name" },
                { id: "role", label: "By role & company" },
              ]}
            />
          </div>

          {searchMode === "name" ? (
            <div className="gb-discover-fields gb-discover-fields--two">
              <div className="gb-discover-field">
                <label className="gb-field-label" htmlFor="discover-name">
                  Name
                </label>
                <input
                  id="discover-name"
                  className={uiClass.input}
                  placeholder="e.g. Alex Chen"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="gb-discover-field">
                <label className="gb-field-label" htmlFor="discover-company-name">
                  Company <span className="gb-field-label__hint">optional</span>
                </label>
                <input
                  id="discover-company-name"
                  className={uiClass.input}
                  placeholder="Narrows web results — e.g. Stripe"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="gb-discover-fields gb-discover-fields--two">
              <div className="gb-discover-field">
                <label className="gb-field-label" htmlFor="discover-role">
                  Role or title
                </label>
                <input
                  id="discover-role"
                  className={uiClass.input}
                  placeholder="e.g. product intern"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
              <div className="gb-discover-field">
                <label className="gb-field-label" htmlFor="discover-company">
                  Company
                </label>
                <input
                  id="discover-company"
                  className={uiClass.input}
                  placeholder="e.g. biotech startup, McKinsey"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>
          )}

          {searchMode === "role" && showAdvanced && (
            <div className="gb-discover-advanced">
              <input className={uiClass.input} placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
              <input
                className={uiClass.input}
                placeholder="School / alumni angle"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              />
              <input className={uiClass.input} placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
              <input className={uiClass.input} placeholder="Keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            </div>
          )}

          <div className="gb-discover-actions">
            <button
              type="submit"
              disabled={searching || !canSearch}
              className={primaryBtn({ sm: true }).className}
              style={primaryBtn({ sm: true }).style}
            >
              {searching ? "Searching…" : "Search"}
            </button>
            {searchMode === "role" && (
              <button
                type="button"
                className={secondaryBtn({ sm: true }).className}
                style={secondaryBtn({ sm: true }).style}
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
              >
                {showAdvanced ? "Fewer filters" : "More filters"}
              </button>
            )}
          </div>

          <div className="gb-discover-toggles">
            {searchMode === "name" && (
              <label className="gb-check">
                <input
                  type="checkbox"
                  checked={includeWeb}
                  disabled={!personName.trim()}
                  onChange={(e) => setIncludeWeb(e.target.checked)}
                />
                <span>Search public web for this name</span>
              </label>
            )}
            <label className="gb-check">
              <input type="checkbox" checked={includeGithub} onChange={(e) => setIncludeGithub(e.target.checked)} />
              <span>Include GitHub profiles</span>
            </label>
          </div>
        </form>
      )}

      {error && <p className="gb-discover-msg gb-discover-msg--error">{error}</p>}
      {warning && <p className="gb-discover-msg gb-discover-msg--warn">{warning}</p>}
      {(source === "ai" || tab === "forYou") && suggestions.length > 0 && (
        <AiDisclaimer
          text="Suggestions can be stale or wrong. Confirm the person is real, then save and reach out respectfully."
          style={{ marginTop: 12 }}
        />
      )}

      {suggestions.length > 0 && (
        <ul className="gb-discover-results">
          {visible.map((s) => {
            const title =
              s.name?.trim() ||
              [s.role, s.company].filter(Boolean).join(" · ") ||
              "Connection lead"
            const busy = savingId === s.id
            const src =
              SOURCE_LABEL[s.source] ||
              (s.matchType === "github" ? "GitHub" : s.matchType === "profile" ? "For you" : "Search")

            return (
              <li key={s.id} className="gb-discover-result gb-reveal-block">
                <div className="gb-discover-result__main">
                  <div className="gb-discover-result__title-row">
                    <h3 className="gb-discover-result__title">{title}</h3>
                    <span className="gb-pill">{src}</span>
                  </div>
                  {s.name && (s.role || s.company) && (
                    <p className="gb-discover-result__meta">{[s.role, s.company].filter(Boolean).join(" · ")}</p>
                  )}
                  {s.why && <p className="gb-discover-result__why">{s.why}</p>}
                  {s.outreachAngle && (
                    <p className="gb-discover-result__angle">
                      <span className="gb-discover-result__angle-label">Opener: </span>
                      {s.outreachAngle}
                    </p>
                  )}
                </div>
                <div className="gb-discover-result__actions">
                  {s.profileUrl && s.source === "web" && (
                    <a href={s.profileUrl} target="_blank" rel="noreferrer" className="gb-btn gb-btn--ghost gb-btn--sm">
                      Open page
                    </a>
                  )}
                  {s.github && (
                    <a href={s.github} target="_blank" rel="noreferrer" className="gb-btn gb-btn--ghost gb-btn--sm">
                      GitHub
                    </a>
                  )}
                  {s.urls?.linkedin && (
                    <a href={s.urls.linkedin} target="_blank" rel="noreferrer" className="gb-btn gb-btn--ghost gb-btn--sm">
                      LinkedIn
                    </a>
                  )}
                  <button type="button" disabled={busy} onClick={() => saveLead(s)} className="gb-btn gb-btn--primary gb-btn--sm">
                    {busy ? "Saving…" : "Save contact"}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {suggestions.length > 0 && (
        <ViewMoreButton
          hiddenCount={hiddenCount}
          showAll={showAll}
          onToggle={() => setShowAll((v) => !v)}
          singular="lead"
        />
      )}

      {suggestions.length === 0 && !searching && !error && tab === "search" && (
        <p className="gb-discover-hint" style={{ fontFamily: font.body }}>
          <Icon name="spark" size={14} color="var(--gb-text-faint)" />
          Use <strong>By name</strong> to verify someone on the web, or <strong>By role & company</strong> for AI + GitHub leads.
        </p>
      )}
    </ContentCard>
  )
}