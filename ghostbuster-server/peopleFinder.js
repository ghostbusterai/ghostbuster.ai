/**
 * People Finder: suggests people a student could reach out to, found on the public web with Claude's
 * server-side web search. LinkedIn is blocked as a source (its terms forbid scraping); every
 * suggestion must link to a page the search actually returned, and nothing is saved automatically.
 */

const MAX_FIELD = 200
const MAX_CONTINUATIONS = 3
const MAX_PEOPLE = 8

const clean = (v) => (typeof v === "string" ? v.trim().slice(0, MAX_FIELD) : "")

function normalizeCriteria(body) {
  const c = {
    company: clean(body?.company),
    role: clean(body?.role),
    school: clean(body?.school),
    keywords: clean(body?.keywords),
    location: clean(body?.location),
  }
  if (!c.company && !c.role && !c.keywords) return null
  return c
}

function buildSystemPrompt({ today, userName, careerGoals }) {
  return `You help a student find real people worth reaching out to for career advice, referrals, or informational chats. You search the public web.

Today is ${today}.${userName ? ` The student's name is ${userName}.` : ""}${careerGoals ? ` Their career goals: ${careerGoals}` : ""}

How to search:
- Look for people who publicly show their work: engineers or PMs who write blog posts, give talks, maintain open-source projects, or appear on company team or engineering-blog pages; recruiters and university relations staff; alumni featured on school pages.
- Prefer recent, professional sources. LinkedIn is not available as a source; don't try to work around that.

Rules:
- Only include a person if they appear in a search result you received, and give the exact URL of that result as sourceUrl.
- Never guess or invent email addresses, phone numbers, or personal details. Don't include personal social media or home information.
- Skip anyone whose current role or company is unclear rather than guessing.
- At most ${MAX_PEOPLE} people, best fit first.
- "why" is one sentence on why this person fits the student's criteria, based on the source.
- "suggestedOpener" is one short, specific first line the student could use, referencing the source (for example their talk or post). No em dashes anywhere.

When you're done searching, reply with only this JSON (no markdown fence, no other text):
{"people":[{"name":"","role":"","company":"","sourceUrl":"","sourceTitle":"","why":"","suggestedOpener":""}],"note":"one sentence about the search, e.g. if few matches were found"}`
}

function buildUserMessage(c) {
  const parts = []
  if (c.company) parts.push(`Company: ${c.company}`)
  if (c.role) parts.push(`Role or team: ${c.role}`)
  if (c.school) parts.push(`Shared school / alumni connection: ${c.school}`)
  if (c.location) parts.push(`Location: ${c.location}`)
  if (c.keywords) parts.push(`Interests or keywords: ${c.keywords}`)
  return `Find people I could reach out to.\n${parts.join("\n")}`
}

/** URLs from every successful web_search_tool_result block (error results are objects, not lists). */
function collectSearchUrls(content) {
  const urls = new Set()
  let searches = 0
  for (const block of content || []) {
    if (block.type === "server_tool_use" && block.name === "web_search") searches++
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue
    for (const r of block.content) if (r?.type === "web_search_result" && r.url) urls.add(normalizeUrl(r.url))
  }
  return { urls, searches }
}

function normalizeUrl(u) {
  try {
    const url = new URL(String(u).trim())
    url.hash = ""
    return url.toString().replace(/\/$/, "")
  } catch {
    return ""
  }
}

function isLinkedIn(u) {
  try {
    return /(^|\.)linkedin\.com$/i.test(new URL(u).hostname)
  } catch {
    return false
  }
}

/** Text written after the last search: the final answer (earlier text is "Let me search..." narration). */
function finalText(content) {
  const blocks = content || []
  let last = -1
  blocks.forEach((b, i) => {
    if (b.type !== "text") last = i
  })
  return blocks
    .slice(last + 1)
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
}

function parseJson(text) {
  const trimmed = String(text || "").trim()
  if (!trimmed) return null
  let raw = trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

const str = (v, n = 300) => (typeof v === "string" ? v.trim().replace(/\s*—\s*/g, ", ").slice(0, n) : "")
const key = (name, company) => `${String(name || "").trim().toLowerCase()}|${String(company || "").trim().toLowerCase()}`

/**
 * Keep only people whose source URL came back from the search, aren't from LinkedIn, and aren't
 * already in the user's contacts. Returns { people, dropped }.
 */
function filterPeople(parsedPeople, searchUrls, existingContacts) {
  const existing = new Set((existingContacts || []).map((c) => key(c.name, c.company)))
  const existingNames = new Set((existingContacts || []).map((c) => String(c.name || "").trim().toLowerCase()))
  const seen = new Set()
  const people = []
  const dropped = { unsourced: 0, linkedin: 0, existing: 0 }
  for (const p of Array.isArray(parsedPeople) ? parsedPeople : []) {
    const name = str(p?.name, 120)
    const company = str(p?.company, 120)
    const sourceUrl = normalizeUrl(p?.sourceUrl)
    if (!name || !sourceUrl) {
      dropped.unsourced++
      continue
    }
    if (isLinkedIn(sourceUrl)) {
      dropped.linkedin++
      continue
    }
    if (!searchUrls.has(sourceUrl)) {
      dropped.unsourced++
      continue
    }
    const k = key(name, company)
    if (existing.has(k) || (!company && existingNames.has(name.toLowerCase()))) {
      dropped.existing++
      continue
    }
    if (seen.has(k)) continue
    seen.add(k)
    people.push({
      name,
      role: str(p?.role, 120),
      company,
      sourceUrl,
      sourceTitle: str(p?.sourceTitle, 200),
      why: str(p?.why),
      suggestedOpener: str(p?.suggestedOpener),
    })
    if (people.length >= MAX_PEOPLE) break
  }
  return { people, dropped }
}

async function findPeople({ anthropic, model, store, uid, body }) {
  const criteria = normalizeCriteria(body)
  if (!criteria) {
    const err = new Error("Enter a company, role, or keywords to search for.")
    err.status = 400
    throw err
  }
  const [profileR, contactsR] = await Promise.all([store.getProfile(uid), store.getContacts(uid)])
  const profile = profileR?.profile || {}
  if (!criteria.school && typeof profile.school === "string") criteria.school = clean(profile.school)

  const system = buildSystemPrompt({
    today: new Date().toISOString().slice(0, 10),
    userName: clean(profile.name),
    careerGoals: clean(profile.careerGoals),
  })
  // Basic web search (no dynamic filtering): the filtering variant ran code execution over every page
  // and took minutes per request; plain search results are enough to find and cite people.
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4, blocked_domains: ["linkedin.com"] }]
  const messages = [{ role: "user", content: buildUserMessage(criteria) }]

  // The server runs the search loop; a long one stops with pause_turn and is resumed by resending the
  // conversation as-is (no extra "continue" message).
  let message
  const allContent = []
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    // A stalled search should fail fast for the user, not wait out the SDK's 10-minute default and retry.
    message = await anthropic.messages.create(
      { model, max_tokens: 3000, system, tools, messages },
      { timeout: 120_000, maxRetries: 0 }
    )
    allContent.push(...(message.content || []))
    if (message.stop_reason !== "pause_turn") break
    messages.push({ role: "assistant", content: message.content })
  }
  if (message.stop_reason === "refusal") {
    const err = new Error("The search couldn't be completed for these criteria. Try different wording.")
    err.status = 422
    throw err
  }

  const { urls, searches } = collectSearchUrls(allContent)
  const parsed = parseJson(finalText(message.content)) || parseJson(finalText(allContent))
  if (!parsed) {
    const err = new Error("Couldn't read the search results. Try again.")
    err.status = 502
    throw err
  }
  const { people, dropped } = filterPeople(parsed.people, urls, contactsR?.contacts)
  return { people, searched: searches, note: str(parsed.note, 300), dropped }
}

module.exports = { findPeople, filterPeople, collectSearchUrls, parseJson, finalText, normalizeCriteria }
