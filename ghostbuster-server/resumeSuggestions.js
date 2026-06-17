const VALID_TYPES = new Set(["reword", "replace", "add_metrics", "add", "remove", "highlight"])

function buildPrompt(careerGoals, resumeText, userName) {
  const maxChars = 14000
  const truncated = resumeText.length > maxChars
  const resumeBody = truncated ? resumeText.slice(0, maxChars) : resumeText

  return `You are an expert career coach and résumé editor. Analyze this résumé against the user's stated career goals and return specific, actionable improvement suggestions.

User name: ${userName || "Not provided"}

Career goals:
${careerGoals}

Résumé text:
${resumeBody}
${truncated ? "\n[Note: résumé was truncated for length — focus on the content above.]\n" : ""}

Return ONLY valid JSON (no markdown fences, no commentary) in this exact shape:
{
  "suggestions": [
    {
      "type": "reword" | "replace" | "add_metrics" | "add" | "remove" | "highlight",
      "section": "short label for where on the résumé (e.g. Experience — Acme Corp)",
      "original": "exact or paraphrased current text, or empty string if N/A",
      "suggested": "your proposed rewrite, replacement bullet, or new content",
      "rationale": "1–2 sentences tying this change to their career goals"
    }
  ]
}

Rules:
- Provide 5–8 suggestions, ordered by impact for their goals.
- Types:
  - reword: same experience, stronger phrasing
  - replace: swap a weak bullet/activity for a better-aligned one (suggest realistic alternatives they could honestly claim or develop toward)
  - add_metrics: add or estimate quantifiable outcomes (% , $, users, time saved) where plausible
  - add: missing section, skill, or bullet that would help their goals
  - remove: cut irrelevant content that dilutes their narrative
  - highlight: elevate something already there that aligns well but is buried
- Be concrete — quote or closely reference their actual résumé content in "original" when possible.
- Do not invent employers, degrees, or jobs they do not have. You may suggest metrics or rewording of real experiences.
- "suggested" must be copy-paste-ready text they could put on a résumé.
- Keep each "suggested" under 45 words unless replacing a full bullet list.`
}

function normalizeSuggestion(raw, index) {
  const type = VALID_TYPES.has(raw?.type) ? raw.type : "reword"
  return {
    id: index + 1,
    type,
    section: typeof raw?.section === "string" ? raw.section.trim() : "General",
    original: typeof raw?.original === "string" ? raw.original.trim() : "",
    suggested: typeof raw?.suggested === "string" ? raw.suggested.trim() : "",
    rationale: typeof raw?.rationale === "string" ? raw.rationale.trim() : "",
  }
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
  raw = raw.slice(start, end + 1)

  const parsed = JSON.parse(raw)
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error("Invalid suggestions format")
  }

  return parsed.suggestions
    .map(normalizeSuggestion)
    .filter((s) => s.suggested || s.rationale)
}

module.exports = { buildPrompt, parseSuggestionsJson, VALID_TYPES }
