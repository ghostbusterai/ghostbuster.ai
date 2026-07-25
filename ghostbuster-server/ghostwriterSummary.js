function buildGhostItSummaryPrompt(ghostIt) {
  const lines = (ghostIt.segments || [])
    .map((s) => `${s.speaker || "Speaker"}: ${s.text}`)
    .join("\n")

  return `You are a meeting notes assistant for students networking (coffee chats, career conversations, interviews).

Meeting title: ${ghostIt.title || "Untitled meeting"}
Contact (if any): ${ghostIt.contactName || "Not specified"}

Transcript (speaker-labeled):
${lines || "(empty transcript)"}

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "overview": "2-4 sentence summary of the conversation",
  "keyPoints": ["bullet", "bullet"],
  "actionItems": ["things the student should do"],
  "followUps": ["suggested follow-up messages or next touches"]
}

Rules:
- Be concrete and faithful to the transcript. Do not invent employers, offers, or commitments that were not said.
- Only summarize what was actually discussed. Do not mention topics that were absent (e.g. do not say "no career discussion" or "networking was not mentioned").
- Prefer short bullets (under 20 words each).
- If the transcript is thin, summarize only what was said and keep lists short. Omit empty categories rather than noting gaps.
- Do not use em dashes.`
}

function parseGhostItSummaryJson(text) {
  const trimmed = String(text || "").trim()
  if (!trimmed) return null
  let raw = trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1))
    return {
      overview: typeof parsed.overview === "string" ? parsed.overview.trim() : "",
      keyPoints: Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints.map((x) => String(x).trim()).filter(Boolean)
        : [],
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.map((x) => String(x).trim()).filter(Boolean)
        : [],
      followUps: Array.isArray(parsed.followUps)
        ? parsed.followUps.map((x) => String(x).trim()).filter(Boolean)
        : [],
    }
  } catch {
    return null
  }
}

module.exports = { buildGhostItSummaryPrompt, parseGhostItSummaryJson }
