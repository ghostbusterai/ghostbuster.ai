function buildAtsPrompt(resumeText, userName) {
  const maxChars = 14000
  const truncated = resumeText.length > maxChars
  const resumeBody = truncated ? resumeText.slice(0, maxChars) : resumeText

  return `Reformat this résumé as a single-column plain-text file for Workday and other ATS (applicant tracking systems).

User name (use only if it already appears, or as the first line if the extract is missing a name): ${userName || "Not provided"}

Source text (from a PDF/DOCX extract; it may have broken lines or odd spacing):
${resumeBody}
${truncated ? "\n[Note: résumé was truncated for length. Reformat only the content above.]\n" : ""}

Return ONLY the résumé text. No markdown fences, no commentary, no extra sections.

Rules:
- Keep every fact. Do not invent jobs, schools, dates, skills, metrics, or titles.
- You may fix wrapping, spacing, and section order (contact, summary, experience, education, skills, then other real sections).
- ASCII only: hyphen -, straight quotes, no tables or columns.
- Section headers in ALL CAPS on their own line (EXPERIENCE, EDUCATION, SKILLS, PROJECTS, etc.).
- Each job: Title, then Company | Location, then Dates, then bullets starting with "- ".
- Education: School, then Degree, then Dates.
- Contact on the first few lines: name, email, phone, LinkedIn/GitHub, city.
- One column. No page numbers.`
}

function parseAtsResponse(text) {
  let raw = String(text || "").trim()
  if (!raw) throw new Error("Empty response from model")
  const fenced = raw.match(/```(?:text|txt|markdown)?\s*([\s\S]*?)```/i)
  if (fenced) raw = fenced[1].trim()
  return raw
}

module.exports = { buildAtsPrompt, parseAtsResponse }
