const express = require("express")
const cors = require("cors")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
require("dotenv").config()
const Anthropic = require("@anthropic-ai/sdk")
const app = express()
const PORT = process.env.PORT || 3001

const store = require("./fileStore")
const { extractResumeText, MAX_BYTES } = require("./resumeExtract")
const { buildPrompt, parseSuggestionsJson } = require("./resumeSuggestions")
const { suggestContactsForUpdateSmart } = require("./contactRelevance")
const googleCal = require("./googleCalendar")
const gmail = require("./gmail")
const { SUGGESTED_BUCKET_NAMES } = require("./resumeBucketMatch")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
})

const apiKey = process.env.ANTHROPIC_API_KEY
const anthropic = apiKey ? new Anthropic.default({ apiKey }) : null
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6"

app.use(cors())
app.use(express.json())

function extractAssistantText(content) {
  if (!Array.isArray(content)) return ""
  const textBlock = content.find((b) => b.type === "text")
  return textBlock?.text ?? ""
}

function formatAnthropicError(err) {
  const body = err?.error
  if (typeof body?.message === "string") return body.message
  if (typeof body?.error?.message === "string") return body.error.message
  const raw = typeof err?.message === "string" ? err.message : ""
  const jsonStart = raw.indexOf("{")
  if (jsonStart !== -1) {
    try {
      const j = JSON.parse(raw.slice(jsonStart))
      const m = j?.error?.message
      if (m) return m
    } catch {
      /* keep raw */
    }
  }
  return raw || "Failed to generate message"
}

function parseId(param) {
  const id = Number(param)
  return Number.isFinite(id) ? id : null
}

function appOrigin(req) {
  if (process.env.APP_URL) return String(process.env.APP_URL).replace(/\/$/, "")
  const proto = req.get("x-forwarded-proto") || req.protocol || "https"
  const host = req.get("x-forwarded-host") || req.get("host")
  return `${proto}://${host}`
}

async function syncReminderCreate(reminder) {
  const refreshToken = await store.getGoogleRefreshToken(null)
  if (!refreshToken || !reminder.dueDate || reminder.googleEventId) return reminder
  const eventId = await googleCal.createReminderEvent(refreshToken, reminder)
  if (!eventId) return reminder
  const out = await store.setReminderGoogleEventId(null, reminder.id, eventId)
  return out?.reminder || { ...reminder, googleEventId: eventId }
}

async function syncReminderUpdate(prev, next) {
  const refreshToken = await store.getGoogleRefreshToken(null)
  if (!refreshToken || !next.dueDate) return next
  if (next.googleEventId) {
    await googleCal.updateReminderEvent(refreshToken, next.googleEventId, next)
    return next
  }
  return syncReminderCreate(next)
}

async function syncReminderDelete(reminder) {
  const refreshToken = await store.getGoogleRefreshToken(null)
  if (!refreshToken || !reminder?.googleEventId) return
  await googleCal.deleteReminderEvent(refreshToken, reminder.googleEventId)
}

async function processScheduledEmails() {
  const refreshToken = await store.getGoogleRefreshToken(null)
  if (!refreshToken) return
  const due = await store.getDueScheduledEmails(null)
  for (const item of due) {
    try {
      const { messageId } = await gmail.sendNow(refreshToken, {
        to: item.to,
        subject: item.subject || "Networking outreach",
        body: item.body || "",
      })
      await store.markScheduledEmailSent(null, item.id, messageId)
    } catch (e) {
      console.warn("Scheduled email send failed:", item.id, e.message)
      await store.markScheduledEmailFailed(null, item.id, e.message)
    }
  }
}

// —— Contacts ——
app.get("/api/contacts", async (req, res) => {
  try {
    const { contacts } = await store.getContacts(null)
    res.json({ contacts })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load contacts" })
  }
})

