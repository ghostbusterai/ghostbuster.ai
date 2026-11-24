const { peopleSearchUrls } = require("./publicPeopleSearch")

function buildProfileDiscoverPrompt({
  careerGoals,
  resumeText,
  contacts,
  applications,
  recentUpdate,
  userName,
  school,
}) {
  const maxChars = 6000
  const resumeBody =
    typeof resumeText === "string" && resumeText.length > maxChars
      ? `${resumeText.slice(0, maxChars)}\n[truncated]`
      : resumeText || "Not provided"

  const existingLines = (contacts || [])
    .slice(0, 25)
    .map((c) => `- ${c.name} (${c.role || "role unknown"} @ ${c.company || "?"})`)
    .join("\n")

  const appLines = (applications || [])
    .filter((a) => a.status !== "completed")
    .slice(0, 15)
    .map((a) => `- ${a.role || "Role"} at ${a.company || "company"}`)
    .join("\n")

  const updateBlock = recentUpdate
    ? `Latest résumé update: "${recentUpdate.title}" — ${String(recentUpdate.details || "").slice(0, 400)}`
    : "No recent résumé update logged."

  return `You help a college student discover WHO to network with next — based entirely on their GhostBuster profile (not a manual search).

User name: ${userName || "Not provided"}
School: ${school || "Not provided"}

Career goals (primary signal):
${careerGoals || "Not set — infer reasonable student internship targets from résumé only."}

${updateBlock}

Résumé:
${resumeBody}

People already saved (do not duplicate by name):
${existingLines || "None"}

Applications in progress (prefer complementary networking, not duplicates of these roles):
${appLines || "None"}

Return ONLY valid JSON (no markdown fences):
{
  "suggestions": [
    {
      "name": "full name OR empty if role archetype only",
      "role": "title",
      "company": "organization",
      "why": "1-2 sentences tied to THEIR goals, résumé, or update",
      "outreachAngle": "one sentence opener",
      "sourceHint": "where to verify (team page, alumni, conference, LinkedIn search)"
    }
  ]
}

Rules:
- 6–8 suggestions: recruiters/hiring managers at target companies, alumni, peers one step ahead, mentors.
- Tie every "why" to something in their goals, résumé, or latest update when possible.
- NEVER invent emails, phone numbers, or private profile URLs.
- Names only when you are highly confident they are public figures; otherwise role+company.
- Prefer companies where they have a contact OR are already applying — suggest the right person to ask inside that org.`
}

function buildPrompt({ criteria, careerGoals, resumeText, contacts, userName }) {
  const maxChars = 6000
  const resumeBody =
    typeof resumeText === "string" && resumeText.length > maxChars
      ? `${resumeText.slice(0, maxChars)}\n[truncated]`
      : resumeText || "Not provided"

  const existingNames = new Set(
    (contacts || []).map((c) => String(c.name || "").toLowerCase()).filter(Boolean)
  )
  const existingLines = (contacts || [])
    .slice(0, 20)
    .map((c) => `- ${c.name} (${c.role || "role unknown"} @ ${c.company || "company unknown"})`)
    .join("\n")

  const c = criteria || {}
  return `You help a college student find REAL people worth networking with for internships and early careers.

User name: ${userName || "Not provided"}
Career goals: ${careerGoals || "Not provided"}

Search criteria from the user:
- Specific person (if any): ${c.name || "not provided — general discovery"}
- Role/title target: ${c.role || "any"}
- Industry: ${c.industry || "any"}
- Company (or type of company): ${c.company || "any"}
- School/alumni angle: ${c.school || "any"}
- Location: ${c.location || "any"}
- Extra keywords: ${c.keywords || "none"}

Résumé (for field alignment — do not invent experience they lack):
${resumeBody}

People already in their network (do not suggest duplicates by name):
${existingLines || "None"}

Return ONLY valid JSON (no markdown fences):
{
  "suggestions": [
    {
      "name": "full name OR empty string if you are only suggesting a role archetype",
      "role": "job title or student role",
      "company": "organization",
      "why": "1-2 sentences on fit",
      "outreachAngle": "one sentence on how to start a warm conversation",
      "sourceHint": "where to verify them (e.g. company team page, alumni directory, conference)"
    }
  ]
}

Rules:
- Provide 6–8 suggestions, mix of: alumni in their field, hiring managers/recruiters at target companies, peers, and mentors.
- NEVER invent email addresses, phone numbers, or private LinkedIn URLs.
- Only include a real person's name if you are highly confident they are a public figure; otherwise leave name empty and be specific on role+company.
- Do not repeat names already in their network: ${[...existingNames].slice(0, 15).join(", ") || "none"}
- Prefer actionable targets a student could reach with a thoughtful cold/warm message.`
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
  if (!parsed || !Array.isArray(parsed.suggestions)) throw new Error("Invalid suggestions format")
  return parsed.suggestions
}

