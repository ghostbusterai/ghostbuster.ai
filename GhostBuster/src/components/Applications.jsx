import React, { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle } from "../uiStyles"
import { PageShell, PageHero, ContentCard, CardTitle } from "../layout"
import ViewMoreButton from "./ViewMoreButton"
import { previewHiddenCount, previewSlice } from "../listPreview"
import AutofillProfile from "./AutofillProfile"
import JobSearch, { ATS_LABELS } from "./JobSearch"
import { AUTOFILL_EVENT, extensionInstalled, requestAllSitesAccess, startFill } from "../autofillBridge"

const LS_APPLICATIONS = "gb_applications"

function emptyForm() {
  return { company: "", role: "", url: "", notes: "", status: "todo" }
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
  const [filter, setFilter] = useState("todo")
  const [showAll, setShowAll] = useState(false)
  const [extReady, setExtReady] = useState(extensionInstalled)
  const [extAllSites, setExtAllSites] = useState(true)
  const [fillingId, setFillingId] = useState(null)

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
      } else if (d.type === "report") {
        refresh().catch(() => {})
      }
    }
    window.addEventListener(AUTOFILL_EVENT, onAutofill)
    return () => window.removeEventListener(AUTOFILL_EVENT, onAutofill)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const { applications: list } = await api.getApplications()
        if (!cancelled) {
          setApplications(list || [])
          localStorage.setItem(LS_APPLICATIONS, JSON.stringify(list || []))
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.message)
          setApplications(JSON.parse(localStorage.getItem(LS_APPLICATIONS) || "[]"))
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
    setApplications(list)
    localStorage.setItem(LS_APPLICATIONS, JSON.stringify(list))
  }

  async function refresh() {
    const { applications: list } = await api.getApplications()
    persist(list || [])
    return list || []
  }

  async function save() {
    if (!form.company.trim() && !form.role.trim() && !form.url.trim()) return
    setActionError(null)
    const payload = {
      company: form.company.trim(),
      role: form.role.trim(),
      url: form.url.trim(),
      notes: form.notes.trim(),
      status: form.status,
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

  async function setStatus(id, status) {
    setActionError(null)
    try {
      await api.patchApplication(id, { status })
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
      if (filter === "todo") return a.status !== "completed"
      if (filter === "completed") return a.status === "completed"
      return true
    })
  }, [applications, filter])

  const visible = previewSlice(filtered, showAll)
  const hiddenCount = previewHiddenCount(filtered, showAll)
  const savedUrls = useMemo(() => new Set(applications.map((a) => a.url).filter(Boolean)), [applications])
  const needsInputCount = applications.filter((a) => a.status !== "completed" && a.fillStatus === "needs_input").length
  const todoCount = applications.filter((a) => a.status !== "completed").length
  const doneCount = applications.filter((a) => a.status === "completed").length

  return (
    <PageShell>
      <PageHero
        eyebrow="Recruiting"
        title="Applications"
        subtitle={
          listLoading
            ? "Loading…"
            : `${todoCount} to complete · ${doneCount} completed${needsInputCount ? ` · ${needsInputCount} need your answers` : ""}`
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
          Search open roles, save links you still need to submit, and move them to completed when you apply.
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
            <button type="button" onClick={requestAllSitesAccess} style={{ ...rowBtn(true), padding: "3px 8px" }}>
              allow it on all sites
            </button>{" "}
            or approve each site when it asks.
          </p>
        )}
      </PageHero>

      <JobSearch onSave={saveJob} savedUrls={savedUrls} />

      <AutofillProfile />

      <ContentCard padding="14px 14px 12px" marginBottom={24}>
        <CardTitle style={{ marginBottom: 12 }}>View</CardTitle>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "todo", label: "To complete" },
            { id: "completed", label: "Completed" },
            { id: "all", label: "All" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: "7px 18px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: filter === f.id ? "var(--gb-border-strong)" : "var(--gb-border-subtle)",
                background: filter === f.id ? "var(--gb-accent-soft)" : "transparent",
                color: filter === f.id ? "var(--gb-accent)" : "var(--gb-text-faint)",
                fontSize: 13,
                fontFamily: font.mono,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
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
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            style={{ ...inputStyle(), marginTop: 14 }}
          />
          <input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              onClick={save}
              style={{
                background: "var(--gb-accent-bright)",
                color: "var(--gb-accent-text-on)",
                border: "1px solid rgba(10,15,9,0.22)",
                boxShadow: "none",
                padding: "10px 24px",
                borderRadius: 9,
                fontFamily: font.h1,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setForm(emptyForm())
              }}
              style={{
                background: "transparent",
                color: "var(--gb-text-muted)",
                border: "1px solid var(--gb-border-subtle)",
                boxShadow: "none",
                padding: "10px 24px",
                borderRadius: 9,
                fontFamily: font.body,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </ContentCard>
      )}

      <ContentCard padding="8px 0 4px">
        {visible.length === 0 && !listLoading ? (
          <p style={{ margin: "8px 18px 16px", color: "var(--gb-text-faint)", fontSize: 14, fontFamily: font.body }}>
            {filter === "completed"
              ? "No completed applications yet."
              : "No applications to complete. Search open roles or add a link."}
          </p>
        ) : (
          visible.map((a) => (
            <ApplicationRow
              key={a.id}
              application={a}
              onComplete={() => setStatus(a.id, "completed")}
              onReopen={() => setStatus(a.id, "todo")}
              onDelete={() => remove(a.id)}
              onSaveUrl={(url) => saveUrl(a.id, url)}
              onFill={extReady ? () => fill(a) : null}
              filling={fillingId === a.id}
            />
          ))
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

function ApplicationRow({ application: a, onComplete, onReopen, onDelete, onSaveUrl, onFill, filling }) {
  const host = a.url ? hostname(a.url) : ""
  const done = a.status === "completed"
  const title = [a.role, a.company].filter(Boolean).join(" · ") || host || "Application"
  const [editingUrl, setEditingUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState(a.url || "")

  useEffect(() => {
    setUrlDraft(a.url || "")
  }, [a.url])

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 18px",
        borderBottom: "1px solid var(--gb-border-subtle)",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
        {editingUrl ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://…"
              style={{ ...inputStyle(), flex: 1, minWidth: 180, margin: 0 }}
            />
            <button
              type="button"
              onClick={() => {
                onSaveUrl(urlDraft.trim())
                setEditingUrl(false)
              }}
              style={rowBtn(true)}
            >
              Save link
            </button>
            <button
              type="button"
              onClick={() => {
                setUrlDraft(a.url || "")
                setEditingUrl(false)
              }}
              style={rowBtn()}
            >
              Cancel
            </button>
          </div>
        ) : a.url ? (
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--gb-accent)", fontSize: 13, fontFamily: font.body, wordBreak: "break-all" }}
          >
            {host || a.url}
          </a>
        ) : (
          <div style={{ fontSize: 13, color: "var(--gb-text-faint)" }}>No link yet</div>
        )}
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
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
        {!done && a.url && onFill && !editingUrl && (
          <button type="button" onClick={onFill} disabled={filling} style={rowBtn(true)}>
            {filling ? "Opening…" : a.fillStatus ? "Fill again" : "Fill"}
          </button>
        )}
        {!editingUrl && (
          <button type="button" onClick={() => setEditingUrl(true)} style={rowBtn()}>
            {a.url ? "Edit link" : "Add link"}
          </button>
        )}
        {done ? (
          <button type="button" onClick={onReopen} style={rowBtn()}>
            Reopen
          </button>
        ) : (
          <button type="button" onClick={onComplete} style={rowBtn(true)}>
            Mark completed
          </button>
        )}
        <button type="button" onClick={onDelete} style={{ ...rowBtn(), color: "var(--gb-danger)" }}>
          Delete
        </button>
      </div>
    </div>
  )
}

function rowBtn(accent = false) {
  return {
    background: accent ? "var(--gb-accent-soft)" : "transparent",
    border: "1px solid var(--gb-border)",
    color: accent ? "var(--gb-accent)" : "var(--gb-text-subtle)",
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
    boxShadow: "none",
    fontFamily: font.body,
  }
}