app.post("/api/contacts", async (req, res) => {
  const { name, email, phone, company, role, notes, lastContacted, linkedin, website } = req.body || {}
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" })
  }
  try {
    const { contact } = await store.createContact(null, {
      name,
      email,
      phone,
      company,
      role,
      notes,
      lastContacted,
      linkedin,
      website,
    })
    res.status(201).json({ contact })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to save contact" })
  }
})

app.put("/api/contacts/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const out = await store.updateContact(null, id, req.body || {})
    if (out == null) {
      return res.status(404).json({ error: "Contact not found" })
    }
    if (!out.contact?.name) {
      return res.status(400).json({ error: "Name is required" })
    }
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to update contact" })
  }
})

app.delete("/api/contacts/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const ok = await store.deleteContact(null, id)
    if (!ok) return res.status(404).json({ error: "Contact not found" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete contact" })
  }
})

// —— Reminders ——
app.get("/api/reminders", async (req, res) => {
  try {
    const { reminders } = await store.getReminders(null)
    res.json({ reminders })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load reminders" })
  }
})

app.post("/api/reminders", async (req, res) => {
  const { contactName, reason, dueDate, done, customReason, syncToCalendar } = req.body || {}
  if (!contactName || typeof contactName !== "string" || !contactName.trim()) {
    return res.status(400).json({ error: "Contact name is required" })
  }
  try {
    let { reminder } = await store.createReminder(null, {
      contactName,
      reason,
      dueDate,
      done,
      customReason,
    })
    const shouldSync = syncToCalendar !== false
    if (shouldSync && reminder.dueDate) {
      try {
        reminder = await syncReminderCreate(reminder)
      } catch (e) {
        console.warn("Google Calendar sync failed on create:", e.message)
      }
    }
    res.status(201).json({ reminder })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to save reminder" })
  }
})

app.patch("/api/reminders/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const { reminders } = await store.getReminders(null)
    const prev = reminders.find((r) => r.id === id)
    const out = await store.patchReminder(null, id, req.body || {})
    if (out == null) return res.status(404).json({ error: "Reminder not found" })
    let reminder = out.reminder
    try {
      reminder = await syncReminderUpdate(prev, reminder)
    } catch (e) {
      console.warn("Google Calendar sync failed on update:", e.message)
    }
    res.json({ reminder })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to update reminder" })
  }
})

app.delete("/api/reminders/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const { reminders } = await store.getReminders(null)
    const prev = reminders.find((r) => r.id === id)
    try {
      if (prev) await syncReminderDelete(prev)
    } catch (e) {
      console.warn("Google Calendar sync failed on delete:", e.message)
    }
    const ok = await store.deleteReminder(null, id)
    if (!ok) return res.status(404).json({ error: "Reminder not found" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete reminder" })
  }
})

app.post("/api/reminders/:id/sync-calendar", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  if (!googleCal.isConfigured()) {
    return res.status(503).json({ error: "Google Calendar is not configured on the server" })
  }
  const refreshToken = await store.getGoogleRefreshToken(null)
  if (!refreshToken) {
    return res.status(400).json({ error: "Connect Google Calendar first" })
  }
  try {
    const { reminders } = await store.getReminders(null)
    const reminder = reminders.find((r) => r.id === id)
    if (!reminder) return res.status(404).json({ error: "Reminder not found" })
    if (!reminder.dueDate) {
      return res.status(400).json({ error: "Set a due date before adding to Google Calendar" })
    }
    let updated = reminder
    if (reminder.googleEventId) {
      await googleCal.updateReminderEvent(refreshToken, reminder.googleEventId, reminder)
    } else {
      updated = await syncReminderCreate(reminder)
    }
    res.json({ reminder: updated })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || "Failed to sync reminder to Google Calendar" })
  }
})

