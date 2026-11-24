/** Shared display formatters for lists and dashboards */

export function formatContactName(name) {
  const raw = String(name || "").trim()
  if (!raw) return "Unnamed contact"
  return raw
    .split(/\s+/)
    .map((part) => {
      if (!part) return ""
      if (part.length === 1) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(" ")
}

export function formatLastTouch(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return null
  }
}

export function formatActivityTime(ts) {
  if (!ts || Number.isNaN(ts)) return "—"
  const d = new Date(ts)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const ms = d.getTime()
  if (ms >= startOfToday.getTime()) {
    const hours = Math.floor((now - d) / (1000 * 60 * 60))
    if (hours < 1) return "Now"
    if (hours < 24) return `${hours}h`
    return "Today"
  }
  if (ms >= startOfYesterday.getTime()) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "short" })
}