function enrichSuggestion(raw, index, criteria) {
  const name = typeof raw?.name === "string" ? raw.name.trim() : ""
  const role = typeof raw?.role === "string" ? raw.role.trim() : ""
  const company = typeof raw?.company === "string" ? raw.company.trim() : ""
  if (!role && !company && !name) return null
  const urls = peopleSearchUrls({
    name,
    role,
    company,
    school: criteria?.school,
    location: criteria?.location,
    keywords: criteria?.keywords,
  })
  return {
    id: `ai-${index + 1}`,
    source: "ai",
    name,
    role,
    company,
    why: typeof raw?.why === "string" ? raw.why.trim() : "",
    outreachAngle: typeof raw?.outreachAngle === "string" ? raw.outreachAngle.trim() : "",
    sourceHint: typeof raw?.sourceHint === "string" ? raw.sourceHint.trim() : "",
    linkedin: urls.linkedin,
    urls,
  }
}

function fallbackSuggestions({ criteria, careerGoals, contacts }) {
  const c = criteria || {}
  const role = String(c.role || careerGoals || "software intern").trim().slice(0, 80)
  const company = String(c.company || "").trim()
  const location = String(c.location || "").trim()
  const school = String(c.school || "Carnegie Mellon").trim()
  const seeds = [
    {
      name: "",
      role: `Recruiter or hiring manager — ${role}`,
      company: company || "target companies in your field",
      why: "Recruiters and hiring managers often respond better than cold-applying alone.",
      outreachAngle: "Reference a specific team or posting and ask one focused question.",
      sourceHint: "Company careers site or LinkedIn people search",
    },
    {
      name: "",
      role: "Alumni in your target role",
      company: school,
      why: `Students at ${school} often help with referrals when the ask is specific and respectful.`,
      outreachAngle: "Mention shared school and a 15-minute informational chat.",
      sourceHint: "LinkedIn alumni tool or campus directory",
    },
    {
      name: "",
      role: role,
      company: company || "companies you admire",
      why: "Peers one step ahead can share how they broke in.",
      outreachAngle: "Ask what they did in the last recruiting cycle that actually helped.",
      sourceHint: "LinkedIn people search",
    },
  ]
  return seeds.map((s, i) =>
    enrichSuggestion(s, i, { ...c, location, school })
  ).filter(Boolean)
}

function dedupeSuggestions(list) {
  const seen = new Set()
  const out = []
  for (const s of list) {
    const key = `${(s.name || "").toLowerCase()}|${(s.company || "").toLowerCase()}|${(s.role || "").toLowerCase()}|${s.github || ""}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function searchEngineLeads(criteria) {
  const name = String(criteria?.name || "").trim()
  if (!name) return []
  const urls = peopleSearchUrls(criteria)
  return [
    {
      title: `LinkedIn people search — ${name}`,
      url: urls.linkedin,
      snippet: "Official LinkedIn search results for this name and any filters you added.",
    },
    {
      title: `Google — ${name}`,
      url: urls.google,
      snippet: "Broad web search — use company or role in the form above to narrow results.",
    },
  ]
}

function mapWebResult(hit, index, criteria) {
  const queryName = String(criteria?.name || "").trim()
  let name = queryName
  if (!name && hit?.title) {
    const head = String(hit.title).split(/[|\-–—(]/)[0].trim()
    if (head && head.length < 48 && head.split(/\s+/).length <= 5) name = head
  }
  const urls = peopleSearchUrls({
    name,
    role: criteria?.role,
    company: criteria?.company,
    school: criteria?.school,
    location: criteria?.location,
    keywords: criteria?.keywords,
  })
  const pageUrl = hit?.url || ""
  return {
    id: `web-${index + 1}`,
    source: "web",
    name,
    role: criteria?.role || "",
    company: criteria?.company || "",
    why:
      hit?.snippet ||
      (hit?.title
        ? `Public page: ${String(hit.title).slice(0, 200)}`
        : "Public web result — verify this is the right person."),
    outreachAngle: "Open the link, confirm identity, then reference something specific from their public work.",
    sourceHint: pageUrl.replace(/^https?:\/\//, "").split("/")[0] || "Public web",
    website: pageUrl,
    profileUrl: pageUrl,
    linkedin: /linkedin\.com\/in\//i.test(pageUrl) ? pageUrl : urls.linkedin,
    urls,
  }
}

function mapGithubUser(u, index) {
  const urls = peopleSearchUrls({
    name: u.name,
    role: u.role,
    company: u.company,
    location: u.location,
  })
  return {
    id: `github-${index + 1}`,
    source: "github",
    name: u.name,
    role: u.role,
    company: u.company,
    why: u.why,
    outreachAngle: u.outreachAngle,
    sourceHint: "GitHub public profile",
    github: u.github,
    website: u.website,
    linkedin: urls.linkedin,
    urls,
  }
}

module.exports = {
  buildPrompt,
  buildProfileDiscoverPrompt,
  parseSuggestionsJson,
  enrichSuggestion,
  fallbackSuggestions,
  dedupeSuggestions,
  mapGithubUser,
  mapWebResult,
  searchEngineLeads,
}