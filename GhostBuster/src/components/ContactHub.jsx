import React, { useState, useEffect, useMemo } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle } from "../uiStyles"
import { suggestResumeBucket, bucketNameForContact } from "../resumeBucketMatch"
import { PageShell, PageHero, ContentCard, CardTitle } from "../layout"

const EMPTY = {
  name: "", email: "", phone: "", company: "", role: "", notes: "", lastContacted: "",
  linkedin: "", website: "", bucketAssignment: "auto",
}

function hrefFromUrl(raw) {
  const t = (raw || "").trim()
  if (!t) return ""
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

export default function ContactHub() {
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
    return (
      <div
        style={{
          background: c.pinned ? "rgba(255,201,107,0.04)" : "var(--gb-bg-elevated)",
          border: c.pinned ? "1px solid rgba(255,201,107,0.22)" : "1px solid var(--gb-surface-active)",
          borderRadius: 14,
          padding: "18px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = c.pinned ? "rgba(255,201,107,0.35)" : "var(--gb-border-subtle)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = c.pinned ? "rgba(255,201,107,0.22)" : "var(--gb-surface-active)"
        }}
      >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: c.pinned ? "rgba(255,201,107,0.12)" : "rgba(184,255,87,0.1)",
                color: c.pinned ? "var(--gb-warning)" : "var(--gb-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: font.h1,
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {c.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                {c.pinned && (
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: font.mono,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "rgba(255,201,107,0.85)",
                      background: "rgba(255,201,107,0.1)",
                      border: "1px solid rgba(255,201,107,0.25)",
                      borderRadius: 6,
                      padding: "2px 7px",
                    }}
                  >
                    Pinned
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "var(--gb-text-muted)", marginTop: 2, fontFamily: font.body }}>
                {[c.role, c.company].filter(Boolean).join(" @ ")}
              </div>
              {bucketNameForContact(c, resumeBuckets) && (
                <div style={{ fontSize: 11, color: "rgba(91,228,216,0.65)", marginTop: 4, fontFamily: font.mono }}>
                  Résumé: {bucketNameForContact(c, resumeBuckets)}
                </div>
              )}
              {(c.linkedin || c.website) && (
                <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {c.linkedin && (
                    <a
                      href={hrefFromUrl(c.linkedin)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--gb-accent)", textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      LinkedIn
                    </a>
                  )}
                  {c.website && (
                    <a
                      href={hrefFromUrl(c.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#5be4d8", textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Website
                    </a>
                  )}
                </div>
              )}
              {c.notes && (
                <div style={{ fontSize: 12, color: "var(--gb-text-dim)", marginTop: 4, maxWidth: 400, fontFamily: font.body }}>
                  {c.notes}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {c.lastContacted && (
              <div
                style={{
                  fontSize: 11,
                  fontFamily: font.mono,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--gb-text-dim)",
                }}
              >
                {new Date(c.lastContacted).toLocaleDateString()}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => togglePin(c)}
                aria-label={c.pinned ? `Unpin ${c.name}` : `Pin ${c.name} to top`}
                title={c.pinned ? "Unpin" : "Pin to top"}
                style={{
                  background: c.pinned ? "rgba(255,201,107,0.12)" : "var(--gb-surface-muted)",
                  border: c.pinned ? "1px solid rgba(255,201,107,0.3)" : "1px solid var(--gb-border-subtle)",
                  boxShadow: "none",
                  color: c.pinned ? "var(--gb-warning)" : "var(--gb-text-subtle)",
                  padding: "6px 12px",
                  borderRadius: 7,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: font.mono,
                }}
              >
                {c.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                onClick={() => edit(c)}
                style={{
                  background: "var(--gb-surface-muted)",
                  border: "1px solid var(--gb-border-subtle)",
                  boxShadow: "none",
                  color: "var(--gb-text-subtle)",
                  padding: "6px 14px",
                  borderRadius: 7,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: font.mono,
                }}
              >
                Edit
              </button>
              <button
                onClick={() => remove(c.id)}
                style={{
                  background: "rgba(255,107,107,0.08)",
                  border: "1px solid rgba(255,107,107,0.15)",
                  boxShadow: "none",
                  color: "var(--gb-danger)",
                  padding: "6px 14px",
                  borderRadius: 7,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: font.mono,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
    )
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Network"
        title="Contact Hub"
        subtitle="Save people you've already met — career fairs, coffee chats, referrals. Add them here first, then reach out from Compose and track touchpoints on Tracker."
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

      {/* Search */}
      <ContentCard
        style={{
          background: "var(--gb-bg-elevated)",
          border: "1px solid var(--gb-border)",
        }}
        padding="18px 20px"
        marginBottom={16}
      >
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
          <CardTitle helper="Find a contact by name, role, or links">Search</CardTitle>
          {hasActiveSearch && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(184,255,87,0.75)",
                fontSize: 12,
                fontFamily: font.mono,
                cursor: "pointer",
                padding: 0,
                boxShadow: "none",
              }}
            >
              Clear search
            </button>
          )}
        </div>
        <input
          id="contact-search"
          placeholder="Name, role, email, links…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle(), width: "100%", maxWidth: 480 }}
        />
      </ContentCard>

      {/* Filter by company */}
      {contacts.length > 0 && (
        <>
          <ContentCard
            style={{
              background: "var(--gb-bg-elevated)",
              border: "1px solid var(--gb-border)",
            }}
            padding="18px 20px"
          >
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
            <CardTitle helper="Show only contacts from one company">Filter by company</CardTitle>
            {hasCompanyFilter && (
              <button
                type="button"
                onClick={clearCompanyFilter}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(184,255,87,0.75)",
                  fontSize: 12,
                  fontFamily: font.mono,
                  cursor: "pointer",
                  padding: 0,
                  boxShadow: "none",
                }}
              >
                Show all companies
              </button>
            )}
          </div>

          {companyOptions.withCompany.length > 0 || companyOptions.noCompany > 0 ? (
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
        </>
      )}

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
        <div style={{
          background: "var(--gb-bg-elevated)", border: "1px solid var(--gb-surface-active)",
          borderRadius: 14, padding: 48, textAlign: "center",
          color: "var(--gb-text-dim)", fontSize: 14, fontFamily: font.body
        }}>
          {contacts.length === 0 ? (
            <>
              <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.45 }}>👋</div>
              <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, color: "var(--gb-text-secondary)", marginBottom: 8 }}>
                Your network starts with one contact
              </div>
              <p style={{ margin: "0 0 20px", maxWidth: 420, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55, fontFamily: font.body }}>
                Add someone from a career fair, intro, or coffee chat — then use Compose and Tracker to stay in touch.
              </p>
              {!isAdding && (
                <button
                  type="button"
                  onClick={openAddForm}
                  style={{
                    background: "var(--gb-accent-bright)",
                    color: "var(--gb-accent-text-on)",
                    border: "1px solid rgba(10,15,9,0.22)",
                    boxShadow: "none",
                    padding: "12px 24px",
                    borderRadius: 10,
                    fontFamily: font.h1,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  + Add
                </button>
              )}
            </>
          ) : (
            <>
              No contacts match your filters.
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    display: "block",
                    margin: "16px auto 0",
                    background: "var(--gb-surface-active)",
                    border: "1px solid var(--gb-border)",
                    color: "var(--gb-text-secondary)",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "none",
                  }}
                >
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((c, index) => {
            const hasPinned = filtered.some((x) => x.pinned)
            const hasUnpinned = filtered.some((x) => !x.pinned)
            const showPinnedHeader = hasPinned && hasUnpinned && index === 0 && c.pinned
            const showAllHeader = hasPinned && hasUnpinned && index > 0 && c.pinned === false && filtered[index - 1]?.pinned
            return (
              <React.Fragment key={c.id}>
                {showPinnedHeader && (
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: font.mono,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "rgba(255,201,107,0.7)",
                      marginBottom: 2,
                    }}
                  >
                    Pinned
                  </div>
                )}
                {showAllHeader && (
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: font.mono,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--gb-text-dim)",
                      marginTop: 8,
                      marginBottom: 2,
                    }}
                  >
                    All contacts
                  </div>
                )}
                {renderContactCard(c)}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