// —— Google Calendar ——
app.get("/api/google/status", async (req, res) => {
  try {
    const status = await store.getGoogleCalendarStatus(null)
    res.json({
      ...status,
      configured: googleCal.isConfigured(),
      redirectUri: process.env.GOOGLE_REDIRECT_URI || null,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load Google Calendar status" })
  }
})

app.get("/api/google/auth", (req, res) => {
  if (!googleCal.isConfigured()) {
    return res.status(503).json({ error: "Google is not configured on the server" })
  }
  try {
    const returnTo = req.query.returnTo === "compose" ? "compose" : "reminders"
    res.redirect(googleCal.getAuthUrl(returnTo))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to start Google sign-in" })
  }
})

app.get("/api/google/callback", async (req, res) => {
  const origin = appOrigin(req)
  const returnPage = req.query.state === "compose" ? "compose" : "reminders"
  const fail = (msg) =>
    res.redirect(`${origin}/?google=error&page=${returnPage}&message=${encodeURIComponent(msg)}`)

  if (!googleCal.isConfigured()) return fail("Google is not configured")
  const code = typeof req.query.code === "string" ? req.query.code : ""
  if (!code) return fail("Google sign-in was cancelled or failed")

  try {
    const tokens = await googleCal.exchangeCode(code)
    await store.saveGoogleCalendarTokens(null, tokens)
    res.redirect(`${origin}/?google=connected&page=${returnPage}`)
  } catch (e) {
    console.error(e)
    fail(e.message || "Failed to connect Google account")
  }
})

app.delete("/api/google/disconnect", async (req, res) => {
  try {
    const ok = await store.clearGoogleCalendar(null)
    if (!ok) return res.status(404).json({ error: "Google account was not connected" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to disconnect Google account" })
  }
})

// —— Gmail ——
app.post("/api/gmail/draft", async (req, res) => {
  if (!googleCal.isConfigured()) {
    return res.status(503).json({ error: "Google is not configured on the server" })
  }
  const refreshToken = await store.getGoogleRefreshToken(null)
  if (!refreshToken) {
    return res.status(400).json({ error: "Connect Google first (Calendar or Gmail uses the same sign-in)" })
  }

  const { to, messageText, subject, body } = req.body || {}
  const recipient = typeof to === "string" ? to.trim() : ""
  if (!recipient) return res.status(400).json({ error: "Recipient email is required" })

  const parsed =
    typeof messageText === "string" && messageText.trim()
      ? gmail.parseComposedEmail(messageText)
      : {
          subject: typeof subject === "string" ? subject.trim() : "",
          body: typeof body === "string" ? body.trim() : "",
        }
  if (!parsed.body) return res.status(400).json({ error: "Message body is required" })

  try {
    const out = await gmail.createDraft(refreshToken, {
      to: recipient,
      subject: parsed.subject || "Networking outreach",
      body: parsed.body,
    })
    res.status(201).json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || "Failed to save Gmail draft" })
  }
})

app.post("/api/gmail/schedule", async (req, res) => {
  if (!googleCal.isConfigured()) {
    return res.status(503).json({ error: "Google is not configured on the server" })
  }
  const refreshToken = await store.getGoogleRefreshToken(null)
  if (!refreshToken) {
    return res.status(400).json({ error: "Connect Google first (Calendar or Gmail uses the same sign-in)" })
  }

  const { to, messageText, sendAt, contactName, subject, body } = req.body || {}
  const recipient = typeof to === "string" ? to.trim() : ""
  if (!recipient) return res.status(400).json({ error: "Recipient email is required" })

  const parsed =
    typeof messageText === "string" && messageText.trim()
      ? gmail.parseComposedEmail(messageText)
      : {
          subject: typeof subject === "string" ? subject.trim() : "",
          body: typeof body === "string" ? body.trim() : "",
        }
  if (!parsed.body) return res.status(400).json({ error: "Message body is required" })
  if (!sendAt) return res.status(400).json({ error: "Schedule date and time are required" })

  try {
    const { scheduled } = await store.createScheduledEmail(null, {
      to: recipient,
      subject: parsed.subject || "Networking outreach",
      body: parsed.body,
      sendAt,
      contactName,
    })
    processScheduledEmails().catch((e) => console.warn("Schedule processor:", e.message))
    res.status(201).json({ scheduled })
  } catch (e) {
    if (e.message === "future") {
      return res.status(400).json({ error: "Scheduled time must be in the future" })
    }
    console.error(e)
    res.status(500).json({ error: e.message || "Failed to schedule email" })
  }
})

// —— Profile ——
app.get("/api/profile", async (req, res) => {
  try {
    const out = await store.getProfile(null)
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load profile" })
  }
})

app.patch("/api/profile", async (req, res) => {
  try {
    const out = await store.patchProfile(null, req.body || {})
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to update profile" })
  }
})

// —— Résumé updates ——
app.get("/api/resume-updates", async (req, res) => {
  try {
    const { updates } = await store.getResumeUpdates(null)
    res.json({ updates })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load updates" })
  }
})

app.post("/api/resume-updates", async (req, res) => {
  const { title, details, effectiveDate } = req.body || {}
  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" })
  }
  const bodyText = typeof details === "string" ? details : ""
  if (!bodyText.trim()) {
    return res.status(400).json({
      error: "Details are required — we match keywords from this text to your contacts.",
    })
  }
  try {
    const out = await store.createResumeUpdate(null, { title, details, effectiveDate })
    const [{ contacts }, { profile }, { buckets }] = await Promise.all([
      store.getContacts(null),
      store.getProfile(null),
      store.getResumeBuckets(null),
    ])
    const relevance = await suggestContactsForUpdateSmart({
      anthropic,
      contacts: contacts || [],
      update: out.update,
      profile: profile || {},
      resumeBuckets: buckets || [],
    })
    res.status(201).json({ update: out.update, relevance })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to save update" })
  }
})

app.delete("/api/resume-updates/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const ok = await store.deleteResumeUpdate(null, id)
    if (!ok) return res.status(404).json({ error: "Update not found" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete update" })
  }
})

// —— Full résumé (legacy + first bucket) ——
app.get("/api/resume-buckets/suggestions", (_req, res) => {
  res.json({ names: SUGGESTED_BUCKET_NAMES })
})

app.get("/api/resume-buckets", async (req, res) => {
  try {
    const out = await store.getResumeBuckets(null)
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load résumé buckets" })
  }
})

app.post("/api/resume-buckets", async (req, res) => {
  const { name } = req.body || {}
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Bucket name is required" })
  }
  try {
    const out = await store.createResumeBucket(null, { name })
    res.status(201).json(out)
  } catch (e) {
    if (e.message === "duplicate") {
      return res.status(409).json({ error: "A bucket with that name already exists" })
    }
    console.error(e)
    res.status(500).json({ error: "Failed to create bucket" })
  }
})

