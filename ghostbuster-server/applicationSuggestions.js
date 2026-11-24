function jobSearchUrls(role, company) {
  const keywords = [role, company].filter(Boolean).join(" ").trim() || "internship"
  const googleQ = [role, company, "internship apply"].filter(Boolean).join(" ")
  return {
    linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}`,
    handshake: `https://app.joinhandshake.com/stu/postings?query=${encodeURIComponent(keywords)}`,
    google: `https://www.google.com/search?q=${encodeURIComponent(googleQ)}`,
  }
}

function buildPrompt({ careerGoals, resumeText, contacts, existing, userName }) {
  const maxChars = 8000
  const resumeBody =
    typeof resumeText === "string" && resumeText.length > maxChars
      ? `${resumeText.slice(0, maxChars)}\n[truncated]`
      : resumeText || "Not provided"

  const contactLines = (contacts || [])
    .slice(0, 25)
    .map((c) => `- ${c.company || "Unknown company"} (${c.role || "role unknown"})`)
    .join("\n")

  const existingLines = (existing || [])
    .slice(0, 30)
    .map((a) => `- ${a.role || "Role"} at ${a.company || "company"} [${a.status || "todo"}]`)
    .join("\n")

  return `You help a college student find internships and early-career roles to apply to.

User name: ${userName || "Not provided"}

Career goals:
${careerGoals || "Not provided"}

Résumé (for skills, majors, and experience — do not invent jobs they already have):
${resumeBody}

Companies they already know (from contacts):
${contactLines || "None"}

Applications already on their tracker (do not repeat these):
${existingLines || "None"}

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "suggestions": [
    {
      "company": "real company name",
      "role": "internship or early-career job title",
      "why": "1-2 sentences tying this to their goals, résumé, or contacts",
      "location": "city, remote, or university recruiting if unknown"
    }
  ]
}

Rules:
- Provide 5–8 suggestions.
- Prefer internships and new-grad roles over senior jobs.
- You may use well-known companies that hire students in their field. Prefer companies from their contacts when it fits.
- Do not invent a specific job posting ID or application URL.
- Do not repeat companies+roles already on their tracker.
- Be specific (role title + company), not generic ("tech internship").`
}

function parseSuggestionsJson(text) {
  const trimmed = String(text || "").trim()
  if (!trimmed) throw new Error("Empty response from model")
  let raw = trimmed
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) raw = fenced[1].trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("Model did not return JSON")
  const parsed = JSON.parse(raw.slice(start, end + 1))
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error("Invalid suggestions format")
  }
  return parsed.suggestions
    .map((s, index) => {
      const company = typeof s?.company === "string" ? s.company.trim() : ""
      const role = typeof s?.role === "string" ? s.role.trim() : ""
      if (!company && !role) return null
      const urls = jobSearchUrls(role, company)
      return {
        id: index + 1,
        company,
        role,
        why: typeof s?.why === "string" ? s.why.trim() : "",
        location: typeof s?.location === "string" ? s.location.trim() : "",
        url: urls.linkedin,
        urls,
      }
    })
    .filter(Boolean)
}

function fallbackSuggestions({ careerGoals, contacts, existing }) {
  const existingKeys = new Set(
    (existing || []).map((a) => `${(a.company || "").toLowerCase()}|${(a.role || "").toLowerCase()}`)
  )
  const fromContacts = (contacts || [])
    .filter((c) => c.company && c.company.trim())
    .slice(0, 5)
    .map((c, index) => {
      const company = c.company.trim()
      const role = (careerGoals || "").toLowerCase().includes("software")
        ? "Software engineering intern"
        : "Internship"
      if (existingKeys.has(`${company.toLowerCase()}|${role.toLowerCase()}`)) return null
      const urls = jobSearchUrls(role, company)
      return {
        id: index + 1,
        company,
        role,
        why: `You already know someone at ${company}. Search current openings and add the real application link.`,
        location: "",
        url: urls.linkedin,
        urls,
      }
    })
    .filter(Boolean)

  if (fromContacts.length > 0) return fromContacts

  const goal = String(careerGoals || "internship").trim().slice(0, 80) || "internship"
  const urls = jobSearchUrls(goal, "")
  return [
    {
      id: 1,
      company: "",
      role: goal,
      why: "Add your career goals and résumé for better matches. These search links help you find listings to save here.",
      location: "",
      url: urls.google,
      urls,
    },
  ]
}

module.exports = {
  jobSearchUrls,
  buildPrompt,
  parseSuggestionsJson,
  fallbackSuggestions,
}
