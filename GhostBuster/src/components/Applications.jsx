import React, { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle, primaryBtn, secondaryBtn, uiClass } from "../uiStyles"
import {
  PageShell,
  PageHero,
  ContentCard,
  CardTitle,
  SegmentedFilter,
  EmptyState,
  FormActions,
  FormPrimaryButton,
  FormSecondaryButton,
} from "../layout"
import ViewMoreButton from "./ViewMoreButton"
import { previewHiddenCount, previewSlice } from "../listPreview"
import AiDisclaimer from "./AiDisclaimer"
import AutofillProfile from "./AutofillProfile"
import JobSearch, { ATS_LABELS } from "./JobSearch"
import {
  AUTOFILL_EVENT,
  extensionInstalled,
  requestAllSitesAccess,
  startFill,
  startPortalSync,
} from "../autofillBridge"
import {
  PIPELINE_STATUSES,
  pipelineFromLegacy,
  pipelineMeta,
  withPipelineDefaults,
  portalHref,
  isPipelineClosed,
} from "../applicationPipeline"

const LS_APPLICATIONS = "gb_applications"

const FILTER_OPTIONS = [
  { id: "in_progress", label: "In progress" },
  { id: "interview", label: "Interviewing" },
  { id: "saved", label: "To apply" },
  { id: "offer", label: "Offers" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
]

function emptyForm() {
  return {
    company: "",
    role: "",
    url: "",
    portalUrl: "",
    notes: "",
    statusNote: "",
    status: "todo",
    pipelineStatus: "saved",
  }
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export default function Applications() {
  const [applications, setApplications] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState("in_progress")
  const [showAll, setShowAll] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [suggestSource, setSuggestSource] = useState(null)
  const [suggestWarning, setSuggestWarning] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [addingKey, setAddingKey] = useState(null)
  const [extReady, setExtReady] = useState(extensionInstalled)
  const [extAllSites, setExtAllSites] = useState(true)
  const [fillingId, setFillingId] = useState(null)
  const [portalSyncId, setPortalSyncId] = useState(null)
  const [emailSyncing, setEmailSyncing] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [syncMeta, setSyncMeta] = useState(null)

  useEffect(() => {
    function onAutofill(e) {
      const d = e.detail || {}
      if (d.type === "ready") {
        setExtReady(true)
        setExtAllSites(Boolean(d.allSites))
      }
      else if (d.type === "started") {
        setFillingId(null)
        if (!d.ok) setActionError(d.error || "Couldn't open the application.")
      } else if (d.type === "report" || d.type === "portal") {
        refresh().catch(() => {})
        api.getProfile().then(({ profile }) => setSyncMeta(profile?.applicationSync || null))
      }
    }
    window.addEventListener(AUTOFILL_EVENT, onAutofill)
    return () => window.removeEventListener(AUTOFILL_EVENT, onAutofill)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [g, prof] = await Promise.all([api.getGoogleStatus(), api.getProfile()])
        if (cancelled) return
        setGoogleConnected(Boolean(g?.connected))
        setSyncMeta(prof?.profile?.applicationSync || null)
      } catch {
        /* optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const { applications: list } = await api.getApplications()
        if (!cancelled) {
          const normalized = (list || []).map(withPipelineDefaults)
          setApplications(normalized)
          localStorage.setItem(LS_APPLICATIONS, JSON.stringify(normalized))
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.message)
          setApplications(JSON.parse(localStorage.getItem(LS_APPLICATIONS) || "[]").map(withPipelineDefaults))
        }
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setShowAll(false)
  }, [filter])

  function persist(list) {
    const normalized = (list || []).map(withPipelineDefaults)
    setApplications(normalized)
    localStorage.setItem(LS_APPLICATIONS, JSON.stringify(normalized))
  }

  async function refresh() {
    const { applications: list } = await api.getApplications()
    persist(list || [])
    return (list || []).map(withPipelineDefaults)
  }

  async function save() {
    if (!form.company.trim() && !form.role.trim() && !form.url.trim()) return
    setActionError(null)
    const submitted = form.status === "completed"
    const payload = {
      company: form.company.trim(),
      role: form.role.trim(),
      url: form.url.trim(),
      portalUrl: (form.portalUrl || form.url).trim(),
      notes: form.notes.trim(),
      statusNote: form.statusNote.trim(),
      status: form.status,
      pipelineStatus: submitted ? "applied" : form.pipelineStatus || "saved",
      source: "manual",
    }
    try {
      await api.createApplication(payload)
      await refresh()
      setForm(emptyForm())
      setShowForm(false)
      setNotice({ type: "success", text: form.status === "completed" ? "Saved as completed." : "Saved to complete." })
    } catch (e) {
      if (loadError) {
        persist([{ id: Date.now(), ...payload, createdAt: new Date().toISOString(), completedAt: payload.status === "completed" ? new Date().toISOString() : "" }, ...applications])
        setForm(emptyForm())
        setShowForm(false)
      } else {
        setActionError(e.message)
      }
    }
  }

  async function setPipeline(id, pipelineStatus) {
    setActionError(null)
    const patch = { pipelineStatus }
    if (["applied", "screening", "interview", "offer"].includes(pipelineStatus)) {
      patch.status = "completed"
    }
    if (pipelineStatus === "saved") patch.status = "todo"
    try {
      await api.patchApplication(id, patch)
      await refresh()
    } catch (e) {
      if (loadError) {
        persist(
          applications.map((a) =>
            a.id === id
              ? withPipelineDefaults({
                  ...a,
                  pipelineStatus,
                  status: patch.status ?? a.status,
                  completedAt: patch.status === "completed" ? a.completedAt || new Date().toISOString() : "",
                })
              : a
          )
        )
      } else {
        setActionError(e.message)
      }
    }
  }

  async function markPortalChecked(id) {
    setActionError(null)
    try {
      await api.patchApplication(id, { markPortalChecked: true })
      await refresh()
    } catch (e) {
      if (loadError) {
        const today = new Date().toISOString().slice(0, 10)
        persist(applications.map((a) => (a.id === id ? { ...a, lastPortalCheck: today } : a)))
      } else {
        setActionError(e.message)
      }
    }
  }

  async function saveStatusNote(id, statusNote) {
    setActionError(null)
    try {
      await api.patchApplication(id, { statusNote })
      await refresh()
    } catch (e) {
      if (loadError) {
        persist(applications.map((a) => (a.id === id ? { ...a, statusNote } : a)))
      } else {
        setActionError(e.message)
      }
    }
  }

  async function syncFromGmail() {
    setEmailSyncing(true)
    setActionError(null)
    setNotice(null)
    try {
      const result = await api.syncApplicationsFromEmail()
      await refresh()
      const { profile } = await api.getProfile()
      setSyncMeta(profile?.applicationSync || null)
      const n = result.updated?.length || 0
      setNotice({
        type: "success",
        text:
          n > 0
            ? `Updated ${n} application${n === 1 ? "" : "s"} from Gmail (${result.scanned} messages scanned).`
            : `No new matches in the last scan (${result.scanned} recruiting emails checked).`,
      })
    } catch (e) {
      setActionError(
        e.needsReconnect
          ? `${e.message || "Gmail sync failed"} Open Settings, disconnect Google, then connect again.`
          : e.needsGoogle
            ? `${e.message || "Gmail sync failed"} Connect Google in Settings first.`
            : e.message || "Gmail sync failed"
      )
    } finally {
      setEmailSyncing(false)
    }
  }

  async function syncPortal(application) {
    setActionError(null)
    setNotice(null)
    setPortalSyncId(application.id)
    try {
      await startPortalSync(application)
      setTimeout(() => setPortalSyncId((id) => (id === application.id ? null : id)), 12000)
      setNotice({
        type: "success",
        text: "Opened the status portal — syncing visible status back to GhostBuster.",
      })
    } catch (e) {
      setPortalSyncId(null)
      setActionError(e.message)
    }
  }

  async function savePortalUrl(id, portalUrl) {
    setActionError(null)
    try {
      await api.patchApplication(id, { portalUrl })
      await refresh()
    } catch (e) {
      if (loadError) {
        persist(applications.map((a) => (a.id === id ? { ...a, portalUrl } : a)))
      } else {
        setActionError(e.message)
      }
    }
  }

  async function setStatus(id, status) {
    setActionError(null)
    try {
      await api.patchApplication(id, {
        status,
        ...(status === "completed" ? { pipelineStatus: "applied" } : { pipelineStatus: "saved" }),
      })
      await refresh()
    } catch (e) {
      if (loadError) {
        persist(
          applications.map((a) =>
            a.id === id
              ? { ...a, status, completedAt: status === "completed" ? new Date().toISOString() : "" }
              : a
          )
        )
      } else {
        setActionError(e.message)
      }
    }
  }

  async function remove(id) {
    setActionError(null)
    try {
      await api.deleteApplication(id)
      await refresh()
    } catch (e) {
      if (loadError) persist(applications.filter((a) => a.id !== id))
      else setActionError(e.message)
    }
  }

  async function loadSuggestions() {
    setSuggesting(true)
    setActionError(null)
    setSuggestWarning(null)
    try {
      const data = await api.suggestApplications()
      setSuggestions(data.suggestions || [])
      setSuggestSource(data.source || "ai")
      setSuggestWarning(data.warning || null)
      if (!(data.suggestions || []).length) {
        setNotice({ type: "success", text: "No new suggestions. Add career goals or a résumé for better matches." })
      }
    } catch (e) {
      setActionError(e.message)
    } finally {
      setSuggesting(false)
    }
  }

  async function addSuggestion(s) {
    const key = `${s.company}|${s.role}|${s.url}`
    setAddingKey(key)
    setActionError(null)
    const payload = {
      company: s.company || "",
      role: s.role || "",
      url: s.url || s.urls?.linkedin || "",
      notes: s.why || "",
      status: "todo",
      source: "ai",
    }
    try {
      await api.createApplication(payload)
      await refresh()
      setSuggestions((prev) => prev.filter((x) => x !== s))
      setNotice({
        type: "success",
        text: "Saved to complete. Use Edit link to paste the real application URL when you have it.",
      })
    } catch (e) {
      if (loadError) {
        persist([
          {
            id: Date.now(),
            ...payload,
            createdAt: new Date().toISOString(),
            completedAt: "",
          },
          ...applications,
        ])
        setSuggestions((prev) => prev.filter((x) => x !== s))
      } else {
        setActionError(e.message)
      }
    } finally {
      setAddingKey(null)
    }
  }

  async function fill(application) {
    setActionError(null)
    setNotice(null)
    setFillingId(application.id)
    try {
      await startFill(application)
      setTimeout(() => setFillingId((id) => (id === application.id ? null : id)), 8000)
      setNotice({
        type: "success",
        text: "Opened in a new tab and filling. Review every answer there. GhostBuster never submits for you.",
      })
    } catch (e) {
      setFillingId(null)
      setActionError(e.message)
    }
  }

  async function saveJob(job, { fill: fillNow }) {
    const { application } = await api.createApplication({
      company: job.company,
      role: job.title,
      url: job.url,
      notes: [job.location, ATS_LABELS[job.ats] ? `via ${ATS_LABELS[job.ats]}` : ""].filter(Boolean).join(" · "),
      status: "todo",
      source: "search",
    })
    await refresh()
    if (fillNow) await fill(application)
    else setNotice({ type: "success", text: "Saved to complete." })
  }

  async function saveUrl(id, url) {
    setActionError(null)
    try {
      await api.patchApplication(id, { url })
      await refresh()
    } catch (e) {
      if (loadError) {
        persist(applications.map((a) => (a.id === id ? { ...a, url } : a)))
      } else {
        setActionError(e.message)
      }
    }
  }

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      const p = pipelineFromLegacy(a)
      if (filter === "all") return true
      if (filter === "saved") return p === "saved"
      if (filter === "in_progress") return ["applied", "screening"].includes(p)
      if (filter === "interview") return p === "interview"
      if (filter === "offer") return p === "offer"
      if (filter === "closed") return isPipelineClosed(p) && p !== "offer"
      return p === filter
    })
  }, [applications, filter])

  const pipelineCounts = useMemo(() => {
    const counts = { in_progress: 0, interview: 0, saved: 0, offer: 0, closed: 0 }
    for (const a of applications) {
      const p = pipelineFromLegacy(a)
      if (p === "saved") counts.saved += 1
      else if (p === "offer") counts.offer += 1
      else if (p === "interview") counts.interview += 1
      else if (p === "rejected" || p === "withdrawn") counts.closed += 1
      else if (["applied", "screening"].includes(p)) counts.in_progress += 1
    }
    return counts
  }, [applications])

  const visible = previewSlice(filtered, showAll)
  const hiddenCount = previewHiddenCount(filtered, showAll)
  const savedUrls = useMemo(() => new Set(applications.map((a) => a.url).filter(Boolean)), [applications])
  const needsInputCount = applications.filter((a) => a.status !== "completed" && a.fillStatus === "needs_input").length
  const todoCount = pipelineCounts.saved
  const inProgressCount = pipelineCounts.in_progress
  const interviewingCount = pipelineCounts.interview

  return (
    <PageShell>
      <PageHero
        eyebrow="Recruiting"
        title="Applications"
        subtitle={
          listLoading
            ? "Loading…"
            : `${todoCount} to apply · ${inProgressCount} in progress · ${interviewingCount} interviewing · ${pipelineCounts.offer} offers${needsInputCount ? ` · ${needsInputCount} need your answers` : ""}`
        }
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              background: "var(--gb-accent-bright)",
              color: "var(--gb-accent-text-on)",
              border: "1px solid rgba(10,15,9,0.22)",
              boxShadow: "none",
              padding: "11px 22px",
              borderRadius: 10,
              fontFamily: font.h1,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            + Add application
          </button>
        }
      >
        <p style={{ color: "var(--gb-text-muted)", fontSize: 14, fontFamily: font.body, marginTop: 8, marginBottom: 0 }}>
          Track each role&apos;s status in one place — save apply links and status-portal URLs, update screening and
          interview stages, and open portals without hunting through different sites. AI can still suggest searches
          from your résumé, goals, and contacts.
        </p>
        {loadError && (
          <p style={{ margin: "8px 0 0", color: "var(--gb-warning)", fontSize: 13, fontFamily: font.body }}>
            API unavailable — using local data. Start the server and refresh to sync.
          </p>
        )}
        {actionError && (
          <p style={{ color: "var(--gb-danger)", fontSize: 13, marginTop: 8, marginBottom: 0, fontFamily: font.body }}>
            {actionError}
          </p>
        )}
        {notice && (
          <p
            style={{
              color: notice.type === "error" ? "var(--gb-danger)" : "var(--gb-accent)",
              fontSize: 13,
              marginTop: 8,
              marginBottom: 0,
              fontFamily: font.body,
            }}
          >
            {notice.text}
          </p>
        )}
        {!extReady && (
          <p style={{ margin: "8px 0 0", color: "var(--gb-text-faint)", fontSize: 13, fontFamily: font.body }}>
            To fill applications automatically, install the GhostBuster Autofill extension (ghostbuster-extension/ in this
            project) and refresh.
          </p>
        )}
        {extReady && !extAllSites && (
          <p style={{ margin: "8px 0 0", color: "var(--gb-text-faint)", fontSize: 13, fontFamily: font.body }}>
            Autofill works on Workday, Greenhouse, Lever, and Ashby. To follow jobs from company careers pages and
            other sites,{" "}
            <button type="button" onClick={requestAllSitesAccess} {...rowBtn(true, { style: { padding: "3px 8px" } })}>
              allow it on all sites
            </button>{" "}
            or approve each site when it asks.
          </p>
        )}
      </PageHero>

      <JobSearch onSave={saveJob} savedUrls={savedUrls} />

      <AutofillProfile />

      <ContentCard padding="18px 18px 16px" marginBottom={24}>
        <CardTitle helper="Uses your career goals, résumé, and contact companies. Results are search links, not live postings — listings change fast.">
          Suggested applications
        </CardTitle>
        <button
          type="button"
          onClick={loadSuggestions}
          disabled={suggesting}
          {...primaryBtn({ style: { marginBottom: 12, opacity: suggesting ? 0.65 : 1, cursor: suggesting ? "not-allowed" : "pointer" } })}
        >
          {suggesting ? "Suggesting…" : "Suggest applications"}
        </button>
        {suggestWarning && (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--gb-warning)", fontFamily: font.body }}>
            {suggestWarning}
          </p>
        )}
        {suggestSource === "ai" && suggestions.length > 0 && (
          <AiDisclaimer
            text="These are AI-generated search targets and may be outdated or a poor fit. Open the listing yourself before you apply."
            style={{ marginBottom: 12 }}
          />
        )}
        {suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suggestions.map((s) => {
              const key = `${s.company}|${s.role}|${s.url}`
              return (
                <div
                  key={key}
                  style={{
                    border: "1px solid var(--gb-border)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    background: "var(--gb-surface-hover)",
                  }}
                >
                  <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    {s.role || "Role"}
                    {s.company ? ` · ${s.company}` : ""}
                  </div>
                  {s.location ? (
                    <div style={{ fontSize: 12, color: "var(--gb-text-faint)", marginBottom: 6, fontFamily: font.mono }}>
                      {s.location}
                    </div>
                  ) : null}
                  {s.why ? (
                    <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--gb-text-muted)", lineHeight: 1.45, fontFamily: font.body }}>
                      {s.why}
                    </p>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => addSuggestion(s)}
                      disabled={addingKey === key}
                      {...rowBtn(true, {
                        style: { opacity: addingKey === key ? 0.65 : 1, cursor: addingKey === key ? "not-allowed" : "pointer" },
                      })}
                    >
                      {addingKey === key ? "Adding…" : "Save to tracker"}
                    </button>
                    {s.urls?.linkedin && (
                      <a href={s.urls.linkedin} target="_blank" rel="noreferrer" {...actionLink()}>
                        Search LinkedIn
                      </a>
                    )}
                    {s.urls?.handshake && (
                      <a href={s.urls.handshake} target="_blank" rel="noreferrer" {...actionLink()}>
                        Search Handshake
                      </a>
                    )}
                    {s.urls?.google && (
                      <a href={s.urls.google} target="_blank" rel="noreferrer" {...actionLink()}>
                        Search Google
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ContentCard>

      <ContentCard padding="18px 18px 16px" marginBottom={24}>
        <CardTitle helper="Gmail scans recruiting emails; the extension reads Workday, Greenhouse, Lever, and Ashby status pages.">
          Auto-sync status
        </CardTitle>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--gb-text-muted)", lineHeight: 1.5, fontFamily: font.body }}>
          We match updates to saved applications by company and role — you still review every change. Gmail sync needs{" "}
          <strong style={{ fontWeight: 600 }}>read-only inbox</strong> access (reconnect Google once in Settings if prompted).
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            disabled={emailSyncing || !googleConnected}
            onClick={syncFromGmail}
            {...rowBtn(googleConnected, {
              style: {
                opacity: googleConnected ? 1 : 0.55,
                cursor: googleConnected && !emailSyncing ? "pointer" : "not-allowed",
              },
            })}
          >
            {emailSyncing ? "Syncing Gmail…" : "Update from Gmail"}
          </button>
          {!googleConnected && (
            <span style={{ fontSize: 12, color: "var(--gb-text-faint)", fontFamily: font.body }}>
              Connect Google in Settings to enable email sync.
            </span>
          )}
        </div>
        {syncMeta?.lastEmailSyncAt && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--gb-text-muted)", fontFamily: font.mono }}>
            Last Gmail sync: {new Date(syncMeta.lastEmailSyncAt).toLocaleString()}
            {syncMeta.lastEmailUpdateCount != null ? ` · ${syncMeta.lastEmailUpdateCount} updated` : ""}
          </p>
        )}
      </ContentCard>

      <ContentCard padding="14px 14px 12px" marginBottom={24}>
        <CardTitle helper="Filter by where you are in the process — not which website hosts the job.">
          Pipeline
        </CardTitle>
        <SegmentedFilter
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS.map((f) => ({
            id: f.id,
            label: `${f.label}${pipelineCounts[f.id] != null ? ` (${pipelineCounts[f.id]})` : ""}`,
          }))}
        />
      </ContentCard>

      {showForm && (
        <ContentCard padding="28px" marginBottom={28} style={{ border: "1px solid var(--gb-border-subtle)" }}>
          <CardTitle>New application</CardTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <input
              placeholder="Role (e.g. Software engineering intern)"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={inputStyle()}
            />
            <input
              placeholder="Company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              style={inputStyle()}
            />
          </div>
          <input
            placeholder="Application link (Handshake, LinkedIn, company site…)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value, portalUrl: e.target.value || form.portalUrl })}
            style={{ ...inputStyle(), marginTop: 14 }}
          />
          <input
            placeholder="Status portal link (Workday, Greenhouse status page — optional if same as above)"
            value={form.portalUrl}
            onChange={(e) => setForm({ ...form, portalUrl: e.target.value })}
            style={{ ...inputStyle(), marginTop: 14 }}
          />
          <input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{ ...inputStyle(), marginTop: 14 }}
          />
          <input
            placeholder="Latest status from portal (e.g. Under review, OA sent)"
            value={form.statusNote}
            onChange={(e) => setForm({ ...form, statusNote: e.target.value })}
            style={{ ...inputStyle(), marginTop: 14 }}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 14,
              fontSize: 13,
              color: "var(--gb-text-subtle)",
              cursor: "pointer",
              fontFamily: font.body,
            }}
          >
            <input
              type="checkbox"
              checked={form.status === "completed"}
              onChange={(e) => setForm({ ...form, status: e.target.checked ? "completed" : "todo" })}
            />
            I already submitted this application
          </label>
          <FormActions
            primary={<FormPrimaryButton onClick={save}>Save</FormPrimaryButton>}
            secondary={
              <FormSecondaryButton
                onClick={() => {
                  setShowForm(false)
                  setForm(emptyForm())
                }}
              >
                Cancel
              </FormSecondaryButton>
            }
          />
        </ContentCard>
      )}

      <ContentCard padding="8px 0 4px" className="gb-applications-list-card">
        {visible.length === 0 && !listLoading ? (
          <EmptyState
            align="left"
            title="No applications"
            lede={
              filter === "all"
                ? "Add a link or get AI suggestions to start tracking."
                : "Nothing in this pipeline stage."
            }
          />
        ) : (
          <div className="gb-record-list gb-record-list--in-card">
            {visible.map((a) => (
              <ApplicationRow
                key={a.id}
                application={a}
                onPipelineChange={(pipelineStatus) => setPipeline(a.id, pipelineStatus)}
                onMarkPortalChecked={() => markPortalChecked(a.id)}
                onSaveStatusNote={(note) => saveStatusNote(a.id, note)}
                onComplete={() => setStatus(a.id, "completed")}
                onDelete={() => remove(a.id)}
                onSaveUrl={(url) => saveUrl(a.id, url)}
                onSavePortalUrl={(url) => savePortalUrl(a.id, url)}
                onFill={extReady ? () => fill(a) : null}
                onPortalSync={extReady && portalHref(a) ? () => syncPortal(a) : null}
                filling={fillingId === a.id}
                portalSyncing={portalSyncId === a.id}
              />
            ))}
          </div>
        )}
        <div style={{ padding: "4px 18px 12px" }}>
          <ViewMoreButton
            hiddenCount={hiddenCount}
            showAll={showAll}
            onToggle={() => setShowAll((v) => !v)}
            singular="application"
          />
        </div>
      </ContentCard>
    </PageShell>
  )
}

const FILL_BADGES = {
  needs_input: { text: "Needs your answers", color: "var(--gb-warning)" },
  needs_review: { text: "Filled · review before submitting", color: "var(--gb-accent)" },
  reviewed: { text: "Reviewed", color: "var(--gb-text-subtle)" },
}

function ApplicationRow({
  application: a,
  onPipelineChange,
  onMarkPortalChecked,
  onSaveStatusNote,
  onComplete,
  onDelete,
  onSaveUrl,
  onSavePortalUrl,
  onFill,
  onPortalSync,
  filling,
  portalSyncing,
}) {
  const pipeline = pipelineFromLegacy(a)
  const meta = pipelineMeta(pipeline)
  const portal = portalHref(a)
  const host = a.url ? hostname(a.url) : ""
  const portalHost = portal ? hostname(portal) : ""
  const title = [a.role, a.company].filter(Boolean).join(" · ") || host || "Application"
  const done = a.status === "completed"
  const [editingUrl, setEditingUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState(a.url || "")
  const [portalDraft, setPortalDraft] = useState(a.portalUrl || a.url || "")
  const [noteDraft, setNoteDraft] = useState(a.statusNote || "")
  const [editingNote, setEditingNote] = useState(false)

  useEffect(() => {
    setUrlDraft(a.url || "")
    setPortalDraft(a.portalUrl || a.url || "")
    setNoteDraft(a.statusNote || "")
  }, [a.url, a.portalUrl, a.statusNote])

  return (
    <div className="gb-application-row">
      <div className="gb-record-row__main">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 15 }}>{title}</div>
          <span
            style={{
              fontSize: 10,
              fontFamily: font.mono,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "4px 8px",
              border: `1px solid color-mix(in srgb, ${meta.tone} 45%, var(--gb-border))`,
              color: meta.tone,
              borderRadius: "var(--gb-radius-sm)",
            }}
          >
            {meta.short}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ fontSize: 11, fontFamily: font.mono, color: "var(--gb-text-faint)" }} htmlFor={`pipeline-${a.id}`}>
            Status
          </label>
          <select
            id={`pipeline-${a.id}`}
            value={pipeline}
            onChange={(e) => onPipelineChange(e.target.value)}
            style={{ ...inputStyle(), width: "auto", minWidth: 148, padding: "8px 10px", margin: 0, fontSize: 13 }}
          >
            {PIPELINE_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {a.lastPortalCheck ? (
            <span style={{ fontSize: 11, fontFamily: font.mono, color: "var(--gb-text-muted)" }}>
              Portal checked {a.lastPortalCheck}
            </span>
          ) : null}
        </div>

        {editingUrl ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="Apply link"
              style={{ ...inputStyle(), margin: 0 }}
            />
            <input
              value={portalDraft}
              onChange={(e) => setPortalDraft(e.target.value)}
              placeholder="Status portal (Workday / Greenhouse candidate home)"
              style={{ ...inputStyle(), margin: 0 }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  onSaveUrl(urlDraft.trim())
                  onSavePortalUrl(portalDraft.trim() || urlDraft.trim())
                  setEditingUrl(false)
                }}
                {...rowBtn(true)}
              >
                Save links
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlDraft(a.url || "")
                  setPortalDraft(a.portalUrl || a.url || "")
                  setEditingUrl(false)
                }}
                {...rowBtn()}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {a.url ? (
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--gb-accent)", fontSize: 13, fontFamily: font.body, wordBreak: "break-all" }}
              >
                Apply · {host || a.url}
              </a>
            ) : (
              <div style={{ fontSize: 13, color: "var(--gb-text-faint)" }}>No apply link</div>
            )}
            {portal && portal !== a.url ? (
              <a
                href={portal}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--gb-text-secondary)", fontSize: 13, fontFamily: font.body, wordBreak: "break-all" }}
              >
                Status portal · {portalHost || portal}
              </a>
            ) : null}
          </div>
        )}

        {editingNote ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="What did the portal say?"
              style={{ ...inputStyle(), flex: 1, minWidth: 180, margin: 0 }}
            />
            <button
              type="button"
              onClick={() => {
                onSaveStatusNote(noteDraft.trim())
                setEditingNote(false)
              }}
              {...rowBtn(true)}
            >
              Save note
            </button>
          </div>
        ) : a.statusNote ? (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--gb-text-muted)", lineHeight: 1.45, fontFamily: font.body }}>
            Portal: {a.statusNote}
          </p>
        ) : null}

        {a.notes ? (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--gb-text-muted)", lineHeight: 1.45, fontFamily: font.body }}>
            {a.notes}
          </p>
        ) : null}
        {!done && FILL_BADGES[a.fillStatus] ? (
          <div style={{ marginTop: 8, fontSize: 12, fontFamily: font.mono, color: FILL_BADGES[a.fillStatus].color }}>
            {FILL_BADGES[a.fillStatus].text}
          </div>
        ) : null}
        {!done && a.fillStatus === "needs_input" && a.fillQuestions?.length ? (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--gb-text-muted)", fontFamily: font.body }}>
            {a.fillQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {!editingUrl && (
        <div className="gb-application-actions" role="toolbar" aria-label="Application actions">
          {portal && (
            <div className="gb-application-actions__cluster">
              <span className="gb-application-actions__label">Status portal</span>
              <a href={portal} target="_blank" rel="noreferrer" {...actionLink()}>
                Open page
              </a>
              {onPortalSync && (
                <button
                  type="button"
                  onClick={onPortalSync}
                  disabled={portalSyncing}
                  {...rowBtn(true, {
                    style: { opacity: portalSyncing ? 0.65 : 1, cursor: portalSyncing ? "wait" : "pointer" },
                  })}
                >
                  {portalSyncing ? "Updating…" : "Pull latest status"}
                </button>
              )}
              <button type="button" onClick={onMarkPortalChecked} {...rowBtn()}>
                Mark checked today
              </button>
            </div>
          )}
          {!done && a.url && onFill && (
            <div className="gb-application-actions__cluster">
              <span className="gb-application-actions__label">Apply</span>
              <button
                type="button"
                onClick={onFill}
                disabled={filling}
                {...rowBtn(true, {
                  style: { opacity: filling ? 0.65 : 1, cursor: filling ? "wait" : "pointer" },
                })}
              >
                {filling ? "Opening form…" : a.fillStatus ? "Autofill again" : "Autofill form"}
              </button>
            </div>
          )}
          <div className="gb-application-actions__cluster">
            <span className="gb-application-actions__label">Details</span>
            <button type="button" onClick={() => setEditingUrl(true)} {...rowBtn()}>
              {a.url ? "Edit links" : "Add links"}
            </button>
            <button type="button" onClick={() => setEditingNote((v) => !v)} {...rowBtn()}>
              {a.statusNote || editingNote ? "Edit status note" : "Add status note"}
            </button>
          </div>
          <div className="gb-application-actions__cluster gb-application-actions__cluster--end">
            {pipeline === "saved" && (
              <button type="button" onClick={onComplete} {...rowBtn(true)}>
                Mark submitted
              </button>
            )}
            <button type="button" onClick={onDelete} {...rowBtn(false, { style: { color: "var(--gb-danger)" } })}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function rowBtn(accent = false, extra = {}) {
  return accent ? primaryBtn({ sm: true, ...extra }) : secondaryBtn({ sm: true, ...extra })
}

function actionLink(extra = {}) {
  return {
    className: [uiClass.btnSecondary, uiClass.btnSm].join(" "),
    style: { textDecoration: "none", ...extra.style },
  }
}