app.patch("/api/resume-buckets/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const out = await store.patchResumeBucket(null, id, req.body || {})
    if (!out) return res.status(404).json({ error: "Bucket not found" })
    res.json(out)
  } catch (e) {
    if (e.message === "duplicate") {
      return res.status(409).json({ error: "A bucket with that name already exists" })
    }
    console.error(e)
    res.status(500).json({ error: "Failed to update bucket" })
  }
})

app.delete("/api/resume-buckets/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const ok = await store.deleteResumeBucket(null, id)
    if (!ok) return res.status(404).json({ error: "Bucket not found" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete bucket" })
  }
})

app.post("/api/resume-buckets/:id/upload", upload.single("file"), async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  if (!req.file) return res.status(400).json({ error: "No file uploaded" })
  try {
    const text = await extractResumeText(req.file.buffer, req.file.originalname)
    if (!text.trim()) {
      return res.status(400).json({ error: "Could not extract text from that file" })
    }
    const out = await store.saveBucketResume(null, id, {
      text,
      fileName: req.file.originalname,
    })
    if (!out) return res.status(404).json({ error: "Bucket not found" })
    res.status(201).json(out)
  } catch (e) {
    const msg = typeof e.message === "string" ? e.message : "Failed to process file"
    const status = /too large|unsupported|empty/i.test(msg) ? 400 : 500
    if (status === 500) console.error(e)
    res.status(status).json({ error: msg })
  }
})

