import React, { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle } from "../uiStyles"
import { PageShell, PageHero, ContentCard, CardTitle } from "../layout"
import ViewMoreButton from "./ViewMoreButton"
import { previewHiddenCount, previewSlice } from "../listPreview"
import AiDisclaimer from "./AiDisclaimer"

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
  const [suggestions, setSuggestions] = useState([])
  const [suggestSource, setSuggestSource] = useState(null)
  const [suggestWarning, setSuggestWarning] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [addingKey, setAddingKey] = useState(null)

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
            : `${todoCount} to complete · ${doneCount} completed`
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
          Save links you still need to submit, then move them to completed when you apply. AI can suggest searches
          from your résumé, career goals, and contacts.
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
      </PageHero>

      <ContentCard padding="18px 18px 16px" marginBottom={24}>
        <CardTitle helper="Uses your career goals, résumé, and contact companies. Results are search links, not live postings — listings change fast.">
          Suggested applications
        </CardTitle>
        <button
          type="button"
          onClick={loadSuggestions}
          disabled={suggesting}
          style={{
            background: "var(--gb-accent-soft)",
            border: "1px solid var(--gb-border-subtle)",
            color: "var(--gb-accent)",
            padding: "10px 16px",
            borderRadius: 9,
            fontFamily: font.body,
            fontWeight: 600,
            fontSize: 13,
            cursor: suggesting ? "not-allowed" : "pointer",
            boxShadow: "none",
            marginBottom: 12,
          }}
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
                      style={{
                        background: "var(--gb-accent-bright)",
                        color: "var(--gb-accent-text-on)",
                        border: "1px solid rgba(10,15,9,0.22)",
                        padding: "7px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: addingKey === key ? "not-allowed" : "pointer",
                        boxShadow: "none",
                      }}
                    >
                      {addingKey === key ? "Adding…" : "Save to complete"}
                    </button>
                    {s.urls?.linkedin && (
                      <a href={s.urls.linkedin} target="_blank" rel="noreferrer" style={linkBtn()}>
                        LinkedIn
                      </a>
                    )}
                    {s.urls?.handshake && (
                      <a href={s.urls.handshake} target="_blank" rel="noreferrer" style={linkBtn()}>
                        Handshake
                      </a>
                    )}
                    {s.urls?.google && (
                      <a href={s.urls.google} target="_blank" rel="noreferrer" style={linkBtn()}>
                        Google
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ContentCard>

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
              : "No applications to complete. Add a link or get AI suggestions."}
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

function linkBtn() {
  return {
    color: "var(--gb-accent)",
    fontSize: 12,
    fontFamily: font.mono,
    textDecoration: "none",
    padding: "7px 10px",
    border: "1px solid var(--gb-border)",
    borderRadius: 8,
  }
}

function ApplicationRow({ application: a, onComplete, onReopen, onDelete, onSaveUrl }) {
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
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
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
