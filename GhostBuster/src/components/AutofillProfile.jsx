import React, { useEffect, useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { accentSoftBtn, inputStyle, primaryBtn } from "../uiStyles"
import { ContentCard, CardTitle } from "../layout"
import { syncProfileToExtension } from "../autofillBridge"

const SECTIONS = [
  {
    title: "Contact",
    fields: [
      ["firstName", "First name"],
      ["lastName", "Last name"],
      ["preferredName", "Preferred name"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["addressLine1", "Street address"],
      ["city", "City"],
      ["state", "State"],
      ["postalCode", "ZIP / postal code"],
      ["country", "Country"],
    ],
  },
  {
    title: "Links",
    fields: [
      ["linkedin", "LinkedIn URL"],
      ["github", "GitHub URL"],
      ["website", "Portfolio / website"],
    ],
  },
  {
    title: "Education & work",
    fields: [
      ["school", "School"],
      ["degree", "Degree (e.g. Bachelor of Science)"],
      ["major", "Major"],
      ["graduationDate", "Graduation (e.g. May 2027)"],
      ["gpa", "GPA"],
      ["currentCompany", "Current / most recent employer"],
      ["currentTitle", "Current / most recent title"],
    ],
  },
]

const YES_NO = [
  ["workAuthorized", "Authorized to work in the country you're applying in?"],
  ["needsSponsorship", "Will you need visa sponsorship?"],
]

const DECLINE = "Decline to self-identify"
const EEO = [
  ["gender", "Gender", ["Female", "Male", "Non-binary", DECLINE]],
  [
    "ethnicity",
    "Race / ethnicity",
    [
      "Asian",
      "Black or African American",
      "Hispanic or Latino",
      "White",
      "Native American or Alaska Native",
      "Native Hawaiian or Other Pacific Islander",
      "Two or More Races",
      DECLINE,
    ],
  ],
  ["veteran", "Veteran status", ["I am not a protected veteran", "I identify as one or more of the classifications of protected veteran", DECLINE]],
  ["disability", "Disability", ["No, I do not have a disability", "Yes, I have a disability", "I do not want to answer"]],
]

export default function AutofillProfile() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!open || form) return
    api
      .getAutofillProfile()
      .then(({ autofill }) => setForm(autofill || {}))
      .catch((e) => setMessage({ type: "error", text: e.message }))
  }, [open, form])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await api.patchProfile({ autofill: form })
      syncProfileToExtension()
      setMessage({ type: "success", text: "Autofill profile saved." })
    } catch (e) {
      setMessage({ type: "error", text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <ContentCard padding="18px 18px 16px" marginBottom={24}>
      <CardTitle helper="What the GhostBuster Autofill extension types into Workday, Greenhouse, Lever, and Ashby forms. Written questions are left for you.">
        Autofill profile
      </CardTitle>
      <button type="button" onClick={() => setOpen((v) => !v)} {...accentSoftBtn()}>
        {open ? "Hide profile" : "Edit autofill profile"}
      </button>

      {open && !form && !message && (
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--gb-text-faint)", fontFamily: font.body }}>Loading…</p>
      )}

      {open && form && (
        <div style={{ marginTop: 14 }}>
          {SECTIONS.map((section) => (
            <div key={section.title} style={{ marginBottom: 16 }}>
              <div style={sectionTitle()}>{section.title}</div>
              <div style={grid()}>
                {section.fields.map(([key, label]) => (
                  <input key={key} placeholder={label} aria-label={label} value={form[key] || ""} onChange={set(key)} style={inputStyle()} />
                ))}
              </div>
            </div>
          ))}

          <div style={sectionTitle()}>Eligibility</div>
          <div style={{ ...grid(), marginBottom: 16 }}>
            {YES_NO.map(([key, label]) => (
              <label key={key} style={selectLabel()}>
                {label}
                <select value={form[key] || ""} onChange={set(key)} style={inputStyle()}>
                  <option value="">Leave for me to answer</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </label>
            ))}
          </div>

          <div style={sectionTitle()}>Voluntary self-identification</div>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--gb-text-faint)", fontFamily: font.body }}>
            Optional. Left blank, these stay for you to answer on each application.
          </p>
          <div style={grid()}>
            {EEO.map(([key, label, options]) => (
              <label key={key} style={selectLabel()}>
                {label}
                <select value={form[key] || ""} onChange={set(key)} style={inputStyle()}>
                  <option value="">Leave for me to answer</option>
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18 }}>
            <button type="button" onClick={save} disabled={saving} {...primaryBtn()}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13,
            color: message.type === "error" ? "var(--gb-danger)" : "var(--gb-accent)",
            fontFamily: font.body,
          }}
        >
          {message.text}
        </p>
      )}
    </ContentCard>
  )
}

function grid() {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }
}

function sectionTitle() {
  return { fontFamily: font.mono, fontSize: 12, color: "var(--gb-text-subtle)", marginBottom: 8, textTransform: "uppercase" }
}

function selectLabel() {
  return { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--gb-text-muted)", fontFamily: font.body }
}

