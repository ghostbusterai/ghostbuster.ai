import React, { useState, useEffect, useCallback, useMemo } from "react"
import { api } from "../api"
import { suggestContactsForUpdate } from "../updateRelevance"
import {
  buildResumeUpdateComposePayload,
  generateResumeUpdateOutreachMessage,
} from "../outreachMessage"
import { font } from "../theme"
import { inputStyle } from "../uiStyles"
import { readLocalProfile, saveLocalProfile } from "../profile"
import { contactsNeedingResumeNudge, buildResumeShareComposePrefill } from "../resumeNudge"
import { SUGGESTED_BUCKET_NAMES } from "../resumeBucketMatch"
import { PageShell, PageHero, ContentCard, CardTitle } from "../layout"
import ViewMoreButton from "./ViewMoreButton"
import { previewHiddenCount, previewSlice } from "../listPreview"

const LS_LOGS = "gb_outreach_logs"

const LS_UPDATES = "gb_resume_updates"
const LS_PROFILE = "gb_profile"
const LS_RESUME_BUCKETS = "gb_resume_buckets"

const ACCEPT_RESUME = ".pdf,.docx,.txt,.md,.text"
const ARCHIVE_PREVIEW_LIMIT = 3

const SUGGESTION_TYPES = {
  reword: { label: "Reword", color: "#5be4d8", bg: "rgba(91,228,216,0.12)" },
  replace: { label: "Replace activity", color: "var(--gb-warning)", bg: "rgba(255,201,107,0.12)" },
  add_metrics: { label: "Add data", color: "var(--gb-accent)", bg: "var(--gb-accent-soft)" },
  add: { label: "Add", color: "#b482ff", bg: "rgba(180,130,255,0.12)" },
  remove: { label: "Remove", color: "var(--gb-danger)", bg: "rgba(255,107,107,0.12)" },
  highlight: { label: "Highlight", color: "var(--gb-text)", bg: "var(--gb-border-strong)" },
}

function mergeProfileLastResume(effectiveDate) {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PROFILE) || "{}")
    const prev = raw.lastResumeUpdate || ""
    if (!prev || effectiveDate > prev) {
      raw.lastResumeUpdate = effectiveDate
      localStorage.setItem(LS_PROFILE, JSON.stringify(raw))
    }
  } catch {
    /* ignore */
  }
}

