const { google } = require("googleapis")

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
]

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  )
}

function getOAuthClient() {
  if (!isConfigured()) return null
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

function getAuthUrl(returnTo) {
  const client = getOAuthClient()
  if (!client) throw new Error("Google Calendar is not configured on the server")
  const state =
    returnTo === "compose" ? "compose" : returnTo === "settings" ? "settings" : "reminders"
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  })
}

async function exchangeCode(code) {
  const client = getOAuthClient()
  if (!client) throw new Error("Google Calendar is not configured on the server")
  const { tokens } = await client.getToken(code)
  return tokens
}

function getAuthedClient(refreshToken) {
  const client = getOAuthClient()
  if (!client) throw new Error("Google Calendar is not configured on the server")
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

function addOneDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function eventResource(reminder) {
  const reason = reminder.reason || reminder.customReason || ""
  const donePrefix = reminder.done ? "[Done] " : ""
  return {
    summary: `${donePrefix}Follow up with ${reminder.contactName}`,
    description: reason
      ? `${reason}\n\n— GhostBuster reminder`
      : "GhostBuster networking reminder",
    start: { date: reminder.dueDate },
    end: { date: addOneDay(reminder.dueDate) },
  }
}

async function createReminderEvent(refreshToken, reminder) {
  if (!reminder.dueDate) return null
  const auth = getAuthedClient(refreshToken)
  const calendar = google.calendar({ version: "v3", auth })
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: eventResource(reminder),
  })
  return res.data.id || null
}

async function updateReminderEvent(refreshToken, eventId, reminder) {
  if (!eventId || !reminder.dueDate) return
  const auth = getAuthedClient(refreshToken)
  const calendar = google.calendar({ version: "v3", auth })
  await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: eventResource(reminder),
  })
}

async function deleteReminderEvent(refreshToken, eventId) {
  if (!eventId) return
  const auth = getAuthedClient(refreshToken)
  const calendar = google.calendar({ version: "v3", auth })
  try {
    await calendar.events.delete({ calendarId: "primary", eventId })
  } catch (err) {
    if (err?.code === 404 || err?.status === 404) return
    throw err
  }
}

module.exports = {
  SCOPES,
  isConfigured,
  getAuthUrl,
  exchangeCode,
  getAuthedClient,
  createReminderEvent,
  updateReminderEvent,
  deleteReminderEvent,
}
