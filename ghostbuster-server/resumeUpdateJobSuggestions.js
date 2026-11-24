const { jobSearchUrls, parseSuggestionsJson } = require("./applicationSuggestions")

function buildResumeUpdateJobPrompt({ update, careerGoals, resumeText, contacts, existing, userName }) {
  const maxChars = 6000
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

  const title = update?.title || "Résumé update"
  const details = update?.details || ""
  const effectiveDate = update?.effectiveDate || ""

  return `You help a college student find internships and early-career roles to apply to RIGHT AFTER a meaningful résumé/career update.

User name: ${userName || "Not provided"}

Career goals:
${careerGoals || "Not provided"}

Latest résumé update (PRIMARY signal — roles should reflect this new experience or direction):
Title: ${title}
Effective: ${effectiveDate || "not specified"}
Details:
${details}

Full résumé (background context; do not ignore the update above):
${resumeBody}

Companies they already know (from contacts):
${contactLines || "None"}

Applications already on their tracker (do not repeat these company+role pairs):
${existingLines || "None"}

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "suggestions": [
    {
      "company": "real company name",
      "role": "internship or early-career job title",
      "why": "1-2 sentences tying this role to their latest update AND career goals",
      "location": "city, remote, or unknown"
    }
  ]
}

Rules:
- Provide 5–8 suggestions.
- Every "why" must reference something from the latest update (title or details).
- Prefer internships and new-grad roles.
- Prefer companies from their contacts when plausible.
- Do not invent posting URLs or job IDs.
- Do not repeat company+role pairs already on their tracker.
- Be specific (title + company), not generic.`
}

function fallbackResumeUpdateJobSuggestions({ update, careerGoals, contacts, existing }) {
  const existingKeys = new Set(
    (existing || []).map((a) => `${(a.company || "").toLowerCase()}|${(a.role || "").toLowerCase()}`)
  )
  const headline = [update?.title, update?.details?.split("\n")[0]]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 120)
  const goal = String(careerGoals || headline || "internship").trim().slice(0, 80) || "internship"

  const fromContacts = (contacts || [])
    .filter((c) => c.company && c.company.trim())
    .slice(0, 4)
    .map((c, index) => {
      const company = c.company.trim()
      const role = goal.includes("intern") ? `${goal.split(" ")[0]} intern` : "Internship"
      if (existingKeys.has(`${company.toLowerCase()}|${role.toLowerCase()}`)) return null
      const urls = jobSearchUrls(role, company)
      return {
        id: index + 1,
        company,
        role,
        why: `Your update “${update?.title || "Résumé change"}” fits outreach at ${company}, where you already have a contact. Search live listings and save a real link.`,
        location: "",
        url: urls.linkedin,
        urls,
      }
    })
    .filter(Boolean)

  if (fromContacts.length > 0) return fromContacts

  const urls = jobSearchUrls(goal, "")
  return [
    {
      id: 1,
      company: "",
      role: goal,
      why: `Search roles aligned with your update “${update?.title || "Résumé change"}”. Add goals and a full résumé for sharper AI matches.`,
      location: "",
      url: urls.google,
      urls,
    },
  ]
}

module.exports = {
  buildResumeUpdateJobPrompt,
  parseSuggestionsJson,
  fallbackResumeUpdateJobSuggestions,
}