app.delete("/api/resume-buckets/:id/resume", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const out = await store.deleteBucketResume(null, id)
    if (!out) return res.status(404).json({ error: "No résumé in this bucket" })
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to remove résumé" })
  }
})

app.post("/api/resume-buckets/:bucketId/versions/:versionId/restore", async (req, res) => {
  const bucketId = parseId(req.params.bucketId)
  const versionId = parseId(req.params.versionId)
  if (bucketId == null || versionId == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const out = await store.restoreResumeVersion(null, bucketId, versionId)
    if (!out) return res.status(404).json({ error: "Archived version not found" })
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to restore résumé version" })
  }
})

app.delete("/api/resume-buckets/:bucketId/versions/:versionId", async (req, res) => {
  const bucketId = parseId(req.params.bucketId)
  const versionId = parseId(req.params.versionId)
  if (bucketId == null || versionId == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const out = await store.deleteResumeVersion(null, bucketId, versionId)
    if (!out) return res.status(404).json({ error: "Archived version not found" })
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete archived résumé" })
  }
})

app.get("/api/resume", async (req, res) => {
  try {
    const out = await store.getFullResume(null)
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load résumé" })
  }
})

app.post("/api/resume", async (req, res) => {
  const { text, fileName } = req.body || {}
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Résumé text is required" })
  }
  try {
    const out = await store.saveFullResume(null, { text, fileName })
    res.status(201).json(out)
  } catch (e) {
    if (e.message === "empty") {
      return res.status(400).json({ error: "Résumé text is required" })
    }
    console.error(e)
    res.status(500).json({ error: "Failed to save résumé" })
  }
})

app.post("/api/resume/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" })
  }
  const bucketId = req.body?.bucketId != null ? Number(req.body.bucketId) : null
  try {
    const text = await extractResumeText(req.file.buffer, req.file.originalname)
    if (!text.trim()) {
      return res.status(400).json({ error: "Could not extract text from that file" })
    }
    const out = await store.saveFullResume(null, {
      text,
      fileName: req.file.originalname,
      bucketId: Number.isFinite(bucketId) ? bucketId : undefined,
    })
    res.status(201).json(out)
  } catch (e) {
    const msg = typeof e.message === "string" ? e.message : "Failed to process file"
    const status = /too large|unsupported|empty/i.test(msg) ? 400 : 500
    if (status === 500) console.error(e)
    res.status(status).json({ error: msg })
  }
})

app.delete("/api/resume", async (req, res) => {
  try {
    const bucketId = req.query.bucketId != null ? Number(req.query.bucketId) : undefined
    const ok = await store.deleteFullResume(null, {
      bucketId: Number.isFinite(bucketId) ? bucketId : undefined,
    })
    if (!ok) return res.status(404).json({ error: "No résumé on file" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete résumé" })
  }
})

app.post("/api/resume/suggestions", async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: "AI suggestions require ANTHROPIC_API_KEY on the server" })
  }

  try {
    const bucketId = req.body?.bucketId != null ? Number(req.body.bucketId) : null
    const [{ profile }, { buckets }] = await Promise.all([
      store.getProfile(null),
      store.getResumeBuckets(null),
    ])
    const careerGoals = typeof profile?.careerGoals === "string" ? profile.careerGoals.trim() : ""
    const bucketList = buckets || []
    const bucket =
      (Number.isFinite(bucketId) ? bucketList.find((b) => b.id === bucketId) : null) ||
      bucketList.find((b) => typeof b.text === "string" && b.text.trim())
    const resumeText = typeof bucket?.text === "string" ? bucket.text.trim() : ""

    if (!careerGoals) {
      return res.status(400).json({
        error: "Add career goals in your profile first (profile icon, top right).",
      })
    }
    if (!resumeText) {
      return res.status(400).json({ error: "Upload your full résumé before requesting suggestions." })
    }

    const userName = typeof profile?.name === "string" ? profile.name.trim() : ""
    const prompt = buildPrompt(careerGoals, resumeText, userName)

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    })

    const text = extractAssistantText(message.content)
    const suggestions = parseSuggestionsJson(text)
    if (suggestions.length === 0) {
      return res.status(502).json({ error: "No suggestions returned — try again" })
    }

    res.json({ suggestions })
  } catch (err) {
    console.error(err)
    const msg = formatAnthropicError(err)
    const lowCredits =
      /credit balance|billing|Plans & Billing/i.test(msg) || /too low to access/i.test(msg)
    const status = lowCredits ? 402 : err?.status >= 400 ? err.status : 500
    const body =
      status === 500 && /JSON|format|Empty response/i.test(msg)
        ? "Could not parse AI suggestions — try again"
        : msg || "Failed to generate suggestions"
    res.status(status).json({ error: body })
  }
})

