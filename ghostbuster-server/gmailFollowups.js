const { google } = require("googleapis")
const { getAuthedClient } = require("./googleCalendar")

/**
 * Finds recruiter email threads that need a follow-up, using rules instead of AI so scans cost nothing:
 *  - you wrote last and they haven't answered in FOLLOW_UP_DAYS → "Follow up"
 *  - they wrote last and you haven't answered in REPLY_DAYS → "Reply"
 * A thread counts as recruiting when the other person is one of your contacts, or the subject/preview
 * mentions recruiting. Automated mail (no-reply senders, mailing lists) is skipped.
 *
 * Only headers and Gmail's short preview snippet are read; message bodies are never fetched or stored.
 */

const LOOKBACK_DAYS = 30
const FOLLOW_UP_DAYS = 5
const REPLY_DAYS = 2
const MAX_THREADS = 150
const DAY = 24 * 60 * 60 * 1000

const RECRUITING = /\b(recruit\w*|talent|hiring|interview\w*|candidate|position|opening|job|role|application|internship|intern|offer|phone screen|coffee chat|referral|opportunit\w*)\b/i
const AUTOMATED = /(no-?reply|do-?not-?reply|notifications?|mailer-daemon|postmaster|alerts?@|updates?@|news(letter)?@|marketing@|info@|support@|hello@|jobs-noreply|talent-noreply)/i

function parseAddress(header) {
  const raw = String(header || "").trim()
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/)
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() }
  return { name: "", email: raw.toLowerCase() }
}

function firstAddress(header) {
  return parseAddress(String(header || "").split(",")[0])
}

function headerMap(message) {
  const out = {}
  for (const h of message.payload?.headers || []) out[h.name.toLowerCase()] = h.value
  return out
}

function displayName(addr) {
  if (addr.name) return addr.name
  const local = addr.email.split("@")[0] || addr.email
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/** @returns {Promise<Array<{threadId, key, kind, name, email, subject, lastAt}>>} */
async function findFollowUps(refreshToken, { contacts = [], now = Date.now() } = {}) {
  const gmail = google.gmail({ version: "v1", auth: getAuthedClient(refreshToken) })
  const { data: me } = await gmail.users.getProfile({ userId: "me" })
  const myEmail = String(me.emailAddress || "").toLowerCase()

  const contactByEmail = new Map()
  for (const c of contacts) {
    const e = String(c.email || "").trim().toLowerCase()
    if (e) contactByEmail.set(e, c)
  }

  const threads = []
  let pageToken
  do {
    const { data } = await gmail.users.threads.list({
      userId: "me",
      q: `newer_than:${LOOKBACK_DAYS}d -in:chats -category:promotions -category:social -category:forums -category:updates`,
      maxResults: 100,
      pageToken,
    })
    threads.push(...(data.threads || []))
    pageToken = data.nextPageToken
  } while (pageToken && threads.length < MAX_THREADS)

  const results = []
  for (const t of threads.slice(0, MAX_THREADS)) {
    const { data: thread } = await gmail.users.threads.get({
      userId: "me",
      id: t.id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "List-Unsubscribe", "Precedence"],
    })
    const messages = (thread.messages || []).filter((m) => !(m.labelIds || []).includes("DRAFT"))
    if (!messages.length) continue

    const last = messages[messages.length - 1]
    const lastHeaders = headerMap(last)
    const lastFrom = firstAddress(lastHeaders.from)
    const iWroteLast = lastFrom.email === myEmail

    // The other person: whoever I wrote to, or whoever wrote to me.
    const other = iWroteLast ? firstAddress(lastHeaders.to) : lastFrom
    if (!other.email || other.email === myEmail) continue
    if (AUTOMATED.test(other.email)) continue
    // Bulk mail carries list headers; real recruiters writing 1:1 don't.
    if (messages.some((m) => {
      const h = headerMap(m)
      return firstAddress(h.from).email !== myEmail && (h["list-unsubscribe"] || /bulk|list/i.test(h.precedence || ""))
    })) continue

    const subject = headerMap(messages[0]).subject || "(no subject)"
    const contact = contactByEmail.get(other.email)
    const text = `${subject} ${messages.map((m) => m.snippet || "").join(" ")}`
    if (!contact && !RECRUITING.test(text)) continue
    // Cold outreach I haven't answered only counts when the subject itself is about recruiting.
    const iParticipated = messages.some((m) => firstAddress(headerMap(m).from).email === myEmail)
    if (!iParticipated && !contact && !RECRUITING.test(subject)) continue

    const lastAt = Number(last.internalDate) || 0
    const age = now - lastAt
    let kind = null
    if (iWroteLast && age >= FOLLOW_UP_DAYS * DAY) kind = "follow_up"
    if (!iWroteLast && age >= REPLY_DAYS * DAY) kind = "reply"
    if (!kind) continue

    results.push({
      threadId: thread.id,
      key: `${thread.id}:${last.id}`,
      kind,
      name: contact?.name || displayName(other),
      email: other.email,
      subject: subject.slice(0, 140),
      lastAt: new Date(lastAt).toISOString(),
    })
  }
  return results
}

function isPermissionError(e) {
  const status = e?.code || e?.response?.status
  const reason = e?.errors?.[0]?.reason || e?.response?.data?.error?.errors?.[0]?.reason || ""
  return status === 403 && /insufficient|forbidden|scope/i.test(`${reason} ${e?.message || ""}`)
}

module.exports = { findFollowUps, isPermissionError, parseAddress, FOLLOW_UP_DAYS, REPLY_DAYS }
