const { google } = require("googleapis")
const { getAuthedClient } = require("./googleCalendar")

function parseComposedEmail(text) {
  const raw = typeof text === "string" ? text.trim() : ""
  if (!raw) return { subject: "", body: "" }

  const match = raw.match(/^Subject:\s*(.+?)(?:\r?\n\r?\n|\n\n|\r?\n)/i)
  if (match) {
    const subject = match[1].trim()
    const body = raw.slice(match.index + match[0].length).trim()
    return { subject, body }
  }

  const lines = raw.split(/\r?\n/)
  if (/^Subject:/i.test(lines[0])) {
    return {
      subject: lines[0].replace(/^Subject:\s*/i, "").trim(),
      body: lines.slice(1).join("\n").trim(),
    }
  }

  return { subject: "Networking outreach", body: raw }
}

function encodeRawEmail({ to, subject, body }) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ]
  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

async function createDraft(refreshToken, { to, subject, body }) {
  const auth = getAuthedClient(refreshToken)
  const gmail = google.gmail({ version: "v1", auth })
  const raw = encodeRawEmail({ to, subject, body })
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  })
  return { draftId: res.data.id || "", messageId: res.data.message?.id || "" }
}

async function sendNow(refreshToken, { to, subject, body }) {
  const auth = getAuthedClient(refreshToken)
  const gmail = google.gmail({ version: "v1", auth })
  const raw = encodeRawEmail({ to, subject, body })
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  })
  return { messageId: res.data.id || "" }
}

function headerValue(headers, name) {
  const h = (headers || []).find((x) => String(x.name).toLowerCase() === name.toLowerCase())
  return h?.value || ""
}

/**
 * Recent recruiting-related inbox messages (metadata only — no bodies stored server-side).
 */
async function listRecruitingMessages(refreshToken, { maxResults = 50, newerThanDays = 45 } = {}) {
  const auth = getAuthedClient(refreshToken)
  const gmail = google.gmail({ version: "v1", auth })
  const q = [
    `newer_than:${newerThanDays}d`,
    "(",
    "from:greenhouse.io OR from:workday.com OR from:myworkday.com OR from:lever.co OR from:ashbyhq.com",
    " OR from:linkedin.com OR from:indeed.com OR from:handshake.com",
    ' OR subject:(application OR interview OR assessment OR "thank you for applying" OR offer OR rejection)',
    ")",
  ].join(" ")

  const list = await gmail.users.messages.list({ userId: "me", q, maxResults })
  const ids = (list.data.messages || []).map((m) => m.id).filter(Boolean)
  const messages = []

  for (const id of ids) {
    const res = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    })
    const headers = res.data.payload?.headers || []
    messages.push({
      id,
      threadId: res.data.threadId || "",
      internalDate: res.data.internalDate || "",
      subject: headerValue(headers, "Subject"),
      from: headerValue(headers, "From"),
      date: headerValue(headers, "Date"),
      snippet: String(res.data.snippet || "").trim(),
    })
  }

  return messages
}

module.exports = { parseComposedEmail, encodeRawEmail, createDraft, sendNow, listRecruitingMessages }