function readLocalResumeBuckets() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_RESUME_BUCKETS) || "[]")
    if (Array.isArray(raw)) return raw
  } catch {
    /* ignore */
  }
  try {
    const legacy = JSON.parse(localStorage.getItem("gb_full_resume") || "null")
    if (legacy && typeof legacy.text === "string" && legacy.text.trim()) {
      return [
        {
          id: Date.now(),
          name: "General",
          text: legacy.text.trim(),
          fileName: legacy.fileName || "",
          uploadedAt: legacy.uploadedAt || "",
          createdAt: legacy.uploadedAt || new Date().toISOString(),
          versions: [],
        },
      ]
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveLocalResumeBuckets(buckets) {
  localStorage.setItem(LS_RESUME_BUCKETS, JSON.stringify(buckets))
}

function archiveBucketResumeLocally(bucket) {
  if (!bucket?.text?.trim()) return bucket
  const versions = Array.isArray(bucket.versions) ? [...bucket.versions] : []
  versions.push({
    id: Date.now(),
    text: bucket.text.trim(),
    fileName: bucket.fileName || "",
    uploadedAt: bucket.uploadedAt || new Date().toISOString(),
    archivedAt: new Date().toISOString(),
  })
  return { ...bucket, versions }
}

function formatResumeDate(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10) || "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

async function readTextFileLocally(file) {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
  if (![".txt", ".md", ".text"].includes(ext)) {
    throw new Error("Offline mode supports TXT and MD only — start the server for PDF/DOCX.")
  }
  return file.text()
}

export default function Updates({ setPage, setComposePrefill }) {
  const [updates, setUpdates] = useState([])
  const [contacts, setContacts] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [details, setDetails] = useState("")
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [relevanceModal, setRelevanceModal] = useState(null)
  const [outreachByContact, setOutreachByContact] = useState({})
  const [copiedContactId, setCopiedContactId] = useState(null)
  const [profileName, setProfileName] = useState("")
  const [resumeBuckets, setResumeBuckets] = useState([])
  const [newBucketName, setNewBucketName] = useState("")
  const [creatingBucket, setCreatingBucket] = useState(false)
  const [uploadingBucketId, setUploadingBucketId] = useState(null)
  const [expandedBucketIds, setExpandedBucketIds] = useState({})
  const [dragOverBucketId, setDragOverBucketId] = useState(null)
  const [suggestionsBucketId, setSuggestionsBucketId] = useState(null)
  const [careerGoals, setCareerGoals] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState(null)
  const [resumeDate, setResumeDate] = useState("")
  const [savingResumeDate, setSavingResumeDate] = useState(false)
  const [outreachLogs, setOutreachLogs] = useState([])
  const [expandedArchiveIds, setExpandedArchiveIds] = useState({})
  const [archiveActionKey, setArchiveActionKey] = useState(null)
  const [showAllArchiveItems, setShowAllArchiveItems] = useState(false)
  const [showAllUpdatesHistory, setShowAllUpdatesHistory] = useState(false)

  const resumeArchiveItems = useMemo(() => {
    const items = []
    for (const bucket of resumeBuckets) {
      for (const version of bucket.versions || []) {
        items.push({
          ...version,
          bucketId: bucket.id,
          bucketName: bucket.name,
        })
      }
    }
    items.sort((a, b) => {
      const da = a.uploadedAt || a.archivedAt || ""
      const db = b.uploadedAt || b.archivedAt || ""
      return db.localeCompare(da)
    })
    return items
  }, [resumeBuckets])

  const hiddenArchiveCount = Math.max(0, resumeArchiveItems.length - ARCHIVE_PREVIEW_LIMIT)
  const visibleArchiveItems = showAllArchiveItems
    ? resumeArchiveItems
    : resumeArchiveItems.slice(0, ARCHIVE_PREVIEW_LIMIT)

  const sortedUpdatesHistory = useMemo(() => {
    return [...updates].sort((a, b) => {
      const da = a.createdAt || a.effectiveDate || ""
      const db = b.createdAt || b.effectiveDate || ""
      return db.localeCompare(da)
    })
  }, [updates])

  const visibleUpdatesHistory = useMemo(
    () => previewSlice(sortedUpdatesHistory, showAllUpdatesHistory),
    [sortedUpdatesHistory, showAllUpdatesHistory]
  )
  const hiddenUpdatesHistoryCount = previewHiddenCount(sortedUpdatesHistory, showAllUpdatesHistory)

  const resumeNudgeContacts = useMemo(
    () => contactsNeedingResumeNudge(contacts, outreachLogs, resumeDate),
    [contacts, outreachLogs, resumeDate]
  )

  const activeSuggestionsBucket = useMemo(() => {
    if (suggestionsBucketId != null) {
      return resumeBuckets.find((b) => b.id === suggestionsBucketId) || null
    }
    return resumeBuckets.find((b) => typeof b.text === "string" && b.text.trim()) || null
  }, [resumeBuckets, suggestionsBucketId])

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [{ updates: u }, { contacts: c }, bucketsOut, profileOut, logOut] = await Promise.all([
        api.getResumeUpdates(),
        api.getContacts(),
        api.getResumeBuckets(),
        api.getProfile(),
        api.getOutreachLogs(),
      ])
      setUpdates(u || [])
      setContacts(c || [])
      setOutreachLogs(logOut?.logs || [])
      setResumeBuckets(bucketsOut?.buckets || [])
      setCareerGoals(profileOut?.profile?.careerGoals?.trim() || "")
      setProfileName(profileOut?.profile?.name?.trim() || "")
      setResumeDate(profileOut?.profile?.lastResumeUpdate || "")
      if (profileOut?.profile) saveLocalProfile(profileOut.profile)
      localStorage.setItem(LS_UPDATES, JSON.stringify(u || []))
      localStorage.setItem("gb_contacts", JSON.stringify(c || []))
      localStorage.setItem(LS_LOGS, JSON.stringify(logOut?.logs || []))
      saveLocalResumeBuckets(bucketsOut?.buckets || [])
    } catch (e) {
      setLoadError(e.message)
      setUpdates(JSON.parse(localStorage.getItem(LS_UPDATES) || "[]"))
      setContacts(JSON.parse(localStorage.getItem("gb_contacts") || "[]"))
      setOutreachLogs(JSON.parse(localStorage.getItem(LS_LOGS) || "[]"))
      setResumeBuckets(readLocalResumeBuckets())
      const localProfile = readLocalProfile()
      setCareerGoals(localProfile.careerGoals?.trim() || "")
      setProfileName(localProfile.name?.trim() || "")
      setResumeDate(localProfile.lastResumeUpdate || "")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!relevanceModal) return
    function onKey(e) {
      if (e.key === "Escape") setRelevanceModal(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [relevanceModal])

  useEffect(() => {
    if (!relevanceModal) {
      setOutreachByContact({})
      setCopiedContactId(null)
      return
    }

    let cancelled = false
    const { update, relevance } = relevanceModal
    if (!relevance.length) return
    const initial = {}
    for (const row of relevance) {
      initial[row.contactId] = { loading: true, message: null, source: null, error: null }
    }
    setOutreachByContact(initial)

    for (const row of relevance) {
      const contact = contacts.find((c) => c.id === row.contactId) || row
      ;(async () => {
        try {
          const { message, source } = await generateResumeUpdateOutreachMessage({
            contact,
            update,
            reasons: row.reasons,
            senderName: profileName,
            composeFn: (body) => api.compose(body),
          })
          if (cancelled) return
          setOutreachByContact((prev) => ({
            ...prev,
            [row.contactId]: { loading: false, message, source, error: null },
          }))
        } catch (err) {
          if (cancelled) return
          setOutreachByContact((prev) => ({
            ...prev,
            [row.contactId]: {
              loading: false,
              message: null,
              source: null,
              error: err.message || "Could not generate message",
            },
          }))
        }
      })()
    }

    return () => {
      cancelled = true
    }
  }, [relevanceModal, contacts, profileName])

  async function saveResumeDate() {
    setActionError(null)
    setSavingResumeDate(true)
    try {
      const { profile: p } = await api.patchProfile({ lastResumeUpdate: resumeDate })
      saveLocalProfile(p)
      setResumeDate(p.lastResumeUpdate || resumeDate)
    } catch (err) {
      if (loadError) {
        const p = { ...readLocalProfile(), lastResumeUpdate: resumeDate }
        saveLocalProfile(p)
      } else {
        setActionError(err.message)
      }
    }
    setSavingResumeDate(false)
  }

  function openResumeCompose(contact) {
    setComposePrefill(buildResumeShareComposePrefill(contact, resumeDate))
    setPage("compose")
  }

  function openSaveResultModal(update, relevance, contactList) {
    const list = contactList ?? contacts
    let notice = null
    if (list.length === 0) notice = "no_contacts"
    else if (!relevance || relevance.length === 0) notice = "no_matches"
    setRelevanceModal({ update, relevance: relevance || [], notice })
  }

  function showOutreachForUpdate(update) {
    const relevance = suggestContactsForUpdate(contacts, update, {
      careerGoals,
      resumeText: resumeBuckets.find((b) => b.text?.trim())?.text || "",
    })
    openSaveResultModal(update, relevance)
  }

  async function saveUpdate(e) {
    e.preventDefault()
    if (!title.trim() || !details.trim()) return
    setActionError(null)
    setSaving(true)
    const payload = {
      title: title.trim(),
      details: details.trim(),
      effectiveDate,
    }

    try {
      const { update, relevance } = await api.createResumeUpdate(payload)
      const { contacts: latestContacts } = await api.getContacts()
      setContacts(latestContacts || [])
      localStorage.setItem("gb_contacts", JSON.stringify(latestContacts || []))
      setUpdates((prev) => {
        const next = [update, ...prev]
        localStorage.setItem(LS_UPDATES, JSON.stringify(next))
        return next
      })
      mergeProfileLastResume(update.effectiveDate)
      setResumeDate(readLocalProfile().lastResumeUpdate || update.effectiveDate)
      setTitle("")
      setDetails("")
      setEffectiveDate(new Date().toISOString().slice(0, 10))
      openSaveResultModal(update, relevance, latestContacts)
    } catch (err) {
      if (loadError) {
        const update = {
          id: Date.now(),
          title: payload.title,
          details: payload.details,
          effectiveDate: payload.effectiveDate,
          createdAt: new Date().toISOString(),
        }
        const relevance = suggestContactsForUpdate(contacts, payload, {
          careerGoals,
          resumeText: resumeBuckets.find((b) => b.text?.trim())?.text || "",
        })
        const next = [update, ...updates]
        setUpdates(next)
        localStorage.setItem(LS_UPDATES, JSON.stringify(next))
        mergeProfileLastResume(update.effectiveDate)
      setResumeDate(readLocalProfile().lastResumeUpdate || update.effectiveDate)
        setTitle("")
        setDetails("")
        setEffectiveDate(new Date().toISOString().slice(0, 10))
        openSaveResultModal(update, relevance)
      } else {
        setActionError(err.message)
      }
    }
    setSaving(false)
  }

  async function createBucket(name) {
    const trimmed = String(name || "").trim()
    if (!trimmed) return
    setActionError(null)
    setCreatingBucket(true)
    try {
      const { bucket } = await api.createResumeBucket({ name: trimmed })
      setResumeBuckets((prev) => {
        const next = [...prev, bucket]
        saveLocalResumeBuckets(next)
        return next
      })
      setNewBucketName("")
    } catch (err) {
      if (loadError) {
        const bucket = {
          id: Date.now(),
          name: trimmed,
          text: "",
          fileName: "",
          uploadedAt: "",
          createdAt: new Date().toISOString(),
          versions: [],
        }
        setResumeBuckets((prev) => {
          const next = [...prev, bucket]
          saveLocalResumeBuckets(next)
          return next
        })
        setNewBucketName("")
      } else {
        setActionError(err.message)
      }
    }
    setCreatingBucket(false)
  }

  async function removeBucket(id) {
    setActionError(null)
    try {
      await api.deleteResumeBucket(id)
      setResumeBuckets((prev) => {
        const next = prev.filter((b) => b.id !== id)
        saveLocalResumeBuckets(next)
        return next
      })
      if (suggestionsBucketId === id) {
        setSuggestionsBucketId(null)
        setSuggestions([])
      }
    } catch (err) {
      if (loadError) {
        setResumeBuckets((prev) => {
          const next = prev.filter((b) => b.id !== id)
          saveLocalResumeBuckets(next)
          return next
        })
      } else {
        setActionError(err.message)
      }
    }
  }

  async function handleResumeFile(file, bucketId) {
    if (!file || bucketId == null) return
    setActionError(null)
    setUploadingBucketId(bucketId)
    try {
      const { bucket } = await api.uploadBucketResume(bucketId, file)
      setResumeBuckets((prev) => {
        const next = prev.map((b) => (b.id === bucket.id ? bucket : b))
        saveLocalResumeBuckets(next)
        return next
      })
      setExpandedBucketIds((prev) => ({ ...prev, [bucketId]: false }))
      if (suggestionsBucketId == null) setSuggestionsBucketId(bucketId)
    } catch (err) {
      if (loadError) {
        try {
          const text = await readTextFileLocally(file)
          if (!text.trim()) throw new Error("File is empty")
          setResumeBuckets((prev) => {
            const next = prev.map((b) => {
              if (b.id !== bucketId) return b
              const archived = archiveBucketResumeLocally(b)
              return {
                ...archived,
                text: text.trim(),
                fileName: file.name,
                uploadedAt: new Date().toISOString(),
              }
            })
            saveLocalResumeBuckets(next)
            return next
          })
        } catch (localErr) {
          setActionError(localErr.message)
        }
      } else {
        setActionError(err.message)
      }
    }
    setUploadingBucketId(null)
  }

  async function fetchSuggestions() {
    const bucket = activeSuggestionsBucket
    if (!bucket?.text?.trim()) return
    setSuggestionsLoading(true)
    setSuggestionsError(null)
    try {
      const { suggestions: list } = await api.getResumeSuggestions(bucket.id)
      setSuggestions(Array.isArray(list) ? list : [])
      setSuggestionsBucketId(bucket.id)
    } catch (err) {
      setSuggestions([])
      setSuggestionsError(err.message)
    }
    setSuggestionsLoading(false)
  }

  function onResumeInputChange(e, bucketId) {
    const file = e.target.files?.[0]
    if (file) handleResumeFile(file, bucketId)
    e.target.value = ""
  }

  function onResumeDrop(e, bucketId) {
    e.preventDefault()
    setDragOverBucketId(null)
    const file = e.dataTransfer.files?.[0]
    if (file) handleResumeFile(file, bucketId)
  }

  async function removeBucketResume(bucketId) {
    setActionError(null)
    try {
      const { bucket } = await api.deleteBucketResume(bucketId)
      updateBucketInState(bucket)
      if (suggestionsBucketId === bucketId) {
        setSuggestions([])
        setSuggestionsError(null)
      }
    } catch (err) {
      if (loadError) {
        setResumeBuckets((prev) => {
          const next = prev.map((b) => {
            if (b.id !== bucketId || !b.text?.trim()) return b
            const archived = archiveBucketResumeLocally(b)
            return { ...archived, text: "", fileName: "", uploadedAt: "" }
          })
          saveLocalResumeBuckets(next)
          return next
        })
      } else {
        setActionError(err.message)
      }
    }
  }

  function updateBucketInState(bucket) {
    setResumeBuckets((prev) => {
      const next = prev.map((b) => (b.id === bucket.id ? bucket : b))
      saveLocalResumeBuckets(next)
      return next
    })
  }

  async function restoreArchiveItem(bucketId, versionId) {
    const actionKey = `restore-${bucketId}-${versionId}`
    setArchiveActionKey(actionKey)
    setActionError(null)
    try {
      const { bucket } = await api.restoreResumeVersion(bucketId, versionId)
      updateBucketInState(bucket)
    } catch (err) {
      if (loadError) {
        setResumeBuckets((prev) => {
          const next = prev.map((b) => {
            if (b.id !== bucketId) return b
            const version = (b.versions || []).find((v) => v.id === versionId)
            if (!version) return b
            let updated = b.text?.trim() ? archiveBucketResumeLocally(b) : { ...b }
            return {
              ...updated,
              text: version.text,
              fileName: version.fileName || "",
              uploadedAt: version.uploadedAt || new Date().toISOString(),
              versions: (updated.versions || []).filter((v) => v.id !== versionId),
            }
          })
          saveLocalResumeBuckets(next)
          return next
        })
      } else {
        setActionError(err.message)
      }
    }
    setArchiveActionKey(null)
  }

  async function deleteArchiveItem(bucketId, versionId) {
    const actionKey = `delete-${bucketId}-${versionId}`
    setArchiveActionKey(actionKey)
    setActionError(null)
    try {
      const { bucket } = await api.deleteResumeVersion(bucketId, versionId)
      updateBucketInState(bucket)
    } catch (err) {
      if (loadError) {
        setResumeBuckets((prev) => {
          const next = prev.map((b) =>
            b.id === bucketId
              ? { ...b, versions: (b.versions || []).filter((v) => v.id !== versionId) }
              : b
          )
          saveLocalResumeBuckets(next)
          return next
        })
      } else {
        setActionError(err.message)
      }
    }
    setArchiveActionKey(null)
  }

  async function remove(id) {
    setActionError(null)
    try {
      await api.deleteResumeUpdate(id)
      setUpdates((prev) => prev.filter((u) => u.id !== id))
      const next = updates.filter((u) => u.id !== id)
      localStorage.setItem(LS_UPDATES, JSON.stringify(next))
    } catch (err) {
      if (loadError) {
        const next = updates.filter((u) => u.id !== id)
        setUpdates(next)
        localStorage.setItem(LS_UPDATES, JSON.stringify(next))
      } else {
        setActionError(err.message)
      }
    }
  }

  function openComposeForContact(row, update) {
    const contact = contacts.find((c) => c.id === row.contactId) || row
    const draft = outreachByContact[row.contactId]
    setComposePrefill({
      ...buildResumeUpdateComposePayload(contact, update, row.reasons),
      ...(draft?.message ? { preGeneratedResult: draft.message } : {}),
    })
    setRelevanceModal(null)
    setPage("compose")
  }

  function copyOutreachMessage(contactId, message) {
    if (!message) return
    navigator.clipboard.writeText(message)
    setCopiedContactId(contactId)
    setTimeout(() => setCopiedContactId(null), 2000)
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Resume"
        title="Resume"
        subtitle="Log résumé or career changes here — no need to name contacts. Each update can optionally turn into matched outreach, AI-drafted messages, and follow-up reminders when you're ready."
      >
        {loadError && (
          <p style={{ color: "var(--gb-warning)", fontSize: 13, marginTop: 10, marginBottom: 0, fontFamily: font.body }}>
            API offline — saving locally. Run the server (with ANTHROPIC_API_KEY for best matching) to sync and use AI recommendations.
          </p>
        )}
        {actionError && <p style={{ color: "var(--gb-danger)", fontSize: 13, marginTop: 8, marginBottom: 0, fontFamily: font.body }}>{actionError}</p>}
      </PageHero>

      <ContentCard
        style={{
          border: "1px solid var(--gb-border-subtle)",
        }}
        padding="24px"
      >
        <CardTitle helper="When did you last refresh your résumé? We'll optionally suggest contacts you haven't messaged since then — with draft messages and reminders in Notifications when you want them.">
          Résumé last updated
        </CardTitle>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="date"
            value={resumeDate}
            onChange={(e) => setResumeDate(e.target.value)}
            style={{ ...inputStyle(), width: "auto" }}
          />
          <button
            type="button"
            onClick={saveResumeDate}
            disabled={savingResumeDate}
            style={{
              background: "var(--gb-accent-bright)",
              color: "var(--gb-accent-text-on)",
              border: "1px solid rgba(10,15,9,0.22)",
              boxShadow: "none",
              padding: "10px 20px",
              borderRadius: 9,
              fontFamily: font.h1,
              fontWeight: 700,
              cursor: savingResumeDate ? "wait" : "pointer",
            }}
          >
            {savingResumeDate ? "Saving…" : "Save date"}
          </button>
        </div>

        {resumeDate && resumeNudgeContacts.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: font.mono,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(91,228,216,0.75)",
                marginBottom: 10,
              }}
            >
              Share your update
            </div>
            <p style={{ fontSize: 13, color: "var(--gb-text-muted)", margin: "0 0 12px", lineHeight: 1.5, fontFamily: font.body }}>
              These contacts haven&apos;t heard from you since your last résumé update.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {resumeNudgeContacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "rgba(91,228,216,0.06)",
                    border: "1px solid rgba(91,228,216,0.18)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "var(--gb-text-faint)", marginTop: 2 }}>
                      {[c.role, c.company].filter(Boolean).join(" @ ") || "—"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openResumeCompose(c)}
                    style={{
                      background: "var(--gb-accent-soft)",
                      border: "1px solid var(--gb-border-subtle)",
                      color: "var(--gb-accent)",
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: font.body,
                      whiteSpace: "nowrap",
                      boxShadow: "none",
                    }}
                  >
                    Draft message →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {resumeDate && resumeNudgeContacts.length === 0 && contacts.length > 0 && (
          <p style={{ fontSize: 13, color: "var(--gb-text-faint)", marginTop: 16, marginBottom: 0, fontFamily: font.body }}>
            You&apos;re caught up — everyone has heard from you since this date.
          </p>
        )}
      </ContentCard>

      <ContentCard padding="24px">
        <CardTitle helper="Upload a résumé for each role you're targeting — for example, a PM version and a SWE version. Create a role bucket below, then drag in a PDF, DOCX, or text file. Contacts are auto-matched from their job role. Replacing or removing a résumé saves the previous version to your archive below.">
          Upload your résumé by role
        </CardTitle>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)", marginBottom: 8 }}>
            CREATE A BUCKET
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Role name, e.g. Product Management"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  createBucket(newBucketName)
                }
              }}
              style={{ ...inputStyle(), maxWidth: 320 }}
            />
            <button
              type="button"
              onClick={() => createBucket(newBucketName)}
              disabled={creatingBucket || !newBucketName.trim()}
              style={{
                background: newBucketName.trim() && !creatingBucket ? "var(--gb-accent-bright)" : "var(--gb-accent-soft)",
                color: newBucketName.trim() && !creatingBucket ? "var(--gb-accent-text-on)" : "var(--gb-accent-muted)",
                border: "1px solid var(--gb-border-subtle)",
                boxShadow: "none",
                padding: "10px 18px",
                borderRadius: 9,
                fontFamily: font.h1,
                fontWeight: 700,
                cursor: newBucketName.trim() && !creatingBucket ? "pointer" : "not-allowed",
              }}
            >
              {creatingBucket ? "Adding…" : "Add bucket"}
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "var(--gb-text-faint)", marginBottom: 8, fontFamily: font.mono }}>
              SUGGESTED ROLES
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTED_BUCKET_NAMES.filter(
                (name) => !resumeBuckets.some((b) => b.name.toLowerCase() === name.toLowerCase())
              ).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => createBucket(name)}
                  disabled={creatingBucket}
                  style={{
                    background: "var(--gb-surface-hover)",
                    border: "1px solid var(--gb-border-strong)",
                    color: "var(--gb-text-subtle)",
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    cursor: creatingBucket ? "wait" : "pointer",
                    fontFamily: font.body,
                    boxShadow: "none",
                  }}
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {resumeBuckets.length === 0 ? (
          <div
            style={{
              padding: "28px 20px",
              borderRadius: 12,
              border: "1px dashed var(--gb-border-strong)",
              textAlign: "center",
              color: "var(--gb-text-faint)",
              fontSize: 14,
            }}
          >
            No buckets yet — create one above, then upload a résumé for that role.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {resumeBuckets.map((bucket) => {
              const hasResume = Boolean(bucket.text?.trim())
              const uploading = uploadingBucketId === bucket.id
              const dragOver = dragOverBucketId === bucket.id
              const expanded = expandedBucketIds[bucket.id]
              const assignedCount = contacts.filter((c) => c.resumeBucketId === bucket.id).length
              return (
                <div
                  key={bucket.id}
                  style={{
                    borderRadius: 12,
                    border: "1px solid var(--gb-border-subtle)",
                    background: "rgba(184,255,87,0.03)",
                    padding: "16px 18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: hasResume ? 12 : 0,
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 16 }}>{bucket.name}</div>
                      <div style={{ fontSize: 12, color: "var(--gb-text-faint)", marginTop: 4 }}>
                        {assignedCount > 0
                          ? `${assignedCount} contact${assignedCount !== 1 ? "s" : ""} assigned`
                          : "No contacts assigned yet — we'll auto-match from their role"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBucket(bucket.id)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(255,107,107,0.25)",
                        color: "var(--gb-danger)",
                        padding: "5px 10px",
                        borderRadius: 7,
                        fontSize: 11,
                        cursor: "pointer",
                        boxShadow: "none",
                      }}
                    >
                      Delete bucket
                    </button>
                  </div>

                  {hasResume ? (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {bucket.fileName || "Résumé on file"}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontFamily: font.mono,
                              color: "var(--gb-accent-muted)",
                              marginTop: 4,
                            }}
                          >
                            Uploaded{" "}
                            {bucket.uploadedAt ? new Date(bucket.uploadedAt).toLocaleString() : "—"}
                            {" · "}
                            {bucket.text.length.toLocaleString()} characters
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <label
                            style={{
                              background: "var(--gb-accent-soft)",
                              border: "1px solid var(--gb-border-subtle)",
                              color: "var(--gb-accent)",
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontSize: 12,
                              cursor: uploading ? "not-allowed" : "pointer",
                              opacity: uploading ? 0.5 : 1,
                            }}
                          >
                            Replace
                            <input
                              type="file"
                              accept={ACCEPT_RESUME}
                              onChange={(e) => onResumeInputChange(e, bucket.id)}
                              disabled={uploading}
                              style={{ display: "none" }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeBucketResume(bucket.id)}
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(255,107,107,0.35)",
                              color: "var(--gb-danger)",
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontSize: 12,
                              cursor: "pointer",
                              boxShadow: "none",
                            }}
                          >
                            Remove file
                          </button>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--gb-text-subtle)",
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                          maxHeight: expanded ? "none" : 100,
                          overflow: expanded ? "visible" : "hidden",
                        }}
                      >
                        {bucket.text}
                      </div>
                      {bucket.text.length > 400 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBucketIds((prev) => ({ ...prev, [bucket.id]: !prev[bucket.id] }))
                          }
                          style={{
                            marginTop: 8,
                            background: "transparent",
                            border: "none",
                            color: "var(--gb-accent)",
                            fontSize: 13,
                            cursor: "pointer",
                            padding: 0,
                            boxShadow: "none",
                          }}
                        >
                          {expanded ? "Show less" : "Show full text"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <label
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverBucketId(bucket.id)
                      }}
                      onDragLeave={() => setDragOverBucketId(null)}
                      onDrop={(e) => onResumeDrop(e, bucket.id)}
                      style={{
                        display: "block",
                        marginTop: 12,
                        border: dragOver
                          ? "2px dashed var(--gb-accent-muted)"
                          : "2px dashed var(--gb-border)",
                        borderRadius: 10,
                        padding: "24px 16px",
                        textAlign: "center",
                        cursor: uploading ? "not-allowed" : "pointer",
                        background: dragOver ? "var(--gb-surface-hover)" : "var(--gb-surface-hover)",
                      }}
                    >
                      <input
                        type="file"
                        accept={ACCEPT_RESUME}
                        onChange={(e) => onResumeInputChange(e, bucket.id)}
                        disabled={uploading}
                        style={{ display: "none" }}
                      />
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                        {uploading ? "Processing…" : `Upload ${bucket.name} résumé`}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--gb-text-faint)" }}>
                        PDF, DOCX, TXT, or MD · max 5 MB
                      </div>
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ContentCard>

      <ContentCard padding="24px" style={{ border: "1px solid rgba(180,130,255,0.22)" }}>
        <CardTitle helper="Past résumés are saved automatically when you upload a new file or remove the current one. Browse by date to see how your résumé evolved over time.">
          Résumé archive
        </CardTitle>

        {resumeArchiveItems.length === 0 ? (
          <div
            style={{
              padding: "28px 20px",
              borderRadius: 12,
              border: "1px dashed var(--gb-border-strong)",
              textAlign: "center",
              color: "var(--gb-text-faint)",
              fontSize: 14,
            }}
          >
            No archived résumés yet — upload a new version to a role bucket and the previous file will appear here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleArchiveItems.map((item) => {
              const archiveKey = `${item.bucketId}-${item.id}`
              const expanded = expandedArchiveIds[archiveKey]
              const restoring = archiveActionKey === `restore-${archiveKey}`
              const deleting = archiveActionKey === `delete-${archiveKey}`
              return (
                <div
                  key={archiveKey}
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(180,130,255,0.18)",
                    background: "rgba(180,130,255,0.04)",
                    padding: "16px 18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 15 }}>{item.fileName || "Archived résumé"}</div>
                      <div style={{ fontSize: 12, color: "rgba(180,130,255,0.85)", marginTop: 4, fontFamily: font.mono }}>
                        {item.bucketName}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--gb-text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                        Uploaded {formatResumeDate(item.uploadedAt)}
                        {item.archivedAt ? ` · archived ${formatResumeDate(item.archivedAt)}` : ""}
                        {" · "}
                        {item.text.length.toLocaleString()} characters
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => restoreArchiveItem(item.bucketId, item.id)}
                        disabled={Boolean(archiveActionKey)}
                        style={{
                          background: restoring ? "var(--gb-accent-soft)" : "var(--gb-accent-soft)",
                          border: "1px solid var(--gb-border-subtle)",
                          color: "var(--gb-accent)",
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: archiveActionKey ? "not-allowed" : "pointer",
                          boxShadow: "none",
                        }}
                      >
                        {restoring ? "Restoring…" : "Restore"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteArchiveItem(item.bucketId, item.id)}
                        disabled={Boolean(archiveActionKey)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,107,107,0.35)",
                          color: "var(--gb-danger)",
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: archiveActionKey ? "not-allowed" : "pointer",
                          boxShadow: "none",
                        }}
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedArchiveIds((prev) => ({ ...prev, [archiveKey]: !prev[archiveKey] }))
                    }
                    style={{
                      marginTop: 12,
                      background: "transparent",
                      border: "none",
                      color: "var(--gb-text-subtle)",
                      fontSize: 12,
                      cursor: "pointer",
                      padding: 0,
                      boxShadow: "none",
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    {expanded ? "Hide text" : "Preview text"}
                  </button>
                  {expanded && (
                    <pre
                      style={{
                        marginTop: 12,
                        marginBottom: 0,
                        padding: "14px 16px",
                        borderRadius: 10,
                        background: "var(--gb-bg-input)",
                        border: "1px solid var(--gb-border-subtle)",
                        color: "var(--gb-text-secondary)",
                        fontSize: 12,
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 280,
                        overflow: "auto",
                        fontFamily: font.body,
                      }}
                    >
                      {item.text}
                    </pre>
                  )}
                </div>
              )
            })}
            {hiddenArchiveCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllArchiveItems((v) => !v)}
                style={{
                  alignSelf: "flex-start",
                  background: "var(--gb-surface-hover)",
                  border: "1px solid var(--gb-border)",
                  color: "var(--gb-text-secondary)",
                  padding: "10px 16px",
                  borderRadius: 9,
                  fontFamily: font.body,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  boxShadow: "none",
                }}
              >
                {showAllArchiveItems
                  ? "Show less"
                  : `Show ${hiddenArchiveCount} more archived résumé${hiddenArchiveCount !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        )}
      </ContentCard>

      <ContentCard padding="24px" style={{ border: "1px solid rgba(91,228,216,0.2)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <CardTitle helper="AI feedback tailored to your career goals — rewording, stronger activities, metrics, and more.">
              Suggested improvements
            </CardTitle>
          </div>
          <button
            type="button"
            onClick={fetchSuggestions}
            disabled={suggestionsLoading || !activeSuggestionsBucket?.text?.trim() || !careerGoals}
            style={{
              flexShrink: 0,
              background:
                suggestionsLoading || !activeSuggestionsBucket?.text?.trim() || !careerGoals
                  ? "rgba(91,228,216,0.15)"
                  : "rgba(91,228,216,0.2)",
              border: "1px solid rgba(91,228,216,0.4)",
              color:
                suggestionsLoading || !activeSuggestionsBucket?.text?.trim() || !careerGoals
                  ? "rgba(91,228,216,0.4)"
                  : "#5be4d8",
              padding: "9px 16px",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor:
                suggestionsLoading || !activeSuggestionsBucket?.text?.trim() || !careerGoals
                  ? "not-allowed"
                  : "pointer",
              boxShadow: "none",
            }}
          >
            {suggestionsLoading ? "Analyzing…" : suggestions.length ? "Refresh" : "Get suggestions"}
          </button>
        </div>

        {careerGoals && resumeBuckets.some((b) => b.text?.trim()) && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-faint)", marginRight: 10 }}>
              RÉSUMÉ BUCKET
            </label>
            <select
              value={activeSuggestionsBucket?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null
                setSuggestionsBucketId(id)
                setSuggestions([])
                setSuggestionsError(null)
              }}
              style={{ ...inputStyle(), width: "auto", maxWidth: 320, display: "inline-block" }}
            >
              {resumeBuckets
                .filter((b) => b.text?.trim())
                .map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        {!careerGoals && (
          <p style={{ color: "var(--gb-warning)", fontSize: 13, margin: "0 0 8px", fontFamily: font.body }}>
            Set career goals in your profile (top-right avatar) to unlock suggestions.
          </p>
        )}
        {careerGoals && !resumeBuckets.some((b) => b.text?.trim()) && (
          <p style={{ color: "var(--gb-warning)", fontSize: 13, margin: "0 0 8px", fontFamily: font.body }}>
            Upload a résumé to a role bucket above to get tailored feedback.
          </p>
        )}
        {careerGoals && activeSuggestionsBucket?.text?.trim() && (
          <div
            style={{
              fontSize: 12,
              fontFamily: font.mono,
              color: "var(--gb-accent-muted)",
              marginBottom: suggestions.length || suggestionsError ? 14 : 0,
            }}
          >
            Goals: {careerGoals.length > 120 ? `${careerGoals.slice(0, 120)}…` : careerGoals}
          </div>
        )}

        {suggestionsError && (
          <p style={{ color: "var(--gb-danger)", fontSize: 13, margin: "8px 0 0", fontFamily: font.body }}>{suggestionsError}</p>
        )}

        {suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            {suggestions.map((s) => {
              const meta = SUGGESTION_TYPES[s.type] || SUGGESTION_TYPES.reword
              return (
                <div
                  key={s.id}
                  style={{
                    background: "var(--gb-surface-hover)",
                    border: "1px solid var(--gb-border-subtle)",
                    borderRadius: 12,
                    padding: "16px 18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: font.mono,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: meta.color,
                        background: meta.bg,
                        padding: "4px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gb-text-strong)" }}>
                      {s.section}
                    </span>
                  </div>
                  {s.original && (
                    <div style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: font.mono,
                          color: "var(--gb-text-faint)",
                          marginBottom: 4,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Current
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--gb-text-muted)",
                          lineHeight: 1.5,
                          fontStyle: "italic",
                        }}
                      >
                        {s.original}
                      </div>
                    </div>
                  )}
                  {s.suggested && (
                    <div style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: font.mono,
                          color: "var(--gb-accent-muted)",
                          marginBottom: 4,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Suggested
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--gb-text-strong)",
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {s.suggested}
                      </div>
                    </div>
                  )}
                  {s.rationale && (
                    <div style={{ fontSize: 13, color: "var(--gb-text-subtle)", lineHeight: 1.5 }}>
                      {s.rationale}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ContentCard>

      <ContentCard padding="24px" marginBottom={36}>
        <CardTitle helper="Describe a résumé or career change in plain language. You don't have to message anyone right away — saving an update is the first step toward optional outreach later.">
          Career update
        </CardTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
            gap: 10,
            marginBottom: 20,
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--gb-surface-hover)",
            border: "1px solid var(--gb-border-subtle)",
          }}
        >
          {[
            {
              step: "1",
              title: "Save the update",
              detail: "Stored in History — no contacts named upfront.",
            },
            {
              step: "2",
              title: "Get matched contacts",
              detail: "We infer who cares based on their role and notes.",
            },
            {
              step: "3",
              title: "Follow up optionally",
              detail: "Open AI drafts in Compose or set a Reminders follow-up.",
            },
          ].map((item) => (
            <div key={item.step} style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: font.mono,
                  color: "var(--gb-accent-muted)",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                STEP {item.step}
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "var(--gb-text)" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>{item.detail}</div>
            </div>
          ))}
        </div>

        <form onSubmit={saveUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              style={{
                fontSize: 11,
                fontFamily: font.mono,
                color: "var(--gb-text-faint)",
                display: "block",
                marginBottom: 6,
              }}
            >
              TITLE *
            </label>
            <input
              placeholder="e.g. Added ML internship, shipped dashboard redesign"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle()}
            />
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label
                style={{
                  fontSize: 11,
                  fontFamily: font.mono,
                  color: "var(--gb-text-faint)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                EFFECTIVE DATE
              </label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} style={inputStyle()} />
            </div>
          </div>
          <div>
            <label
              style={{
                fontSize: 11,
                fontFamily: font.mono,
                color: "var(--gb-text-faint)",
                display: "block",
                marginBottom: 6,
              }}
            >
              DETAILS * (describe the update — we match it to contacts automatically)
            </label>
            <textarea
              placeholder="e.g. Shipped a recommendation feature, completed a data science internship, led a campus hackathon project… You don't need to name companies or people."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={7}
              style={{ ...inputStyle(), resize: "vertical", minHeight: 140 }}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !title.trim() || !details.trim()}
            style={{
              alignSelf: "flex-start",
              background: saving || !title.trim() || !details.trim() ? "var(--gb-accent-soft)" : "var(--gb-accent-bright)",
              color: saving || !title.trim() || !details.trim() ? "var(--gb-accent-muted)" : "var(--gb-accent-text-on)",
              border: saving || !title.trim() || !details.trim() ? "1px solid var(--gb-border-subtle)" : "1px solid rgba(10,15,9,0.22)",
              boxShadow: "none",
              padding: "11px 22px",
              borderRadius: 9,
              fontFamily: font.h1,
              fontWeight: 700,
              cursor: saving || !title.trim() || !details.trim() ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save update & see matches"}
          </button>
          <p style={{ margin: 0, fontSize: 12, color: "var(--gb-text-faint)", lineHeight: 1.5, maxWidth: 560, fontFamily: font.body }}>
            After saving, you can review optional message drafts. Set reminders anytime from the Reminders tab — we
            also surface nudges in Notifications when follow-ups are due.
          </p>
        </form>
      </ContentCard>

      <CardTitle helper="Past updates stay here. Re-open any entry for optional message ideas, then draft in Compose or add a reminder when you're ready to reach out.">
        History
      </CardTitle>
      {loading ? (
        <div style={{ color: "var(--gb-text-faint)" }}>Loading…</div>
      ) : updates.length === 0 ? (
        <div
          style={{
            background: "var(--gb-bg-elevated)",
            border: "1px solid var(--gb-surface-active)",
            borderRadius: 14,
            padding: 36,
            textAlign: "center",
            color: "var(--gb-text-faint)",
          }}
        >
          No updates yet — add your first one above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleUpdatesHistory.map((u) => (
            <div
              key={u.id}
              style={{
                background: "var(--gb-bg-elevated)",
                border: "1px solid var(--gb-border-subtle)",
                borderRadius: 14,
                padding: "18px 20px",
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 16 }}>{u.title}</div>
                <div style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-accent-muted)", marginTop: 6 }}>
                  Effective {u.effectiveDate || "—"}
                  {u.createdAt ? ` · logged ${new Date(u.createdAt).toLocaleDateString()}` : ""}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 14,
                    color: "var(--gb-text-subtle)",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {u.details}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => showOutreachForUpdate(u)}
                  style={{
                    background: "var(--gb-accent-soft)",
                    border: "1px solid var(--gb-border-subtle)",
                    color: "var(--gb-accent)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Message ideas →
                </button>
                <button
                  type="button"
                  onClick={() => remove(u.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,107,107,0.35)",
                    color: "var(--gb-danger)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: "pointer",
                    boxShadow: "none",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          <ViewMoreButton
            hiddenCount={hiddenUpdatesHistoryCount}
            showAll={showAllUpdatesHistory}
            onToggle={() => setShowAllUpdatesHistory((v) => !v)}
            singular="update"
          />
        </div>
      )}

      {relevanceModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rel-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 220,
            background: "rgba(6,6,10,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setRelevanceModal(null)}
        >
          <div
            style={{
              width: "min(680px, 100%)",
              maxHeight: "min(90vh, 760px)",
              background: "var(--gb-bg-elevated)",
              border: "1px solid rgba(255,201,107,0.35)",
              borderRadius: 18,
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--gb-border-subtle)" }}>
              <div
                id="rel-title"
                style={{
                  fontFamily: font.h1,
                  fontWeight: 800,
                  fontSize: 21,
                  letterSpacing: "-0.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 26 }}>✦</span>{" "}
                {relevanceModal.notice === "no_contacts"
                  ? "Update saved"
                  : relevanceModal.notice === "no_matches"
                    ? "Update saved — no matches yet"
                    : "Recommended outreach"}
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--gb-text-subtle)", lineHeight: 1.5, fontFamily: font.body }}>
                {relevanceModal.notice === "no_contacts" ? (
                  <>
                    Your update was saved, but there are no contacts yet. Add people on the{" "}
                    <strong style={{ color: "var(--gb-accent)" }}>Contacts</strong> page first — include their role,
                    company, and notes so we can recommend who to message.
                  </>
                ) : relevanceModal.notice === "no_matches" ? (
                  <>
                    Your update was saved. We couldn&apos;t find strong contact matches yet — fill in{" "}
                    <strong style={{ color: "var(--gb-accent)" }}>role, company, and notes</strong> on your contacts
                    (e.g. a consultant for a consulting club update) and try again.
                  </>
                ) : (
                  <>
                    These matches are optional. Copy an AI draft or open Compose to edit — then set a follow-up
                    reminder in Reminders if you want a nudge later (Notifications will flag due items).
                  </>
                )}
              </p>
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "var(--gb-accent-soft)",
                  border: "1px solid var(--gb-border-subtle)",
                  fontSize: 13,
                  color: "var(--gb-text-secondary)",
                }}
              >
                <strong style={{ color: "var(--gb-accent)" }}>{relevanceModal.update.title}</strong>
              </div>
            </div>
            <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
              {relevanceModal.notice && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: "rgba(255,201,107,0.06)",
                    border: "1px solid rgba(255,201,107,0.2)",
                    fontSize: 14,
                    color: "var(--gb-text-subtle)",
                    lineHeight: 1.55,
                  }}
                >
                  {relevanceModal.notice === "no_contacts"
                    ? "Tip: Even one contact with a role like “Consultant” or notes about their industry is enough for us to suggest outreach."
                    : "Tip: Restart isn’t needed — just add or edit contacts, then save another update (or re-save this one from History after deleting duplicates)."}
                </div>
              )}
              {relevanceModal.relevance.map((row) => {
                const outreach = outreachByContact[row.contactId] || { loading: true }
                return (
                <div
                  key={row.contactId}
                  style={{
                    marginBottom: 16,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "var(--gb-surface-hover)",
                    border: "1px solid var(--gb-border-subtle)",
                  }}
                >
                  <div style={{ fontFamily: font.h1, fontWeight: 700, fontSize: 15 }}>{row.name}</div>
                  <div style={{ fontSize: 12, color: "var(--gb-text-faint)", marginTop: 2 }}>
                    {[row.role, row.company].filter(Boolean).join(" @ ") || "—"}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: "rgba(184,255,87,0.85)",
                      lineHeight: 1.5,
                    }}
                  >
                    This fits well with {row.name.split(/\s+/)[0] || row.name}
                    {outreach.loading ? " — generating your message…" : ":"}
                  </div>
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--gb-text-subtle)", fontSize: 12, lineHeight: 1.5 }}>
                    {row.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <div
                    style={{
                      marginTop: 14,
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "var(--gb-surface-hover)",
                      border: "1px solid var(--gb-border-subtle)",
                      minHeight: 80,
                    }}
                  >
                    {outreach.loading && (
                      <div style={{ fontSize: 13, fontFamily: font.mono, color: "var(--gb-text-faint)" }}>
                        ✨ Composing message…
                      </div>
                    )}
                    {outreach.error && (
                      <div style={{ fontSize: 13, color: "var(--gb-danger)", lineHeight: 1.5 }}>{outreach.error}</div>
                    )}
                    {outreach.message && !outreach.loading && (
                      <>
                        {outreach.source === "template" && (
                          <div
                            style={{
                              fontSize: 11,
                              fontFamily: font.mono,
                              color: "rgba(255,201,107,0.75)",
                              marginBottom: 8,
                            }}
                          >
                            Template draft (add ANTHROPIC_API_KEY for AI polish)
                          </div>
                        )}
                        <pre
                          style={{
                            fontFamily: font.mono,
                            fontSize: 12,
                            lineHeight: 1.65,
                            color: "var(--gb-text)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            margin: 0,
                          }}
                        >
                          {outreach.message}
                        </pre>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => copyOutreachMessage(row.contactId, outreach.message)}
                      disabled={!outreach.message || outreach.loading}
                      style={{
                        background:
                          copiedContactId === row.contactId
                            ? "var(--gb-accent-soft)"
                            : "var(--gb-accent-soft)",
                        border: "1px solid var(--gb-border-subtle)",
                        color: outreach.message && !outreach.loading ? "var(--gb-accent)" : "var(--gb-accent-border)",
                        padding: "8px 14px",
                        borderRadius: 8,
                        fontSize: 13,
                        cursor: outreach.message && !outreach.loading ? "pointer" : "not-allowed",
                        fontFamily: font.body,
                        boxShadow: "none",
                      }}
                    >
                      {copiedContactId === row.contactId ? "Copied!" : "Copy message"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openComposeForContact(row, relevanceModal.update)}
                      disabled={outreach.loading}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--gb-border)",
                        color: outreach.loading ? "var(--gb-text-dim)" : "var(--gb-text-subtle)",
                        padding: "8px 14px",
                        borderRadius: 8,
                        fontSize: 13,
                        cursor: outreach.loading ? "not-allowed" : "pointer",
                        fontFamily: font.body,
                        boxShadow: "none",
                      }}
                    >
                      Customize in Compose →
                    </button>
                  </div>
                </div>
              )})}
            </div>
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid var(--gb-surface-active)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setRelevanceModal(null)
                  if (relevanceModal.notice === "no_contacts") setPage("contacts")
                }}
                style={{
                  background: relevanceModal.notice === "no_contacts" ? "var(--gb-accent-bright)" : "var(--gb-border-subtle)",
                  border:
                    relevanceModal.notice === "no_contacts"
                      ? "1px solid rgba(10,15,9,0.22)"
                      : "1px solid var(--gb-border)",
                  color: relevanceModal.notice === "no_contacts" ? "var(--gb-accent-text-on)" : "var(--gb-text)",
                  padding: "9px 18px",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: relevanceModal.notice === "no_contacts" ? 700 : 400,
                  cursor: "pointer",
                  boxShadow: "none",
                }}
              >
                {relevanceModal.notice === "no_contacts" ? "Add contacts →" : "Got it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
