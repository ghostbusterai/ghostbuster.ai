import React, { useState, useEffect, useMemo } from "react"
import { api } from "../api"
import { font } from "../theme"
import { suggestResumeBucket, bucketNameForContact } from "../resumeBucketMatch"

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

  const inputStyle = {
    background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "10px 14px", color: "#f0f0f5",
    fontSize: 14, fontFamily: font.body, width: "100%", outline: "none",
  }

  function renderContactCard(c) {
    return (
      <div
        style={{
          background: c.pinned ? "rgba(255,201,107,0.04)" : "#111118",
          border: c.pinned ? "1px solid rgba(255,201,107,0.22)" : "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
          padding: "18px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = c.pinned ? "rgba(255,201,107,0.35)" : "rgba(184,255,87,0.2)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = c.pinned ? "rgba(255,201,107,0.22)" : "rgba(255,255,255,0.06)"
        }}
      >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: c.pinned ? "rgba(255,201,107,0.12)" : "rgba(184,255,87,0.1)",
                color: c.pinned ? "#ffc96b" : "#b8ff57",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {c.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15 }}>{c.name}</div>
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
              <div style={{ fontSize: 13, color: "rgba(240,240,245,0.45)", marginTop: 2, fontFamily: font.body }}>
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
                      style={{ color: "#b8ff57", textDecoration: "none" }}
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
                <div style={{ fontSize: 12, color: "rgba(240,240,245,0.3)", marginTop: 4, maxWidth: 400, fontFamily: font.body }}>
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
                  color: "rgba(240,240,245,0.3)",
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
                  background: c.pinned ? "rgba(255,201,107,0.12)" : "rgba(255,255,255,0.05)",
                  border: c.pinned ? "1px solid rgba(255,201,107,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "none",
                  color: c.pinned ? "#ffc96b" : "rgba(240,240,245,0.55)",
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
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "none",
                  color: "rgba(240,240,245,0.6)",
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
                  color: "#ff6b6b",
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
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: font.mono, letterSpacing: "0.14em", color: "rgba(240,240,245,0.3)", textTransform: "uppercase", marginBottom: 8 }}>Network</div>
          <h1 style={{ fontFamily: font.display, fontWeight: 800, fontSize: 36, letterSpacing: "-1px", marginBottom: 8 }}>Contact Hub</h1>
          <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, fontFamily: font.body, maxWidth: 560, lineHeight: 1.55 }}>
            Save people you&apos;ve already met — career fairs, coffee chats, referrals. Add them here first, then
            reach out from Compose and track touchpoints on Tracker.
          </p>
          <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, fontFamily: font.body, marginTop: 8 }}>
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
              <span style={{ display: "block", marginTop: 8, color: "#ffc96b", fontSize: 13 }}>
                API unavailable — using local copy. Start the server and refresh to sync.
              </span>
            )}
          </p>
          {actionError && (
            <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{actionError}</p>
          )}
        </div>
      </div>

      {/* Primary action — add a contact */}
      {!isEditing && (
        <div
          style={{
            background: isAdding ? "rgba(184,255,87,0.06)" : "rgba(184,255,87,0.04)",
            border: isAdding ? "1px solid rgba(184,255,87,0.35)" : "1px solid rgba(184,255,87,0.22)",
            borderRadius: 16,
            padding: "20px 24px",
            marginBottom: isAdding ? 16 : 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: font.mono,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(184,255,87,0.75)",
                marginBottom: 6,
              }}
            >
              {isAdding ? "Step 1 on Contacts" : "Start here"}
            </div>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
              {isAdding ? "Add someone you met" : "Add someone to your network"}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "rgba(240,240,245,0.45)", lineHeight: 1.5 }}>
              {isAdding
                ? "Fill in their details in the form below. Role and notes help GhostBuster match résumé updates later."
                : "Met someone worth staying in touch with? Add their profile — you can\u2019t message or track them until they\u2019re saved here."}
            </p>
          </div>
          {!isAdding && (
            <button
              type="button"
              onClick={openAddForm}
              style={{
                background: "#b8ff57",
                color: "#0a0f09",
                border: "1px solid rgba(10,15,9,0.22)",
                boxShadow: "none",
                padding: "13px 26px",
                borderRadius: 10,
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              + Add someone you met
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{
          background: "#111118",
          border: editId ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(184,255,87,0.28)",
          borderRadius: 16,
          padding: 28,
          marginBottom: 28,
        }}>
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
            {editId ? "Edit contact" : "New contact"}
          </div>
          {!editId && (
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(240,240,245,0.4)", lineHeight: 1.5 }}>
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
                style={inputStyle}
              />
            ))}
            <select
              value={form.bucketAssignment}
              onChange={(e) => setForm({ ...form, bucketAssignment: e.target.value })}
              style={{ ...inputStyle, gridColumn: "1 / -1" }}
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
            <p style={{ fontSize: 12, color: "rgba(240,240,245,0.4)", marginTop: 8, marginBottom: 0 }}>
              {suggestedBucketLabel(form.role)
                ? `Will match to "${suggestedBucketLabel(form.role)}" based on their role.`
                : "Add role buckets on the Resume tab to enable auto-matching."}
            </p>
          )}
          <textarea placeholder="Notes/reflections about this person..."
            value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            style={{ ...inputStyle, marginTop: 14, height: 80, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={save} style={{
              background: "#b8ff57", color: "#0a0f09", border: "1px solid rgba(10,15,9,0.22)", boxShadow: "none",
              padding: "10px 24px", borderRadius: 9, fontFamily: font.display,
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>Save</button>
            <button onClick={closeForm} style={{
              background: "transparent", color: "rgba(240,240,245,0.45)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "none",
              padding: "10px 24px", borderRadius: 9, fontFamily: font.body,
              fontSize: 14, cursor: "pointer",
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div
        style={{
          marginBottom: 16,
          padding: "18px 20px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
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
          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: font.mono,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(240,240,245,0.35)",
                marginBottom: 4,
              }}
            >
              Search
            </div>
            <div style={{ fontSize: 14, color: "rgba(240,240,245,0.55)" }}>
              Find a contact by name, role, or links
            </div>
          </div>
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
          style={{ ...inputStyle, width: "100%", maxWidth: 480 }}
        />
      </div>

      {/* Filter by company */}
      {contacts.length > 0 && (
        <div
          style={{
            marginBottom: 24,
            padding: "18px 20px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
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
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: font.mono,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(240,240,245,0.35)",
                  marginBottom: 4,
                }}
              >
                Filter by company
              </div>
              <div style={{ fontSize: 14, color: "rgba(240,240,245,0.55)" }}>
                Show only contacts from one company
              </div>
            </div>
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
                style={{ ...inputStyle, width: "100%", maxWidth: 320, marginBottom: companyOptions.withCompany.length > 0 ? 14 : 0 }}
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
                      background: filterCompany === "All" ? "rgba(184,255,87,0.14)" : "rgba(255,255,255,0.04)",
                      border: filterCompany === "All" ? "1px solid rgba(184,255,87,0.35)" : "1px solid rgba(255,255,255,0.1)",
                      color: filterCompany === "All" ? "#b8ff57" : "rgba(240,240,245,0.65)",
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
                        background: filterCompany === name ? "rgba(184,255,87,0.14)" : "rgba(255,255,255,0.04)",
                        border: filterCompany === name ? "1px solid rgba(184,255,87,0.35)" : "1px solid rgba(255,255,255,0.1)",
                        color: filterCompany === name ? "#b8ff57" : "rgba(240,240,245,0.65)",
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
            <p style={{ margin: 0, fontSize: 13, color: "rgba(240,240,245,0.4)" }}>
              No companies yet — add a company when you create or edit a contact.
            </p>
          )}
        </div>
      )}

      {hasActiveFilters && contacts.length > 0 && (
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(240,240,245,0.45)" }}>
          Showing {filtered.length} of {contacts.length}
          {hasCompanyFilter && (
            <span>
              {" "}
              · Company: <strong style={{ color: "rgba(240,240,245,0.7)", fontWeight: 600 }}>{companyFilterLabel(filterCompany)}</strong>
            </span>
          )}
          {hasActiveSearch && (
            <span>
              {" "}
              · Search: <strong style={{ color: "rgba(240,240,245,0.7)", fontWeight: 600 }}>&quot;{search.trim()}&quot;</strong>
            </span>
          )}
        </p>
      )}

      {/* Contact List */}
      {filtered.length === 0 ? (
        <div style={{
          background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: 48, textAlign: "center",
          color: "rgba(240,240,245,0.3)", fontSize: 14, fontFamily: font.body
        }}>
          {contacts.length === 0 ? (
            <>
              <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.45 }}>👋</div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: "rgba(240,240,245,0.75)", marginBottom: 8 }}>
                Your network starts with one contact
              </div>
              <p style={{ margin: "0 0 20px", maxWidth: 420, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55 }}>
                Add someone from a career fair, intro, or coffee chat — then use Compose and Tracker to stay in touch.
              </p>
              {!isAdding && (
                <button
                  type="button"
                  onClick={openAddForm}
                  style={{
                    background: "#b8ff57",
                    color: "#0a0f09",
                    border: "1px solid rgba(10,15,9,0.22)",
                    boxShadow: "none",
                    padding: "12px 24px",
                    borderRadius: 10,
                    fontFamily: font.display,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  + Add someone you met
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
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(240,240,245,0.75)",
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
                      color: "rgba(240,240,245,0.3)",
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
    </div>
  )
}
