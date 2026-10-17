/** Clean extracted résumé text so Workday and other ATS parsers can read it. */

const SECTION_NAMES = new Set(
  [
    "summary",
    "professional summary",
    "profile",
    "objective",
    "experience",
    "work experience",
    "professional experience",
    "relevant experience",
    "employment",
    "education",
    "skills",
    "technical skills",
    "core skills",
    "relevant skills",
    "projects",
    "research",
    "publications",
    "leadership",
    "activities",
    "campus involvement",
    "extracurricular",
    "awards",
    "honors",
    "honors and awards",
    "certifications",
    "licenses",
    "volunteer",
    "volunteering",
    "community service",
    "coursework",
    "relevant coursework",
    "languages",
    "interests",
    "additional information",
  ].map((s) => s.toLowerCase())
)

function slugPart(value, max = 40) {
  return String(value || "")
    .trim()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max)
}

export function atsResumeFileName({ personName, bucketName, fileName } = {}) {
  const person = slugPart(personName)
  const role = slugPart(bucketName)
  const fromFile = slugPart(String(fileName || "").replace(/\.[^.]+$/, ""), 50)
  const core =
    person && role ? `${person}_${role}_resume` : person ? `${person}_resume` : role ? `${role}_resume` : fromFile || "resume"
  return `${core}_ATS.txt`
}

function isSectionHeader(line) {
  const t = String(line || "")
    .replace(/[:\s]+$/g, "")
    .trim()
  if (!t || t.length > 48) return false
  const key = t.toLowerCase()
  if (SECTION_NAMES.has(key)) return true
  if (/^[A-Z][A-Z0-9 &/'-]{2,}$/.test(t) && t.split(/\s+/).length <= 5 && !/\d{4}/.test(t)) return true
  return false
}

function isPageJunk(line) {
  return /^(page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+)$/i.test(line)
}

function normalizeLine(line) {
  let t = String(line || "").trim()
  t = t.replace(/^[\u2022\u25CF\u25E6\u2043\u2219\u00B7\u25AA\u25AB\u25A0*o]+\s+/, "- ")
  t = t.replace(/^[-–—]+\s+/, "- ")
  t = t.replace(/^(\d+)[.)]\s+/, "$1. ")
  if (isSectionHeader(t)) {
    t = t.replace(/:+$/, "").trim().toUpperCase()
  }
  return t
}

function shouldJoin(prev, next) {
  if (!prev || !next) return false
  if (isSectionHeader(prev) || isSectionHeader(next)) return false
  if (/^-\s/.test(next) || /^\d+\.\s/.test(next)) return false
  if (isPageJunk(next)) return false
  if (/^[A-Z][A-Z0-9 &/'-]{2,}$/.test(next) && next.length <= 48) return false
  if (/[./]$/.test(prev) && /^(edu|net|com|org|io|gov)\b/i.test(next)) return true
  if (prev.endsWith("-") && /^[a-zA-Z]/.test(next)) return true
  if (/^-\s/.test(prev) && /^[a-z]/.test(next)) return true
  return /[a-z0-9,;:)]$/.test(prev) && /^[a-z]/.test(next)
}

function joinWrappedLines(lines) {
  const out = []
  for (const line of lines) {
    if (!out.length) {
      out.push(line)
      continue
    }
    const prev = out[out.length - 1]
    if (shouldJoin(prev, line)) {
      out[out.length - 1] = prev.endsWith("-") ? prev.slice(0, -1) + line : `${prev} ${line}`
    } else {
      out.push(line)
    }
  }
  return out
}

/** ASCII, single-column, CRLF text that Workday-style parsers ingest more reliably than a designed PDF. */
export function formatAtsResumeText(raw) {
  let s = String(raw || "").replace(/^\uFEFF/, "")
  s = s.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  s = s.replace(/[\u00A0\u202F\u2007]/g, " ")
  s = s.replace(/[\u2018\u2019\u02BC]/g, "'")
  s = s.replace(/[\u201C\u201D]/g, '"')
  s = s.replace(/[\u2013\u2014\u2212]/g, "-")
  s = s.replace(/[^\S\n]+/g, " ")

  let lines = s
    .split("\n")
    .map(normalizeLine)
    .filter((line) => line && !isPageJunk(line))

  lines = joinWrappedLines(lines)

  const spaced = []
  for (const line of lines) {
    const prev = spaced[spaced.length - 1]
    if (isSectionHeader(line) && prev && prev !== "") spaced.push("")
    if (line === "" && prev === "") continue
    spaced.push(line)
  }

  while (spaced[0] === "") spaced.shift()
  while (spaced[spaced.length - 1] === "") spaced.pop()

  return `${spaced.join("\r\n")}\r\n`
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
