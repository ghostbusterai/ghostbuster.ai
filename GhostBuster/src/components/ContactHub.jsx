import React, { useState, useEffect } from "react"
import { api } from "../api"
import { font } from "../theme"

const EMPTY = {
  name: "", email: "", phone: "", company: "", role: "", notes: "", lastContacted: "",
  linkedin: "", website: "",
}

function hrefFromUrl(raw) {
  const t = (raw || "").trim()
  if (!t) return ""
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

export default function ContactHub() {
  const [contacts, setContacts] = useState([])
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
        const { contacts: list } = await api.getContacts()
        if (!cancelled) setContacts(list)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.message)
          setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
        }
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const companies = ["All", ...new Set(contacts.map(c => c.company).filter(Boolean))]

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = c.name.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.role?.toLowerCase().includes(q) ||
      c.linkedin?.toLowerCase().includes(q) ||
      c.website?.toLowerCase().includes(q)
    const matchCompany = filterCompany === "All" || c.company === filterCompany
    return matchSearch && matchCompany
  })

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
    setForm({ ...EMPTY, ...c })
    setEditId(c.id)
    setShowForm(true)
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

  const inputStyle = {
    background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "10px 14px", color: "#f0f0f5",
    fontSize: 14, fontFamily: font.body, width: "100%", outline: "none",
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: font.mono, letterSpacing: "0.14em", color: "rgba(240,240,245,0.3)", textTransform: "uppercase", marginBottom: 8 }}>Network</div>
          <h1 style={{ fontFamily: font.display, fontWeight: 800, fontSize: 36, letterSpacing: "-1px", marginBottom: 8 }}>Contact Hub</h1>
          <p style={{ color: "rgba(240,240,245,0.45)", fontSize: 15, fontFamily: font.body }}>
            {listLoading ? (
              "Loading…"
            ) : (
              <>
                <span style={{ fontFamily: font.mono, fontVariantNumeric: "tabular-nums" }}>{contacts.length}</span>
                {` contact${contacts.length !== 1 ? "s" : ""} in your network`}
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
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY) }} style={{
          background: "#b8ff57", color: "#0a0f09", border: "1px solid rgba(10,15,9,0.22)", boxShadow: "none",
          padding: "11px 22px", borderRadius: 10, fontFamily: font.display,
          fontWeight: 700, fontSize: 14, cursor: "pointer",
        }}>+ Add Contact</button>
      </div>

      {/* Search + Filter */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          placeholder="Search contacts..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 260 }}
        />
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{
          background: "#111118", border: "1px solid rgba(184,255,87,0.2)",
          borderRadius: 16, padding: 28, marginBottom: 28,
        }}>
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, marginBottom: 20 }}>
            {editId ? "Edit Contact" : "New Contact"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { key: "name", placeholder: "Full name *" },
              { key: "email", placeholder: "Email" },
              { key: "phone", placeholder: "Phone" },
              { key: "company", placeholder: "Company" },
              { key: "role", placeholder: "Relationship" },
              { key: "linkedin", placeholder: "LinkedIn (URL or handle)" },
              { key: "website", placeholder: "Personal website" },
              { key: "lastContacted", placeholder: "Last contacted", type: "date" },
            ].map(f => (
              <input key={f.key} type={f.type || "text"} placeholder={f.placeholder}
                value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                style={inputStyle}
              />
            ))}
          </div>
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
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY) }} style={{
              background: "transparent", color: "rgba(240,240,245,0.45)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "none",
              padding: "10px 24px", borderRadius: 9, fontFamily: font.body,
              fontSize: 14, cursor: "pointer",
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Contact List */}
      {filtered.length === 0 ? (
        <div style={{
          background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: 48, textAlign: "center",
          color: "rgba(240,240,245,0.3)", fontSize: 14, fontFamily: font.body
        }}>
          {contacts.length === 0 ? "No contacts yet — add your first one above!" : "No contacts match your search."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(c => (
            <div key={c.id} style={{
              background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: "18px 22px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "border-color 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(184,255,87,0.2)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: "rgba(184,255,87,0.1)", color: "#b8ff57",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: font.display, fontWeight: 700, fontSize: 16, flexShrink: 0
                }}>{c.name?.[0]?.toUpperCase() || "?"}</div>
                <div>
                  <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: "rgba(240,240,245,0.45)", marginTop: 2, fontFamily: font.body }}>
                    {[c.role, c.company].filter(Boolean).join(" @ ")}
                  </div>
                  {(c.linkedin || c.website) && (
                    <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {c.linkedin && (
                        <a href={hrefFromUrl(c.linkedin)} target="_blank" rel="noopener noreferrer"
                          style={{ color: "#b8ff57", textDecoration: "none" }}
                          onClick={e => e.stopPropagation()}
                        >LinkedIn</a>
                      )}
                      {c.website && (
                        <a href={hrefFromUrl(c.website)} target="_blank" rel="noopener noreferrer"
                          style={{ color: "#5be4d8", textDecoration: "none" }}
                          onClick={e => e.stopPropagation()}
                        >Website</a>
                      )}
                    </div>
                  )}
                  {c.notes && <div style={{ fontSize: 12, color: "rgba(240,240,245,0.3)", marginTop: 4, maxWidth: 400, fontFamily: font.body }}>{c.notes}</div>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {c.lastContacted && (
                  <div style={{ fontSize: 11, fontFamily: font.mono, fontVariantNumeric: "tabular-nums", color: "rgba(240,240,245,0.3)" }}>
                    {new Date(c.lastContacted).toLocaleDateString()}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => edit(c)} style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "none",
                    color: "rgba(240,240,245,0.6)", padding: "6px 14px", borderRadius: 7,
                    fontSize: 12, cursor: "pointer", fontFamily: font.mono,
                  }}>Edit</button>
                  <button onClick={() => remove(c.id)} style={{
                    background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)", boxShadow: "none",
                    color: "#ff6b6b", padding: "6px 14px", borderRadius: 7,
                    fontSize: 12, cursor: "pointer", fontFamily: font.mono,
                  }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
