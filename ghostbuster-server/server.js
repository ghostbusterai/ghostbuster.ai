const express = require("express")
const cors = require("cors")
require("dotenv").config()
const Anthropic = require("@anthropic-ai/sdk")
const { isSupabaseEnabled } = require("./supabaseAdmin")
const { requireUser } = require("./authMiddleware")

const app = express()
const PORT = process.env.PORT || 3001

const store = isSupabaseEnabled() ? require("./dbStore") : require("./fileStore")

const apiKey = process.env.ANTHROPIC_API_KEY
const anthropic = apiKey ? new Anthropic.default({ apiKey }) : null

app.use(cors())
app.use(express.json())
app.use("/api", requireUser)

function uid(req) {
  return req.userId
}

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

// —— Contacts ——
app.get("/api/contacts", async (req, res) => {
  try {
    const { contacts } = await store.getContacts(uid(req))
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
    const { contact } = await store.createContact(uid(req), {
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
    const out = await store.updateContact(uid(req), id, req.body || {})
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
    const ok = await store.deleteContact(uid(req), id)
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
    const { reminders } = await store.getReminders(uid(req))
    res.json({ reminders })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load reminders" })
  }
})

app.post("/api/reminders", async (req, res) => {
  const { contactName, reason, dueDate, done, customReason } = req.body || {}
  if (!contactName || typeof contactName !== "string" || !contactName.trim()) {
    return res.status(400).json({ error: "Contact name is required" })
  }
  try {
    const { reminder } = await store.createReminder(uid(req), {
      contactName,
      reason,
      dueDate,
      done,
      customReason,
    })
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
    const out = await store.patchReminder(uid(req), id, req.body || {})
    if (out == null) return res.status(404).json({ error: "Reminder not found" })
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to update reminder" })
  }
})

app.delete("/api/reminders/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const ok = await store.deleteReminder(uid(req), id)
    if (!ok) return res.status(404).json({ error: "Reminder not found" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete reminder" })
  }
})

// —— Profile ——
app.get("/api/profile", async (req, res) => {
  try {
    const out = await store.getProfile(uid(req))
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load profile" })
  }
})

app.patch("/api/profile", async (req, res) => {
  try {
    const out = await store.patchProfile(uid(req), req.body || {})
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to update profile" })
  }
})

// —— Résumé updates ——
app.get("/api/resume-updates", async (req, res) => {
  try {
    const { updates } = await store.getResumeUpdates(uid(req))
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
    const out = await store.createResumeUpdate(uid(req), { title, details, effectiveDate })
    res.status(201).json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to save update" })
  }
})

app.delete("/api/resume-updates/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(400).json({ error: "Invalid id" })
  try {
    const ok = await store.deleteResumeUpdate(uid(req), id)
    if (!ok) return res.status(404).json({ error: "Update not found" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete update" })
  }
})

// —— Outreach logs ——
app.get("/api/outreach-logs", async (req, res) => {
  try {
    const q = req.query.contactId
    const contactId =
      q !== undefined && q !== "" ? q : undefined
    const { logs } = await store.getOutreachLogs(uid(req), contactId)
    res.json({ logs })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to load outreach logs" })
  }
})

app.post("/api/outreach-logs", async (req, res) => {
  try {
    const out = await store.createOutreachLog(uid(req), req.body || {})
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
    const ok = await store.deleteOutreachLog(uid(req), id)
    if (!ok) return res.status(404).json({ error: "Log not found" })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to delete log" })
  }
})

// —— AI compose ——
app.post("/compose", requireUser, async (req, res) => {
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
      model: "claude-sonnet-4-20250514",
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

app.get("/", (req, res) => {
  res.json({
    status: "GhostBuster server running",
    auth: isSupabaseEnabled() ? "supabase-jwt" : "off (file store)",
    endpoints: [
      "/api/contacts",
      "/api/reminders",
      "/api/profile",
      "/api/outreach-logs",
      "/api/resume-updates",
      "/compose",
    ],
  })
})

const HOST = process.env.HOST || "0.0.0.0"
const server = app.listen(PORT, HOST, () => {
  console.log("GhostBuster API is running — keep this terminal open (Ctrl+C to stop).")
  console.log(`  Local:   http://127.0.0.1:${PORT}/`)
  console.log(`  Network: http://localhost:${PORT}/`)
  console.log(
    isSupabaseEnabled()
      ? "  Data:   Supabase Postgres (JWT required on /api and /compose)"
      : "  Data:   Local JSON file (no sign-in)"
  )
  if (!apiKey) console.warn("ANTHROPIC_API_KEY is not set — /compose will return 503")
})

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try: lsof -i :${PORT}   or set PORT=3002 in .env`)
  } else {
    console.error(err)
  }
  process.exit(1)
})
