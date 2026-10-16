/**
 * Live job search against public ATS job-board APIs (no API keys needed).
 * Greenhouse, Lever, and Ashby are looked up by company slug; Workday needs the company's
 * myworkdayjobs.com careers URL because tenants can't be guessed from a name.
 */

const TIMEOUT_MS = 8000
const MAX_RESULTS = 60

const COMPANY_SUFFIXES = new Set(["inc", "llc", "corp", "corporation", "co", "company", "ltd", "the", "technologies", "labs"])

function slugCandidates(company) {
  const base = String(company || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
  const words = base.split(/[\s-]+/).filter(Boolean)
  if (!words.length) return []
  const core = words.filter((w) => !COMPANY_SUFFIXES.has(w))
  const list = [core.join(""), core.join("-"), words.join(""), core[0]]
  return [...new Set(list.filter(Boolean))]
}

async function fetchJson(url, options = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) },
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

function matchesKeywords(title, keywords) {
  if (!keywords.length) return true
  const t = String(title || "").toLowerCase()
  return keywords.every((k) => t.includes(k))
}

async function searchGreenhouse(slug, company) {
  const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`)
  if (!data || !Array.isArray(data.jobs)) return null
  return data.jobs.map((j) => ({
    company,
    title: String(j.title || "").trim(),
    location: j.location?.name || "",
    url: j.absolute_url || "",
    ats: "greenhouse",
    postedAt: j.updated_at || "",
  }))
}

async function searchLever(slug, company) {
  const data = await fetchJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`)
  if (!Array.isArray(data)) return null
  return data.map((j) => ({
    company,
    title: String(j.text || "").trim(),
    location: j.categories?.location || "",
    url: j.applyUrl || j.hostedUrl || "",
    ats: "lever",
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : "",
  }))
}

async function searchAshby(slug, company) {
  const data = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`)
  if (!data || !Array.isArray(data.jobs)) return null
  return data.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      company,
      title: String(j.title || "").trim(),
      location: j.location || "",
      url: j.applyUrl || j.jobUrl || "",
      ats: "ashby",
      postedAt: j.publishedAt || "",
    }))
}

/** https://acme.wd5.myworkdayjobs.com/en-US/External → { origin, tenant, site } */
function parseWorkdayUrl(raw) {
  let u
  try {
    u = new URL(String(raw || "").trim())
  } catch {
    return null
  }
  if (!/\.(myworkdayjobs|myworkdaysite)\.com$/i.test(u.hostname)) return null
  const tenant = u.hostname.split(".")[0]
  const segments = u.pathname.split("/").filter(Boolean)
  const site = segments.find((s) => !/^[a-z]{2}-[A-Z]{2}$/.test(s))
  if (!tenant || !site) return null
  return { origin: u.origin, tenant, site }
}

async function searchWorkday(careersUrl, query, company) {
  const wd = parseWorkdayUrl(careersUrl)
  if (!wd) return null
  const data = await fetchJson(`${wd.origin}/wday/cxs/${wd.tenant}/${wd.site}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: query || "" }),
  })
  if (!data || !Array.isArray(data.jobPostings)) return null
  return data.jobPostings.map((j) => ({
    company: company || wd.tenant,
    title: String(j.title || "").trim(),
    location: j.locationsText || "",
    url: j.externalPath ? `${wd.origin}/${wd.site}${j.externalPath}` : "",
    ats: "workday",
    postedAt: j.postedOn || "",
  }))
}

/**
 * @param {{ company?: string, query?: string, workdayUrl?: string }} params
 * @returns {Promise<{ jobs: object[], boards: string[], warning?: string }>}
 */
async function searchJobs({ company = "", query = "", workdayUrl = "" } = {}) {
  const keywords = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const boards = []
  let jobs = []

  if (workdayUrl) {
    const found = await searchWorkday(workdayUrl, query, company)
    if (found) {
      boards.push("workday")
      // Workday already filtered server-side by searchText.
      jobs = jobs.concat(found)
    }
  }

  const name = String(company || "").trim()
  if (name) {
    for (const slug of slugCandidates(name)) {
      const results = await Promise.all([
        searchGreenhouse(slug, name),
        searchLever(slug, name),
        searchAshby(slug, name),
      ])
      const labels = ["greenhouse", "lever", "ashby"]
      results.forEach((list, i) => {
        if (!list) return
        boards.push(labels[i])
        jobs = jobs.concat(list.filter((j) => matchesKeywords(j.title, keywords)))
      })
      if (boards.length) break
    }
  }

  const seen = new Set()
  jobs = jobs.filter((j) => {
    if (!j.url || seen.has(j.url)) return false
    seen.add(j.url)
    return true
  })

  const out = { jobs: jobs.slice(0, MAX_RESULTS), boards: [...new Set(boards)] }
  if (!out.boards.length) {
    out.warning = workdayUrl
      ? "Couldn't read that Workday careers page. Paste the URL of the company's myworkdayjobs.com job list."
      : "No public Greenhouse, Lever, or Ashby board found for that company. For Workday companies, paste their careers URL."
  }
  return out
}

module.exports = { searchJobs, slugCandidates, parseWorkdayUrl }