// —— Outreach logs ——
app.get("/api/outreach-logs", async (req, res) => {
  try {
    const q = req.query.contactId
    const contactId =
      q !== undefined && q !== "" ? q : undefined
    const { logs } = await store.getOutreachLogs(null, contactId)
    res.json({ logs })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load outreach logs" })
  }
})

app.post("/api/outreach-logs", async (req, res) => {
  try {
    const out = await store.createOutreachLog(null, req.body || {})
    if (out === null) return res.status(404).json({ error: "Contact not found" })
    res.status(201).json(out)
  } catch (e) {
    if (e.message === "contactId") {
      return res.status(400).json({ error: "Valid contactId is required" })
    }
    if (e.message === "contactedAt") {
      return res.status(400).json({ error: "contactedAt date is required" })
    }
    console.error(e)
    res.status(500).json({ error: "Failed to save outreach log" })
  }
})

app.delete("/api/outreach-logs/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const ok = await store.deleteOutreachLog(null, id)
    if (!ok) return res.status(404).json({ error: "Log not found" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete log" })
  }
})

// —— AI compose ——
app.post("/compose", async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: "AI compose is not configured (missing ANTHROPIC_API_KEY)" })
  }

  const {
    contactInfo,
    situation,
    tone,
    purpose,
    yourBackground,
    previousCommunication,
    extraContext,
  } = req.body || {}

  if (!situation || typeof situation !== "string" || !situation.trim()) {
    return res.status(400).json({ error: "Situation is required" })
  }

  const toneLine =
    typeof tone === "string" && tone.trim()
      ? tone.trim()
      : "Warm & professional (balanced)"

  const purposeRaw = typeof purpose === "string" ? purpose.trim() : ""
  const hasPurpose = purposeRaw.length > 0
  const purposeBlock = hasPurpose
    ? `PRIMARY GOAL — The sender filled this in on purpose; the email must pursue it (stay polite, but do not ignore it):

${purposeRaw}

Requirements when PRIMARY GOAL is present:
- The closing paragraph must include a concrete ask, question, or proposed next step that clearly relates to the goal above (not a generic "would love to connect" unless that is literally the goal).
- Reference the goal in the body at least once in plain language (paraphrase is fine) so the reader knows why you are writing.
- Subject line should hint at the same intent when it fits the tone.`
    : "PRIMARY GOAL: Not specified — infer one light, appropriate next step from the Situation only."

  const prevRaw =
    typeof previousCommunication === "string" ? previousCommunication.trim() : ""
  const hasPrev = prevRaw.length > 0
  const lengthHint =
    hasPrev && hasPurpose
      ? "Aim for under 220 words (prior thread + explicit purpose need room)."
      : hasPrev
        ? "Aim for under 200 words so you can naturally reference prior context without sounding rushed."
        : hasPurpose
          ? "Aim for under 180 words so the purpose and ask are clearly stated."
          : "Keep it under 150 words."

  const previousBlock = hasPrev
    ? `Previous communication (paste or detailed notes — treat as ground truth only; never invent people, dates, promises, or quotes that are not clearly supported here):

${prevRaw}

How to use this thread in the draft:
- Pull in specific, concrete details: topics they raised, questions left open, advice they gave, dates or deadlines they mentioned, how they signed off, anything they offered or you committed to.
- Use light continuity cues where natural ("Thanks again for…", "Following up on…", "As you mentioned about…") — do not rehash the whole history.
- Where the prior thread suggests formality vs casualness, blend it sensibly with the user's chosen Tone (below); prefer the chosen Tone if they conflict slightly.
- Prioritize the 1–3 details most relevant to the current Situation.`
    : `Previous communication: None provided — write the email without assuming a prior email thread (still use Contact info and Extra context).`

  const prompt = `You are a networking assistant helping someone write a professional outreach message.

Contact info: ${contactInfo || "No specific contact selected"}
Situation: ${situation}
Desired tone: ${toneLine}
${purposeBlock}
My background: ${yourBackground || "Not provided"}
Extra context: ${extraContext || "None"}

${previousBlock}

Write a concise, human networking email for this situation.
- Apply "${toneLine}" consistently in both the subject line and body: formality, warmth, energy, and sentence length should match that tone.
${
  hasPurpose
    ? `- The PRIMARY GOAL section is binding: after drafting, verify the last paragraph would make sense to someone who only read that goal — they should see you asked for that outcome.\n`
    : ""
}- ${lengthHint}
- Sound genuine, not salesy or template-like
- Include a clear subject line
- Format it as:
  Subject: [subject line]
  
  [email body]

Do not add any explanation, just the email.`

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    })

    const text = extractAssistantText(message.content)
    if (!text) {
      return res.status(502).json({ error: "Empty response from model" })
    }
    res.json({ result: text })
  } catch (err) {
    console.error(err)
    const msg = formatAnthropicError(err)
    const lowCredits =
      /credit balance|billing|Plans & Billing/i.test(msg) || /too low to access/i.test(msg)
    const status = lowCredits ? 402 : err?.status >= 400 ? err.status : 500
    res.status(status).json({ error: msg })
  }
})

