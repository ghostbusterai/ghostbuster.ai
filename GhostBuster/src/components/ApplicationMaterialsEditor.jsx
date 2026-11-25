import React, { useEffect, useMemo, useState } from "react"
import { font } from "../theme"
import { inputStyle, primaryBtn, secondaryBtn } from "../uiStyles"
import { mergeWrittenAnswers, substituteTemplate, suggestKitId } from "../applicationMaterials"
import { materialSummary } from "./ApplicationKits"

export default function ApplicationMaterialsEditor({
  application,
  kits,
  peerApplications,
  onSave,
  saving,
}) {
  const [open, setOpen] = useState(false)
  const [kitId, setKitId] = useState(application?.kitId || "")
  const [coverLetter, setCoverLetter] = useState(application?.coverLetter || "")
  const [writtenAnswers, setWrittenAnswers] = useState(application?.writtenAnswers || [])
  const [copyFromId, setCopyFromId] = useState("")

  useEffect(() => {
    setKitId(application?.kitId || "")
    setCoverLetter(application?.coverLetter || "")
    setWrittenAnswers(Array.isArray(application?.writtenAnswers) ? application.writtenAnswers : [])
  }, [application?.id, application?.kitId, application?.coverLetter, application?.writtenAnswers])

  useEffect(() => {
    if (kitId || !application?.role || !kits?.length) return
    const suggested = suggestKitId(application.role, kits)
    if (suggested) setKitId(suggested)
  }, [application?.role, kits, kitId])

  const kit = kits.find((k) => k.id === kitId) || null
  const previewCover = useMemo(() => {
    const template = (coverLetter || "").trim() || (kit?.coverLetter || "").trim()
    return substituteTemplate(template, { company: application?.company, role: application?.role })
  }, [coverLetter, kit, application?.company, application?.role])

  const mergedCount = mergeWrittenAnswers(kit?.answers, writtenAnswers).length
  const summary = materialSummary({ ...application, kitId, coverLetter, writtenAnswers }, kits)

  const copySources = (peerApplications || []).filter(
    (p) => p.id !== application?.id && (p.kitId || p.coverLetter || p.writtenAnswers?.length)
  )

  function copyFromPeer() {
    const src = copySources.find((p) => String(p.id) === String(copyFromId))
    if (!src) return
    if (src.kitId) setKitId(src.kitId)
    if (src.coverLetter) setCoverLetter(src.coverLetter)
    if (src.writtenAnswers?.length) setWrittenAnswers(src.writtenAnswers.map((r) => ({ ...r })))
  }

  async function handleSave() {
    await onSave({
      kitId: kitId || "",
      coverLetter,
      writtenAnswers: writtenAnswers.filter((r) => r.prompt?.trim() && r.answer?.trim()),
    })
    setOpen(false)
  }

  return (
    <div className="gb-app-materials">
      <button type="button" className="gb-app-materials__toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide" : "Edit"} materials
        <span className="gb-app-materials__badge">
          {summary.kitName || "No kit"}
          {summary.hasCover ? " · letter" : ""}
          {mergedCount ? ` · ${mergedCount} answers` : ""}
        </span>
      </button>
      {open && (
        <div className="gb-app-materials__panel">
          <label className="gb-application-kits__label" style={{ display: "block", marginBottom: 10 }}>
            Role kit
            <select
              value={kitId}
              onChange={(e) => setKitId(e.target.value)}
              style={{ ...inputStyle(), marginTop: 6, width: "100%", maxWidth: 360 }}
            >
              <option value="">None — only this application</option>
              {(kits || []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          {copySources.length > 0 && (
            <div className="gb-app-materials__copy" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <select
                value={copyFromId}
                onChange={(e) => setCopyFromId(e.target.value)}
                style={{ ...inputStyle(), flex: 1, minWidth: 160, margin: 0 }}
              >
                <option value="">Copy from another application…</option>
                {copySources.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.role, p.company].filter(Boolean).join(" @ ") || `Application ${p.id}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!copyFromId}
                onClick={copyFromPeer}
                {...secondaryBtn({ sm: true })}
              >
                Copy
              </button>
            </div>
          )}
          <label className="gb-application-kits__label" style={{ display: "block", marginBottom: 10 }}>
            Cover letter override{" "}
            <span style={{ fontWeight: 400, color: "var(--gb-text-faint)" }}>(blank = use kit template)</span>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder={kit?.coverLetter ? "Using kit template…" : "Optional cover letter for this company"}
              rows={5}
              style={{ ...inputStyle(), marginTop: 6, width: "100%", resize: "vertical", minHeight: 100 }}
            />
          </label>
          {previewCover ? (
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                color: "var(--gb-text-muted)",
                lineHeight: 1.45,
                fontFamily: font.body,
                whiteSpace: "pre-wrap",
              }}
            >
              <span style={{ fontFamily: font.mono, color: "var(--gb-text-faint)" }}>Autofill preview: </span>
              {previewCover.slice(0, 280)}
              {previewCover.length > 280 ? "…" : ""}
            </p>
          ) : null}
          <div className="gb-application-kits__answers">
            <span className="gb-application-kits__label" style={{ display: "block", marginBottom: 8 }}>
              Extra / overridden answers for this application
            </span>
            {(writtenAnswers || []).map((row, i) => (
              <div key={`wa-${i}`} className="gb-application-kits__answer-row">
                <input
                  value={row.prompt}
                  onChange={(e) => {
                    const next = [...writtenAnswers]
                    next[i] = { ...next[i], prompt: e.target.value }
                    setWrittenAnswers(next)
                  }}
                  placeholder="Question (e.g. Why this company?)"
                  style={{ ...inputStyle(), margin: 0 }}
                />
                <textarea
                  value={row.answer}
                  onChange={(e) => {
                    const next = [...writtenAnswers]
                    next[i] = { ...next[i], answer: e.target.value }
                    setWrittenAnswers(next)
                  }}
                  rows={3}
                  style={{ ...inputStyle(), margin: 0, width: "100%", resize: "vertical" }}
                />
                <button
                  type="button"
                  onClick={() => setWrittenAnswers(writtenAnswers.filter((_, j) => j !== i))}
                  {...secondaryBtn({ sm: true })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setWrittenAnswers([...(writtenAnswers || []), { prompt: "", answer: "" }])}
              {...secondaryBtn({ sm: true })}
            >
              + Add answer
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" disabled={saving} onClick={handleSave} {...primaryBtn({ sm: true })}>
              {saving ? "Saving…" : "Save materials"}
            </button>
            <button type="button" onClick={() => setOpen(false)} {...secondaryBtn({ sm: true })}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}