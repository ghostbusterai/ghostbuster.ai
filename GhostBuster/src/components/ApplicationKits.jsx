import React, { useEffect, useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { inputStyle, primaryBtn, secondaryBtn } from "../uiStyles"
import { ContentCard, CardTitle } from "../layout"
import { emptyKit, mergeWrittenAnswers } from "../applicationMaterials"

export default function ApplicationKits({ kits, onKitsChange, onNotice }) {
  const [local, setLocal] = useState(kits || [])
  const [openId, setOpenId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocal(kits || [])
  }, [kits])

  async function persist(next) {
    setSaving(true)
    try {
      const { profile } = await api.patchProfile({ applicationKits: next })
      const saved = profile?.applicationKits || next
      setLocal(saved)
      onKitsChange?.(saved)
      onNotice?.({ type: "success", text: "Saved role kits." })
    } catch (e) {
      onNotice?.({ type: "error", text: e.message || "Could not save kits" })
    } finally {
      setSaving(false)
    }
  }

  function updateKit(id, patch) {
    setLocal((list) => list.map((k) => (k.id === id ? { ...k, ...patch } : k)))
  }

  function updateKitAnswer(id, index, field, value) {
    setLocal((list) =>
      list.map((k) => {
        if (k.id !== id) return k
        const answers = [...(k.answers || [])]
        answers[index] = { ...answers[index], [field]: value }
        return { ...k, answers }
      })
    )
  }

  function addKit() {
    const kit = { ...emptyKit(), name: "New role kit" }
    const next = [kit, ...local]
    setLocal(next)
    setOpenId(kit.id)
  }

  function removeKit(id) {
    const next = local.filter((k) => k.id !== id)
    setLocal(next)
    if (openId === id) setOpenId(null)
    persist(next)
  }

  return (
    <ContentCard padding="18px 18px 16px" marginBottom={24}>
      <CardTitle helper='One cover letter + written answers per role type (e.g. "Software engineering intern"). Use {{company}} and {{role}} in the letter — they swap in for each application.'>
        Reusable role kits
      </CardTitle>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--gb-text-muted)", lineHeight: 1.5, fontFamily: font.body }}>
        Link applications to a kit to reuse the same materials across companies. Per-application edits override the kit
        only for that job.
      </p>
      <div className="gb-application-kits__toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={addKit} {...primaryBtn({ sm: true })}>
          + Add role kit
        </button>
        {local.length > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => persist(local)}
            {...secondaryBtn({ sm: true, style: { opacity: saving ? 0.65 : 1 } })}
          >
            {saving ? "Saving…" : "Save kits"}
          </button>
        )}
      </div>
      {local.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--gb-text-faint)", fontFamily: font.body }}>
          No kits yet — add one for each type of role you apply to often.
        </p>
      ) : (
        <ul className="gb-application-kits__list">
          {local.map((kit) => {
            const open = openId === kit.id
            return (
              <li key={kit.id} className="gb-application-kits__item">
                <button
                  type="button"
                  className="gb-application-kits__head"
                  onClick={() => setOpenId(open ? null : kit.id)}
                >
                  <span className="gb-application-kits__name">{kit.name || "Untitled kit"}</span>
                  <span className="gb-application-kits__meta">
                    {(kit.answers || []).length} answer{(kit.answers || []).length === 1 ? "" : "s"}
                    {kit.coverLetter ? " · cover letter" : ""}
                  </span>
                </button>
                {open && (
                  <div className="gb-application-kits__body">
                    <label className="gb-application-kits__label">
                      Kit name
                      <input
                        value={kit.name}
                        onChange={(e) => updateKit(kit.id, { name: e.target.value })}
                        placeholder="e.g. Software engineering intern"
                        style={{ ...inputStyle(), marginTop: 6 }}
                      />
                    </label>
                    <label className="gb-application-kits__label">
                      Role keywords (comma-separated, for auto-suggest)
                      <input
                        value={kit.roleKeywords || ""}
                        onChange={(e) => updateKit(kit.id, { roleKeywords: e.target.value })}
                        placeholder="swe intern, software engineer intern"
                        style={{ ...inputStyle(), marginTop: 6 }}
                      />
                    </label>
                    <label className="gb-application-kits__label">
                      Cover letter template
                      <textarea
                        value={kit.coverLetter || ""}
                        onChange={(e) => updateKit(kit.id, { coverLetter: e.target.value })}
                        placeholder="Dear hiring team at {{company}}, …"
                        rows={6}
                        style={{ ...inputStyle(), marginTop: 6, width: "100%", resize: "vertical", minHeight: 120 }}
                      />
                    </label>
                    <div className="gb-application-kits__answers">
                      <span className="gb-application-kits__label" style={{ display: "block", marginBottom: 8 }}>
                        Reusable written answers
                      </span>
                      {(kit.answers || []).map((row, i) => (
                        <div key={`${kit.id}-a-${i}`} className="gb-application-kits__answer-row">
                          <input
                            value={row.prompt}
                            onChange={(e) => updateKitAnswer(kit.id, i, "prompt", e.target.value)}
                            placeholder="Question label (match form wording)"
                            style={{ ...inputStyle(), margin: 0 }}
                          />
                          <textarea
                            value={row.answer}
                            onChange={(e) => updateKitAnswer(kit.id, i, "answer", e.target.value)}
                            placeholder="Your answer"
                            rows={3}
                            style={{ ...inputStyle(), margin: 0, width: "100%", resize: "vertical" }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateKit(kit.id, {
                                answers: (kit.answers || []).filter((_, j) => j !== i),
                              })
                            }
                            {...secondaryBtn({ sm: true })}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateKit(kit.id, {
                            answers: [...(kit.answers || []), { prompt: "", answer: "" }],
                          })
                        }
                        {...secondaryBtn({ sm: true })}
                      >
                        + Add answer
                      </button>
                    </div>
                    <div className="gb-application-kits__footer">
                      <button type="button" disabled={saving} onClick={() => persist(local)} {...primaryBtn({ sm: true })}>
                        Save kit
                      </button>
                      <button type="button" onClick={() => removeKit(kit.id)} {...secondaryBtn({ sm: true })}>
                        Delete kit
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </ContentCard>
  )
}

/** Apply kit + app overrides to preview count for badge */
export function materialSummary(application, kits) {
  const kit = (kits || []).find((k) => k.id === application?.kitId)
  const answers = mergeWrittenAnswers(kit?.answers, application?.writtenAnswers)
  const hasCover = Boolean((application?.coverLetter || "").trim() || (kit?.coverLetter || "").trim())
  return { answerCount: answers.length, hasCover, kitName: kit?.name || "" }
}