/**
 * Public discovery helpers — search links, GitHub API, and public web search (no LinkedIn scraping).
 */

const TIMEOUT_MS = 12000
const GITHUB_UA = "GhostBuster-Discover/1.0"

const SKIP_URL =
  /(?:google\.|bing\.|duckduckgo\.|yahoo\.com\/search|facebook\.com\/login|accounts\.google|doubleclick\.)/i
const PROFILE_URL_HINT =
  /linkedin\.com\/in\/|github\.com\/|x\.com\/|twitter\.com\/|medium\.com\/@|substack\.com|about|\/team|\/people|\.edu\//

function peopleSearchUrls({ name, role, company, school, location, keywords }) {
  const parts = [name, role, company, school, location, keywords].filter((s) => String(s || "").trim())
  const q = parts.join(" ").trim() || "professional networking"
  const linkedin = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}&origin=GLOBAL_SEARCH_HEADER`
  const google = `https://www.google.com/search?q=${encodeURIComponent(`${q} professional`)}`
  const handshake = `https://app.joinhandshake.com/stu/postings?query=${encodeURIComponent(q)}`
  return { linkedin, google, handshake }
}

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .trim()
}

function decodeDdgUrl(href) {
  if (!href) return ""
  try {
    const u = new URL(href, "https://duckduckgo.com")
    const inner = u.searchParams.get("uddg")
    if (inner) return decodeURIComponent(inner)
    return u.href
  } catch {
    return href
  }
}

function buildPersonWebQuery({ name, company, role, school }) {
  const n = String(name || "").trim()
  const parts = []
  if (n) parts.push(/\s/.test(n) ? `"${n}"` : n)
  if (company) parts.push(company)
  if (role) parts.push(role)
  if (school) parts.push(school)
  return parts.join(" ").trim() || "professional profile"
}

async function fetchText(url, { method = "GET", body, headers = {} } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      method,
      headers: { "User-Agent": GITHUB_UA, ...headers },
      body,
      signal: ctrl.signal,
    })
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function parseDuckDuckGoHtml(html, limit = 10) {
  if (!html) return []
  const results = []
  const linkRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
  const snippetRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/i

  let m
  const chunks = html.split(/class="[^"]*results__/) 
  for (const chunk of chunks) {
    const link = chunk.match(linkRe)
    if (!link) continue
    const url = decodeDdgUrl(decodeHtmlEntities(link[1]))
    if (!url || SKIP_URL.test(url)) continue
    const title = decodeHtmlEntities(link[2].replace(/<[^>]+>/g, ""))
    const sn = chunk.match(snippetRe)
    const snippet = sn ? decodeHtmlEntities(sn[1].replace(/<[^>]+>/g, "")) : ""
    if (!title) continue
    results.push({ title, url, snippet })
    if (results.length >= limit) break
  }

  if (results.length) return results

  const simpleRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  while ((m = simpleRe.exec(html)) && results.length < limit) {
    const url = decodeDdgUrl(decodeHtmlEntities(m[1]))
    if (!url || SKIP_URL.test(url)) continue
    const title = decodeHtmlEntities(String(m[2]).replace(/<[^>]+>/g, ""))
    if (!title) continue
    results.push({ title, url, snippet: "" })
  }
  return results
}

async function searchDuckDuckGoWeb(query, limit = 10) {
  const body = new URLSearchParams({ q: query, b: "" }).toString()
  const html = await fetchText("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    body,
  })
  return parseDuckDuckGoHtml(html, limit)
}

async function searchBraveWeb(query, limit = 10) {
  const key = String(process.env.BRAVE_SEARCH_API_KEY || "").trim()
  if (!key) return []
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(limit, 20)}`
  const data = await fetchJson(url, { "X-Subscription-Token": key, Accept: "application/json" })
  if (!data?.web?.results || !Array.isArray(data.web.results)) return []
  return data.web.results
    .map((r) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || "",
    }))
    .filter((r) => r.title && r.url && !SKIP_URL.test(r.url))
    .slice(0, limit)
}

async function searchWikipediaTitles(name, limit = 3) {
  const n = String(name || "").trim()
  if (!n) return []
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(n)}&limit=${limit}&namespace=0&format=json`
  const data = await fetchJson(url)
  if (!Array.isArray(data) || !Array.isArray(data[1])) return []
  return data[1].map((title, i) => ({
    title: `${title} (Wikipedia)`,
    url: (Array.isArray(data[3]) && data[3][i]) || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    snippet: "Public Wikipedia article — confirm this is the same person before citing.",
  }))
}

function rankWebHits(hits) {
  return [...hits].sort((a, b) => {
    const score = (h) => {
      let s = 0
      if (PROFILE_URL_HINT.test(h.url)) s += 4
      if (/linkedin\.com\/in\//i.test(h.url)) s += 2
      if (/github\.com\//i.test(h.url)) s += 2
      if (h.snippet) s += 1
      return s
    }
    return score(b) - score(a)
  })
}

/**
 * Search the public web for a specific person (name + optional company/role). Uses Brave API if configured,
 * otherwise DuckDuckGo HTML results + Wikipedia name lookup. Does not log in to or scrape LinkedIn.
 */
async function searchWebForPerson({ name, company = "", role = "", school = "", limit = 8 } = {}) {
  const n = String(name || "").trim()
  if (!n) return []
  const query = buildPersonWebQuery({ name: n, company, role, school })
  const cap = Math.min(Math.max(limit, 1), 12)

  let web = await searchBraveWeb(query, cap)
  if (!web.length) web = await searchDuckDuckGoWeb(query, cap)
  const wiki = await searchWikipediaTitles(n, 2)

  const merged = rankWebHits(dedupeWebHits([...web, ...wiki])).slice(0, cap)
  return merged
}

function dedupeWebHits(list) {
  const seen = new Set()
  const out = []
  for (const h of list) {
    const key = String(h.url || "")
      .replace(/\/$/, "")
      .toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(h)
  }
  return out
}

async function fetchJson(url, headers = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": GITHUB_UA, ...headers },
      signal: ctrl.signal,
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function searchGithubUsers({ query = "", location = "", limit = 8 } = {}) {
  const terms = []
  const q = String(query || "").trim()
  const loc = String(location || "").trim()
  if (q) terms.push(q)
  if (loc) terms.push(`location:${JSON.stringify(loc)}`)
  if (!terms.length) terms.push("student")
  const url = `https://api.github.com/search/users?q=${encodeURIComponent(terms.join(" "))}&per_page=${Math.min(Math.max(limit, 1), 30)}`
  const data = await fetchJson(url)
  if (!data || !Array.isArray(data.items)) return []

  const out = []
  for (const item of data.items.slice(0, limit)) {
    const login = item.login
    if (!login) continue
    const profile = await fetchJson(`https://api.github.com/users/${encodeURIComponent(login)}`)
    out.push({
      source: "github",
      name: profile?.name?.trim() || login,
      role: profile?.bio ? String(profile.bio).slice(0, 120) : "Developer on GitHub",
      company: profile?.company ? String(profile.company).replace(/^@/, "").trim() : "",
      github: profile?.html_url || `https://github.com/${login}`,
      website: profile?.blog || "",
      location: profile?.location || loc || "",
      why: "Public GitHub profile matched your search keywords.",
      outreachAngle: "Comment on a project, open a thoughtful issue, or email linked from their profile if public.",
    })
  }
  return out
}

module.exports = {
  peopleSearchUrls,
  searchGithubUsers,
  searchWebForPerson,
  buildPersonWebQuery,
}