app.get("/api/health", (req, res) => {
  res.json({
    status: "GhostBuster server running",
    storage: "local-json",
    claudeModel: CLAUDE_MODEL,
    endpoints: [
      "/api/contacts",
      "/api/reminders",
      "/api/profile",
      "/api/outreach-logs",
      "/api/resume-updates",
      "/api/resume",
      "/compose",
    ],
  })
})

const frontendDir = path.join(__dirname, "..", "GhostBuster", "dist")
const hasFrontend = fs.existsSync(path.join(frontendDir, "index.html"))

// Unmatched API routes → JSON (avoid HTML 404 pages breaking the client)
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/compose") {
    return res.status(404).json({ error: `Not found: ${req.method} ${req.path}` })
  }
  next()
})

if (hasFrontend) {
  app.use(
    express.static(frontendDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
        }
      },
    })
  )
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next()
    if (req.path.startsWith("/api") || req.path === "/compose") return next()
    res.sendFile(path.join(frontendDir, "index.html"))
  })
} else {
  app.get("/", (req, res) => {
    res.json({
      status: "GhostBuster API running (no UI build found)",
      hint: "Run: cd GhostBuster && npm run build — or visit /api/health",
      storage: "local-json",
    })
  })
}

const HOST = process.env.HOST || "0.0.0.0"
const server = app.listen(PORT, HOST, () => {
  console.log("GhostBuster API is running — keep this terminal open (Ctrl+C to stop).")
  console.log(`  Local:   http://127.0.0.1:${PORT}/`)
  console.log(`  Network: http://localhost:${PORT}/`)
  console.log("  Data:   ghostbuster-server/data/app-data.json")
  if (!apiKey) console.warn("ANTHROPIC_API_KEY is not set — /compose will return 503")
  setInterval(() => {
    processScheduledEmails().catch((e) => console.warn("Schedule processor:", e.message))
  }, 60 * 1000)
  processScheduledEmails().catch((e) => console.warn("Schedule processor:", e.message))
})

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try: lsof -i :${PORT}   or set PORT=3002 in .env`)
  } else {
    console.error(err)
  }
  process.exit(1)
})
