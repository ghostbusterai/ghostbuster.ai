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

module.exports = { parseComposedEmail, encodeRawEmail, createDraft, sendNow }
