import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle, uiClass, primaryBtn, secondaryBtn } from "../uiStyles"
import { suggestResumeBucket, bucketNameForContact } from "../resumeBucketMatch"
import { PageShell, PageHero, ContentCard, CardTitle, EmptyState, ListDivider } from "../layout"
import { formatContactName, formatLastTouch } from "../formatters"
import MessageComposer from "./MessageComposer"
import { Icon } from "../icons"
import FirstContactCelebration from "./FirstContactCelebration"
import ViewMoreButton from "./ViewMoreButton"
import DiscoverConnections from "./DiscoverConnections"
import PeopleFinder from "./PeopleFinder"
import GmailContacts from "./GmailContacts"
import { previewHiddenCount, previewSlice } from "../listPreview"
import { AUTOFILL_EVENT } from "../autofillBridge"

const EMPTY = {
  name: "", email: "", phone: "", company: "", role: "", notes: "", lastContacted: "",
  linkedin: "", website: "", bucketAssignment: "auto",
}

const COMPOSE_DEFAULT_W = 440
const COMPOSE_DEFAULT_H = 780
const COMPOSE_MIN_W = 360
const COMPOSE_MIN_H = 420

function hrefFromUrl(raw) {
  const t = (raw || "").trim()
  if (!t) return ""
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function clampComposeSize(width, height) {
  const maxW = typeof window !== "undefined" ? Math.max(COMPOSE_MIN_W, window.innerWidth - 32) : COMPOSE_DEFAULT_W
  const maxH = typeof window !== "undefined" ? Math.max(COMPOSE_MIN_H, window.innerHeight - 40) : COMPOSE_DEFAULT_H
  return {
    width: Math.min(Math.max(COMPOSE_MIN_W, width), maxW),
    height: Math.min(Math.max(COMPOSE_MIN_H, height), maxH),
  }
}

function contactRecencyMs(c) {
  const idT = Number(c.id) || 0
  const lc = c.lastContacted ? new Date(c.lastContacted).getTime() : 0
  return Math.max(idT, lc)
}

export default function ContactHub({
  setPage,
  composeOpen = false,
  onComposeOpenChange = () => {},
  composePrefill = null,
  onConsumePrefill = () => {},
  googleNotice = null,
  onConsumeGoogleNotice = () => {},
}) {
  const [contacts, setContacts] = useState([])
  const [resumeBuckets, setResumeBuckets] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [listLoading, setListLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [search, setSearch] = useState("")
  const [filterCompany, setFilterCompany] = useState("All")
  const [editId, setEditId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [localComposePrefill, setLocalComposePrefill] = useState(null)
  const [composeSize, setComposeSize] = useState(() =>
    clampComposeSize(COMPOSE_DEFAULT_W, COMPOSE_DEFAULT_H)
  )
  const [showFirstContactCelebration, setShowFirstContactCelebration] = useState(false)
  const [showAllContacts, setShowAllContacts] = useState(false)
  const composeResizeRef = useRef(null)
  const composeAreaRef = useRef(null)

  useEffect(() => {
    composeResizeRef.current = composeSize
  }, [composeSize])

  useEffect(() => {
    if (composePrefill) onComposeOpenChange(true)
  }, [composePrefill, onComposeOpenChange])

  useEffect(() => {
    if (composePrefill) setLocalComposePrefill(null)
  }, [composePrefill])

  useEffect(() => {
    function onWindowResize() {
      setComposeSize((prev) => clampComposeSize(prev.width, prev.height))
    }
    window.addEventListener("resize", onWindowResize)
    return () => window.removeEventListener("resize", onWindowResize)
  }, [])

  const onComposeResizePointerDown = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const pointerId = e.pointerId
    const startX = e.clientX
    const startY = e.clientY
    const startW = composeResizeRef.current?.width ?? COMPOSE_DEFAULT_W
    const startH = composeResizeRef.current?.height ?? COMPOSE_DEFAULT_H
    composeResizeRef.current = { width: startW, height: startH }

    function onMove(ev) {
      if (ev.pointerId !== pointerId) return
      // Panel is anchored bottom-right: drag left/up to grow.
      const next = clampComposeSize(startW + (startX - ev.clientX), startH + (startY - ev.clientY))
      composeResizeRef.current = next
      setComposeSize(next)
    }

    function onUp(ev) {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }, [])

  function openCompose(contact = null) {
    if (contact?.id != null) {
      setLocalComposePrefill({ contactId: contact.id })
    } else {
      setLocalComposePrefill(null)
    }
    onComposeOpenChange(true)
  }

  function closeCompose() {
    onComposeOpenChange(false)
    setLocalComposePrefill(null)
  }

  const activePrefill = composePrefill || localComposePrefill

  useEffect(() => {
    if (!composeOpen) return
    const onPointerDown = (e) => {
      if (composeAreaRef.current?.contains(e.target)) return
      if (e.target.closest?.("[role='dialog']")) return
      closeCompose()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeOpen])

  useEffect(() => {
    async function onAutofill(e) {
      if (e.detail?.type !== "contact" || e.detail.duplicate) return
      try {
        const { contacts: list } = await api.getContacts()
        setContacts(list)
      } catch {
        /* shown on next load */
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") onAutofill({ detail: { type: "contact" } })
    }
    window.addEventListener(AUTOFILL_EVENT, onAutofill)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener(AUTOFILL_EVENT, onAutofill)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const [{ contacts: list }, { buckets }] = await Promise.all([
          api.getContacts(),
          api.getResumeBuckets(),
        ])
        if (!cancelled) {
          setContacts(list)
          setResumeBuckets(buckets || [])
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.message)
          setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
          try {
            setResumeBuckets(JSON.parse(localStorage.getItem("gb_resume_buckets") || "[]"))
          } catch {
            setResumeBuckets([])
          }
        }
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const companyOptions = useMemo(() => {
    const counts = new Map()
    let noCompany = 0
    for (const c of contacts) {
      const company = c.company?.trim()
      if (company) counts.set(company, (counts.get(company) || 0) + 1)
      else noCompany += 1
    }
    const withCompany = [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
    return { withCompany, noCompany }
  }, [contacts])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = contacts.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.linkedin?.toLowerCase().includes(q) ||
        c.website?.toLowerCase().includes(q)
      const matchCompany =
        filterCompany === "All" ||
        (filterCompany === "__none__" ? !c.company?.trim() : c.company === filterCompany)
      return matchSearch && matchCompany
    })
    return list.sort((a, b) => {
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      if (pinDiff !== 0) return pinDiff
      return a.name.localeCompare(b.name)
    })
  }, [contacts, search, filterCompany])

  const displayContacts = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      if (pinDiff !== 0) return pinDiff
      return contactRecencyMs(b) - contactRecencyMs(a)
    })
  }, [filtered])

  const visibleContacts = useMemo(
    () => previewSlice(displayContacts, showAllContacts),
    [displayContacts, showAllContacts]
  )
  const hiddenContactCount = previewHiddenCount(displayContacts, showAllContacts)

  useEffect(() => {
    setShowAllContacts(false)
  }, [search, filterCompany])

  const pinnedCount = contacts.filter((c) => c.pinned).length
  const hasActiveSearch = search.trim() !== ""
  const hasCompanyFilter = filterCompany !== "All"
  const hasActiveFilters = hasActiveSearch || hasCompanyFilter

  function clearSearch() {
    setSearch("")
  }

  function clearCompanyFilter() {
    setFilterCompany("All")
  }

  function clearFilters() {
    clearSearch()
    clearCompanyFilter()
  }

  function companyFilterLabel(value) {
    if (value === "All") return "All companies"
    if (value === "__none__") return "No company listed"
    return value
  }

  async function save() {
    if (!form.name.trim()) return
    setActionError(null)
    const wasFirstContact = !editId && contacts.length === 0
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      company: form.company,
      role: form.role,
      notes: form.notes,
      lastContacted: form.lastContacted,
      linkedin: form.linkedin,
      website: form.website,
    }
    if (form.bucketAssignment === "none") payload.resumeBucketId = null
    else if (form.bucketAssignment !== "auto") payload.resumeBucketId = Number(form.bucketAssignment)
    try {
      if (editId) {
        await api.updateContact(editId, payload)
      } else {
        await api.createContact(payload)
      }
      const { contacts: list } = await api.getContacts()
      setContacts(list)
      localStorage.setItem("gb_contacts", JSON.stringify(list))
      setEditId(null)
      setForm(EMPTY)
      setShowForm(false)
      if (wasFirstContact) setShowFirstContactCelebration(true)
    } catch (e) {
      if (loadError) {
        let next
        if (editId) {
          next = contacts.map(c => c.id === editId ? { ...form, id: editId } : c)
        } else {
          next = [...contacts, { ...form, id: Date.now() }]
        }
        setContacts(next)
        localStorage.setItem("gb_contacts", JSON.stringify(next))
        setEditId(null)
        setForm(EMPTY)
        setShowForm(false)
        if (wasFirstContact) setShowFirstContactCelebration(true)
      } else {
        setActionError(e.message)
      }
    }
  }

  function edit(c) {
    setForm({
      ...EMPTY,
      ...c,
      bucketAssignment:
        c.resumeBucketId != null ? String(c.resumeBucketId) : "auto",
    })
    setEditId(c.id)
    setShowForm(true)
  }

  function suggestedBucketLabel(role) {
    const match = suggestResumeBucket(role, resumeBuckets)
    return match?.name || null
  }

  async function remove(id) {
    setActionError(null)
    try {
      await api.deleteContact(id)
      const { contacts: list } = await api.getContacts()
      setContacts(list)
      localStorage.setItem("gb_contacts", JSON.stringify(list))
    } catch (e) {
      if (loadError) {
        const next = contacts.filter(c => c.id !== id)
        setContacts(next)
        localStorage.setItem("gb_contacts", JSON.stringify(next))
      } else {
        setActionError(e.message)
      }
    }
  }

  async function togglePin(contact) {
    setActionError(null)
    const nextPinned = !contact.pinned
    try {
      await api.updateContact(contact.id, { pinned: nextPinned })
      const { contacts: list } = await api.getContacts()
      setContacts(list)
      localStorage.setItem("gb_contacts", JSON.stringify(list))
    } catch (e) {
      if (loadError) {
        const next = contacts.map((c) => (c.id === contact.id ? { ...c, pinned: nextPinned } : c))
        setContacts(next)
        localStorage.setItem("gb_contacts", JSON.stringify(next))
      } else {
        setActionError(e.message)
      }
    }
  }

  function openAddForm() {
    setShowForm(true)
    setEditId(null)
    setForm(EMPTY)
    setActionError(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY)
  }

  const isAdding = showForm && !editId
  const isEditing = showForm && editId

  function renderContactCard(c) {
    const displayName = formatContactName(c.name)
    const initials = displayName.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"
    const lastTouch = formatLastTouch(c.lastContacted)
    const rowClass = [
      "gb-contact-row",
      "gb-contact-row--hub",
      "gb-reveal-block",
      c.pinned ? "gb-contact-row--pinned" : "",
    ]
      .filter(Boolean)
      .join(" ")

    return (
      <article className={rowClass}>
        <div className="gb-contact-row__avatar" aria-hidden>
          {initials}
        </div>
        <div className="gb-contact-row__body">
          <div className="gb-contact-row__top">
            <span className="gb-contact-row__name">
              {displayName}
              {c.source === "gmail" && (
                <span
                  title="Added from your Gmail conversations"
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: 999,
                    border: "1px solid var(--gb-border)",
                    color: "var(--gb-text-muted)",
                    verticalAlign: "2px",
                  }}
                >
                  From Gmail
                </span>
              )}
            </span>
            {lastTouch && <span className="gb-contact-row__date">{lastTouch}</span>}
          </div>
          <div className="gb-contact-row__meta">
            {[c.role, c.company].filter(Boolean).join(" · ") || "No role or company yet"}
          </div>
          {c.pinned && <span className="gb-badge gb-badge--warn">Pinned</span>}
          {bucketNameForContact(c, resumeBuckets) && (
            <div className="gb-contact-row__meta" style={{ marginTop: 4 }}>
              Résumé · {bucketNameForContact(c, resumeBuckets)}
            </div>
          )}
          {(c.linkedin || c.website) && (
            <div className="gb-contact-row__links">
              {c.linkedin && (
                <a href={hrefFromUrl(c.linkedin)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  LinkedIn
                </a>
              )}
              {c.website && (
                <a href={hrefFromUrl(c.website)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  Website
                </a>
              )}
            </div>
          )}
          {c.notes && <p className="gb-contact-row__notes">{c.notes}</p>}
        </div>
        <div className="gb-contact-row__side">
          <div className="gb-contact-row__toolbar">
            <button type="button" onClick={() => openCompose(c)} {...primaryBtn({ sm: true })}>
              Message
            </button>
            <button
              type="button"
              onClick={() => togglePin(c)}
              aria-label={c.pinned ? `Unpin ${c.name}` : `Pin ${c.name} to top`}
              title={c.pinned ? "Unpin" : "Pin to top"}
              {...secondaryBtn({ sm: true })}
            >
              {c.pinned ? "Unpin" : "Pin"}
            </button>
            <button type="button" onClick={() => edit(c)} className={`${uiClass.btnGhost} ${uiClass.btnSm}`}>
              Edit
            </button>
            <button
              type="button"
              onClick={() => remove(c.id)}
              className={`${uiClass.btnGhost} ${uiClass.btnSm}`}
              style={{ color: "var(--gb-danger)" }}
            >
              Delete
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <PageShell>
      <div style={{ paddingBottom: 88 }}>
      <PageHero
        eyebrow="Network"
        title="Contact Hub"
        subtitle="Save people you've met — or discover new leads to reach out to. Draft outreach from compose, then track touchpoints on Tracker."
      >
        <p style={{ color: "var(--gb-text-muted)", fontSize: 15, fontFamily: font.body, marginTop: 10, marginBottom: 0 }}>
          {listLoading ? (
            "Loading…"
          ) : (
            <>
              <span style={{ fontFamily: font.mono, fontVariantNumeric: "tabular-nums" }}>{contacts.length}</span>
              {` contact${contacts.length !== 1 ? "s" : ""} in your network`}
              {pinnedCount > 0 && (
                <span style={{ color: "rgba(255,201,107,0.75)" }}>
                  {` · ${pinnedCount} pinned`}
                </span>
              )}
            </>
          )}
          {loadError && (
            <span style={{ display: "block", marginTop: 8, color: "var(--gb-warning)", fontSize: 13 }}>
              API unavailable — using local copy. Start the server and refresh to sync.
            </span>
          )}
        </p>
        {actionError && (
          <p style={{ color: "var(--gb-danger)", fontSize: 13, marginTop: 8, marginBottom: 0, fontFamily: font.body }}>{actionError}</p>
        )}
      </PageHero>

      {/* Primary action — add a contact */}
      {!isEditing && (
        <>
          <ContentCard
            style={{
              background: isAdding ? "rgba(184,255,87,0.06)" : "rgba(184,255,87,0.04)",
              border: isAdding ? "1px solid var(--gb-border-strong)" : "1px solid var(--gb-border-subtle)",
            }}
          >
            <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <CardTitle
              helper={
                isAdding
                  ? "Fill in their details in the form below. Role and notes help GhostBuster match résumé updates later."
                  : "Met someone worth staying in touch with? Add their profile — you can't message or track them until they're saved here."
              }
            >
              {isAdding ? "Add someone you met" : "Add someone to your network"}
            </CardTitle>
          </div>
          {!isAdding && (
            <button
              type="button"
              onClick={openAddForm}
              style={{
                background: "var(--gb-accent-bright)",
                color: "var(--gb-accent-text-on)",
                border: "1px solid rgba(10,15,9,0.22)",
                boxShadow: "none",
                padding: "13px 26px",
                borderRadius: 10,
                fontFamily: font.h1,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              + Add
            </button>
          )}
        </div>
          </ContentCard>
        </>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <>
          <ContentCard
            style={{
              border: "1px solid var(--gb-border-subtle)",
            }}
            padding="28px"
            marginBottom={28}
          >
          <CardTitle>{editId ? "Edit contact" : "New contact"}</CardTitle>
          {!editId && (
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--gb-text-faint)", lineHeight: 1.5, fontFamily: font.body }}>
              Name is required. Everything else helps with smarter outreach and résumé matching.
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { key: "name", placeholder: "Full name *" },
              { key: "email", placeholder: "Email" },
              { key: "phone", placeholder: "Phone" },
              { key: "company", placeholder: "Company" },
              { key: "role", placeholder: "Their role (e.g. Product Manager)" },
              { key: "linkedin", placeholder: "LinkedIn (URL or handle)" },
              { key: "website", placeholder: "Personal website" },
              { key: "lastContacted", placeholder: "Last contacted", type: "date" },
            ].map(f => (
              <input key={f.key} type={f.type || "text"} placeholder={f.placeholder}
                value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                style={inputStyle()}
              />
            ))}
            <select
              value={form.bucketAssignment}
              onChange={(e) => setForm({ ...form, bucketAssignment: e.target.value })}
              style={{ ...inputStyle(), gridColumn: "1 / -1" }}
            >
              <option value="auto">
                Auto-match résumé bucket from role
                {form.bucketAssignment === "auto" && form.role && suggestedBucketLabel(form.role)
                  ? ` → ${suggestedBucketLabel(form.role)}`
                  : ""}
              </option>
              <option value="none">No résumé bucket</option>
              {resumeBuckets.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {form.bucketAssignment === "auto" && form.role && (
            <p style={{ fontSize: 12, color: "var(--gb-text-faint)", marginTop: 8, marginBottom: 0, fontFamily: font.body }}>
              {suggestedBucketLabel(form.role)
                ? `Will match to "${suggestedBucketLabel(form.role)}" based on their role.`
                : "Add role buckets on the Resume tab to enable auto-matching."}
            </p>
          )}
          <textarea placeholder="Notes/reflections about this person..."
            value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            style={{ ...inputStyle(), marginTop: 14, height: 80, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={save} style={{
              background: "var(--gb-accent-bright)", color: "var(--gb-accent-text-on)", border: "1px solid rgba(10,15,9,0.22)", boxShadow: "none",
              padding: "10px 24px", borderRadius: 9, fontFamily: font.h1,
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>Save</button>
            <button onClick={closeForm} style={{
              background: "transparent", color: "var(--gb-text-muted)", border: "1px solid var(--gb-border-subtle)", boxShadow: "none",
              padding: "10px 24px", borderRadius: 9, fontFamily: font.body,
              fontSize: 14, cursor: "pointer",
            }}>Cancel</button>
          </div>
          </ContentCard>
        </>
      )}

      {/* Search + company filter */}
      <ContentCard className="gb-contacts-toolbar" padding="18px 20px" marginBottom={20}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <CardTitle helper="Search your saved contacts or narrow by company">Find in your network</CardTitle>
            {(hasActiveSearch || hasCompanyFilter) && (
              <button type="button" className="gb-link-btn" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

        <input
          id="contact-search"
          placeholder="Name, role, email, links…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle(), width: "100%", marginBottom: contacts.length > 0 ? 14 : 0 }}
        />

          {contacts.length > 0 && (companyOptions.withCompany.length > 0 || companyOptions.noCompany > 0) ? (
            <>
              <select
                id="contact-company-filter"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                style={{ ...inputStyle(), width: "100%", maxWidth: 320, marginBottom: companyOptions.withCompany.length > 0 ? 14 : 0 }}
              >
                <option value="All">All companies ({contacts.length})</option>
                {companyOptions.withCompany.map(({ name, count }) => (
                  <option key={name} value={name}>
                    {name} ({count})
                  </option>
                ))}
                {companyOptions.noCompany > 0 && (
                  <option value="__none__">No company listed ({companyOptions.noCompany})</option>
                )}
              </select>

              {companyOptions.withCompany.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setFilterCompany("All")}
                    style={{
                      background: filterCompany === "All" ? "rgba(184,255,87,0.14)" : "var(--gb-surface-hover)",
                      border: filterCompany === "All" ? "1px solid var(--gb-border-strong)" : "1px solid var(--gb-border-strong)",
                      color: filterCompany === "All" ? "var(--gb-accent)" : "var(--gb-text-subtle)",
                      padding: "6px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontFamily: font.body,
                      cursor: "pointer",
                      boxShadow: "none",
                    }}
                  >
                    All
                  </button>
                  {companyOptions.withCompany.map(({ name, count }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setFilterCompany(name)}
                      style={{
                        background: filterCompany === name ? "rgba(184,255,87,0.14)" : "var(--gb-surface-hover)",
                        border: filterCompany === name ? "1px solid var(--gb-border-strong)" : "1px solid var(--gb-border-strong)",
                        color: filterCompany === name ? "var(--gb-accent)" : "var(--gb-text-subtle)",
                        padding: "6px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontFamily: font.body,
                        cursor: "pointer",
                        boxShadow: "none",
                      }}
                    >
                      {name} ({count})
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--gb-text-faint)", fontFamily: font.body }}>
              No companies yet — add a company when you create or edit a contact.
            </p>
          )}
      </ContentCard>

      {hasActiveFilters && contacts.length > 0 && (
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--gb-text-muted)", fontFamily: font.body }}>
          Showing {filtered.length} of {contacts.length}
          {hasCompanyFilter && (
            <span>
              {" "}
              · Company: <strong style={{ color: "var(--gb-text-secondary)", fontWeight: 600 }}>{companyFilterLabel(filterCompany)}</strong>
            </span>
          )}
          {hasActiveSearch && (
            <span>
              {" "}
              · Search: <strong style={{ color: "var(--gb-text-secondary)", fontWeight: 600 }}>&quot;{search.trim()}&quot;</strong>
            </span>
          )}
        </p>
      )}

      {/* Contact List */}
      <CardTitle>Your contacts</CardTitle>
      {filtered.length === 0 ? (
        contacts.length === 0 ? (
          <EmptyState
            align="left"
            icon={<Icon name="users" size={32} color="currentColor" />}
            title="Your network starts with one contact"
            lede="Add someone from a career fair, intro, or coffee chat — then use Compose and Tracker to stay in touch."
            action={
              !isAdding ? (
                <button type="button" onClick={openAddForm} {...primaryBtn()}>
                  Add contact
                </button>
              ) : null
            }
          />
        ) : (
          <EmptyState
            title="No matches"
            lede="No contacts match your filters."
            action={
              hasActiveFilters ? (
                <button type="button" onClick={clearFilters} {...secondaryBtn()}>
                  Clear filters
                </button>
              ) : null
            }
          />
        )
      ) : (
        <div className="gb-contact-list gb-contact-list--hub">
          {visibleContacts.map((c, index) => {
            const hasPinned = visibleContacts.some((x) => x.pinned)
            const hasUnpinned = visibleContacts.some((x) => !x.pinned)
            const showPinnedHeader = hasPinned && hasUnpinned && index === 0 && c.pinned
            const showAllHeader = hasPinned && hasUnpinned && index > 0 && c.pinned === false && visibleContacts[index - 1]?.pinned
            return (
              <React.Fragment key={c.id}>
                {showPinnedHeader && <ListDivider tone="warn">Pinned</ListDivider>}
                {showAllHeader && <ListDivider>All contacts</ListDivider>}
                {renderContactCard(c)}
              </React.Fragment>
            )
          })}
          <ViewMoreButton
            hiddenCount={hiddenContactCount}
            showAll={showAllContacts}
            onToggle={() => setShowAllContacts((v) => !v)}
            singular="contact"
          />
        </div>
      )}

      <PeopleFinder
        onContactAdded={() =>
          api
            .getContacts()
            .then(({ contacts: list }) => setContacts(list))
            .catch(() => {})
        }
      />

      <GmailContacts
        onContactsChanged={() =>
          api
            .getContacts()
            .then(({ contacts: list }) => setContacts(list))
            .catch(() => {})
        }
      />

      <DiscoverConnections
        setPage={setPage}
        onSaved={async () => {
          try {
            const { contacts: list } = await api.getContacts()
            setContacts(list)
          } catch (e) {
            setActionError(e.message)
          }
        }}
      />

      </div>

      {showFirstContactCelebration && (
        <FirstContactCelebration onDone={() => setShowFirstContactCelebration(false)} />
      )}

      {/* Compose FAB / expandable panel */}
      <div
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        {composeOpen ? (
          <div
            ref={composeAreaRef}
            style={{
              position: "relative",
              width: composeSize.width,
              height: composeSize.height,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "calc(100vh - 40px)",
              background: "var(--gb-bg-elevated)",
              border: "1px solid var(--gb-border)",
              borderRadius: 20,
              boxShadow: "var(--gb-shadow-panel)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              role="separator"
              aria-label="Drag to resize compose panel"
              title="Drag to resize"
              onPointerDown={onComposeResizePointerDown}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 22,
                height: 22,
                zIndex: 2,
                cursor: "nwse-resize",
                touchAction: "none",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-start",
                padding: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path
                  d="M1 11h2M1 11V9M1 7h4M1 7V3M5 11h6M5 11V5"
                  stroke="var(--gb-text-faint)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
            <MessageComposer
              embedded
              contacts={contacts}
              composePrefill={activePrefill}
              onConsumePrefill={() => {
                setLocalComposePrefill(null)
                onConsumePrefill()
              }}
              googleNotice={googleNotice}
              onConsumeGoogleNotice={onConsumeGoogleNotice}
              onClose={closeCompose}
            />
          </div>
        ) : (
          <button
            type="button"
            className="gb-compose-fab"
            onClick={() => openCompose()}
            aria-label="Compose a message"
            title="Compose a message"
          >
            <Icon name="mail" size={18} color="var(--gb-accent-text-on)" />
            Compose
          </button>
        )}
      </div>
    </PageShell>
  )
}
