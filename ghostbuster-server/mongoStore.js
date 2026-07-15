const { ObjectId } = require("mongodb")
const { getDb } = require("./db")
const { suggestResumeBucket } = require("./resumeBucketMatch")

function uid(userId) {
  if (!userId) throw new Error("userId required")
  return String(userId)
}

function nextNumericId() {
  return Date.now() + Math.floor(Math.random() * 1000)
}

function stripMongo(doc) {
  if (!doc) return null
  const { _id, userId, ...rest } = doc
  return rest
}

async function resolveResumeBucketId(userId, body, prev = null) {
  const buckets = await getDb().collection("resumeBuckets").find({ userId: uid(userId) }).toArray()
  if (body.resumeBucketId !== undefined) {
    if (body.resumeBucketId === null || body.resumeBucketId === "") return null
    const id = Number(body.resumeBucketId)
    return Number.isFinite(id) && buckets.some((b) => b.id === id) ? id : null
  }

  const role = body.role !== undefined ? String(body.role ?? "") : String(prev?.role ?? "")
  const roleChanged =
    prev && body.role !== undefined && String(body.role ?? "") !== String(prev.role ?? "")
  if (prev && !roleChanged && prev.resumeBucketId != null) return prev.resumeBucketId

  const suggested = suggestResumeBucket(role, buckets.map(stripMongo))
  return suggested?.id ?? null
}

async function findResumeBucket(userId, id) {
  const bid = Number(id)
  if (!Number.isFinite(bid)) return null
  return getDb().collection("resumeBuckets").findOne({ userId: uid(userId), id: bid })
}

function publicUser(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    email: doc.email || "",
    name: doc.name || "",
    picture: doc.picture || "",
  }
}

// —— Users / auth ——

exports.findUserById = async (userId) => {
  if (!userId || !ObjectId.isValid(userId)) return null
  return getDb().collection("users").findOne({ _id: new ObjectId(userId) })
}

exports.findUserByGoogleId = async (googleId) => {
  return getDb().collection("users").findOne({ googleId: String(googleId) })
}

exports.upsertGoogleUser = async ({ googleId, email, name, picture }) => {
  const users = getDb().collection("users")
  const now = new Date().toISOString()
  const existing = await users.findOne({ googleId: String(googleId) })
  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          email: email || existing.email || "",
          name: name || existing.name || "",
          picture: picture || existing.picture || "",
          updatedAt: now,
        },
      }
    )
    return users.findOne({ _id: existing._id })
  }
  const doc = {
    googleId: String(googleId),
    email: email || "",
    name: name || "",
    picture: picture || "",
    googleRefreshToken: null,
    googleConnectedAt: "",
    createdAt: now,
    updatedAt: now,
  }
  const result = await users.insertOne(doc)
  return users.findOne({ _id: result.insertedId })
}

exports.toPublicUser = publicUser

exports.ensureProfile = async (userId, defaults = {}) => {
  const profiles = getDb().collection("profiles")
  const existing = await profiles.findOne({ userId: uid(userId) })
  if (existing) return existing
  const profile = {
    userId: uid(userId),
    name: typeof defaults.name === "string" ? defaults.name : "",
    careerGoals: "",
    lastResumeUpdate: "",
    hideGettingStarted: false,
  }
  await profiles.insertOne(profile)
  return profile
}

// —— Contacts ——

exports.getContacts = async (userId) => {
  const contacts = await getDb()
    .collection("contacts")
    .find({ userId: uid(userId) })
    .sort({ id: -1 })
    .toArray()
  return { contacts: contacts.map(stripMongo) }
}

exports.createContact = async (userId, body) => {
  const { name, email, phone, company, role, notes, lastContacted, linkedin, website } = body || {}
  const resumeBucketId = await resolveResumeBucketId(userId, body)
  const contact = {
    userId: uid(userId),
    id: nextNumericId(),
    name: name.trim(),
    email: email ?? "",
    phone: phone ?? "",
    company: company ?? "",
    role: role ?? "",
    notes: notes ?? "",
    lastContacted: lastContacted ?? "",
    linkedin: linkedin ?? "",
    website: website ?? "",
    resumeBucketId,
  }
  await getDb().collection("contacts").insertOne(contact)
  return { contact: stripMongo(contact) }
}

exports.updateContact = async (userId, id, body) => {
  const col = getDb().collection("contacts")
  const prev = await col.findOne({ userId: uid(userId), id })
  if (!prev) return null
  const resumeBucketId = await resolveResumeBucketId(userId, body, prev)
  const next = {
    name: typeof body.name === "string" ? body.name.trim() : prev.name,
    email: body.email !== undefined ? body.email : prev.email,
    phone: body.phone !== undefined ? body.phone : prev.phone,
    company: body.company !== undefined ? body.company : prev.company,
    role: body.role !== undefined ? body.role : prev.role,
    notes: body.notes !== undefined ? body.notes : prev.notes,
    lastContacted: body.lastContacted !== undefined ? body.lastContacted : prev.lastContacted,
    linkedin: body.linkedin !== undefined ? body.linkedin : prev.linkedin ?? "",
    website: body.website !== undefined ? body.website : prev.website ?? "",
    resumeBucketId,
  }
  if (!next.name) return null
  await col.updateOne({ _id: prev._id }, { $set: next })
  return { contact: stripMongo({ ...prev, ...next }) }
}

exports.deleteContact = async (userId, id) => {
  const result = await getDb().collection("contacts").deleteOne({ userId: uid(userId), id })
  if (result.deletedCount === 0) return false
  await getDb().collection("outreachLogs").deleteMany({ userId: uid(userId), contactId: id })
  return true
}

// —— Reminders ——

exports.getReminders = async (userId) => {
  const reminders = await getDb()
    .collection("reminders")
    .find({ userId: uid(userId) })
    .sort({ id: -1 })
    .toArray()
  return { reminders: reminders.map(stripMongo) }
}

exports.createReminder = async (userId, body) => {
  const { contactName, reason, dueDate, done, customReason } = body || {}
  const reminder = {
    userId: uid(userId),
    id: nextNumericId(),
    contactName: contactName.trim(),
    reason: reason ?? "",
    dueDate: dueDate ?? "",
    done: Boolean(done),
    customReason: customReason ?? "",
    googleEventId: "",
  }
  await getDb().collection("reminders").insertOne(reminder)
  return { reminder: stripMongo(reminder) }
}

exports.patchReminder = async (userId, id, body) => {
  const col = getDb().collection("reminders")
  const prev = await col.findOne({ userId: uid(userId), id })
  if (!prev) return null
  const next = {
    contactName: body.contactName !== undefined ? String(body.contactName).trim() : prev.contactName,
    reason: body.reason !== undefined ? body.reason : prev.reason,
    dueDate: body.dueDate !== undefined ? body.dueDate : prev.dueDate,
    done: body.done !== undefined ? Boolean(body.done) : prev.done,
    customReason: body.customReason !== undefined ? body.customReason : prev.customReason,
  }
  await col.updateOne({ _id: prev._id }, { $set: next })
  return { reminder: stripMongo({ ...prev, ...next }) }
}

exports.deleteReminder = async (userId, id) => {
  const result = await getDb().collection("reminders").deleteOne({ userId: uid(userId), id })
  return result.deletedCount > 0
}

exports.setReminderGoogleEventId = async (userId, id, googleEventId) => {
  const col = getDb().collection("reminders")
  const prev = await col.findOne({ userId: uid(userId), id })
  if (!prev) return null
  const googleEventIdStr = typeof googleEventId === "string" ? googleEventId : ""
  await col.updateOne({ _id: prev._id }, { $set: { googleEventId: googleEventIdStr } })
  return { reminder: stripMongo({ ...prev, googleEventId: googleEventIdStr }) }
}

// —— Google Calendar / Gmail tokens (per user) ——

exports.getGoogleCalendarStatus = async (userId) => {
  const user = await exports.findUserById(userId)
  return {
    connected: Boolean(user?.googleRefreshToken),
    connectedAt: user?.googleConnectedAt || "",
  }
}

exports.saveGoogleCalendarTokens = async (userId, tokens) => {
  const user = await exports.findUserById(userId)
  if (!user) throw new Error("user not found")
  const refreshToken = tokens?.refresh_token || user.googleRefreshToken
  if (!refreshToken) throw new Error("missing_refresh_token")
  const connectedAt = new Date().toISOString()
  await getDb().collection("users").updateOne(
    { _id: user._id },
    { $set: { googleRefreshToken: refreshToken, googleConnectedAt: connectedAt } }
  )
  return { connected: true, connectedAt }
}

exports.clearGoogleCalendar = async (userId) => {
  const user = await exports.findUserById(userId)
  if (!user?.googleRefreshToken) return false
  await getDb().collection("users").updateOne(
    { _id: user._id },
    { $set: { googleRefreshToken: null, googleConnectedAt: "" } }
  )
  return true
}

exports.getGoogleRefreshToken = async (userId) => {
  const user = await exports.findUserById(userId)
  return user?.googleRefreshToken || null
}

// —— Scheduled emails ——

exports.createScheduledEmail = async (userId, body) => {
  const { to, subject, body: emailBody, sendAt, contactName } = body || {}
  const when = typeof sendAt === "string" ? sendAt.trim() : ""
  const recipient = typeof to === "string" ? to.trim() : ""
  if (!recipient) throw new Error("recipient")
  if (!when) throw new Error("sendAt")
  const sendMs = new Date(when).getTime()
  if (Number.isNaN(sendMs) || sendMs <= Date.now()) throw new Error("future")

  const item = {
    userId: uid(userId),
    id: nextNumericId(),
    to: recipient,
    subject: typeof subject === "string" ? subject.trim() : "",
    body: typeof emailBody === "string" ? emailBody : "",
    sendAt: when,
    contactName: typeof contactName === "string" ? contactName.trim() : "",
    status: "pending",
    createdAt: new Date().toISOString(),
    sentAt: "",
    error: "",
  }
  await getDb().collection("scheduledEmails").insertOne(item)
  return { scheduled: stripMongo(item) }
}

/** Due pending emails across all users, each enriched with that user's refresh token. */
exports.getDueScheduledEmails = async () => {
  const now = Date.now()
  const pending = await getDb().collection("scheduledEmails").find({ status: "pending" }).toArray()
  const result = []
  for (const item of pending) {
    const t = new Date(item.sendAt).getTime()
    if (Number.isNaN(t) || t > now) continue
    const token = await exports.getGoogleRefreshToken(item.userId)
    result.push({ ...stripMongo(item), userId: item.userId, refreshToken: token })
  }
  return result
}

exports.markScheduledEmailSent = async (_userId, id, messageId) => {
  const col = getDb().collection("scheduledEmails")
  const filter = _userId ? { userId: uid(_userId), id } : { id }
  const result = await col.updateOne(filter, {
    $set: {
      status: "sent",
      sentAt: new Date().toISOString(),
      messageId: typeof messageId === "string" ? messageId : "",
      error: "",
    },
  })
  return result.matchedCount > 0
}

exports.markScheduledEmailFailed = async (_userId, id, errorMessage) => {
  const col = getDb().collection("scheduledEmails")
  const filter = _userId ? { userId: uid(_userId), id } : { id }
  const result = await col.updateOne(filter, {
    $set: {
      status: "failed",
      error: typeof errorMessage === "string" ? errorMessage : "Send failed",
    },
  })
  return result.matchedCount > 0
}

// —— Profile ——

exports.getProfile = async (userId) => {
  const p = (await getDb().collection("profiles").findOne({ userId: uid(userId) })) || {}
  return {
    profile: {
      name: typeof p.name === "string" ? p.name : "",
      careerGoals: typeof p.careerGoals === "string" ? p.careerGoals : "",
      lastResumeUpdate: typeof p.lastResumeUpdate === "string" ? p.lastResumeUpdate : "",
      hideGettingStarted: Boolean(p.hideGettingStarted),
    },
  }
}

exports.patchProfile = async (userId, body) => {
  await exports.ensureProfile(userId)
  const $set = {}
  if (body.name !== undefined) {
    $set.name = typeof body.name === "string" ? body.name.trim() : ""
  }
  if (body.careerGoals !== undefined) {
    $set.careerGoals = typeof body.careerGoals === "string" ? body.careerGoals : ""
  }
  if (body.lastResumeUpdate !== undefined) {
    $set.lastResumeUpdate = typeof body.lastResumeUpdate === "string" ? body.lastResumeUpdate : ""
  }
  if (body.hideGettingStarted !== undefined) {
    $set.hideGettingStarted = Boolean(body.hideGettingStarted)
  }
  if (Object.keys($set).length) {
    await getDb().collection("profiles").updateOne({ userId: uid(userId) }, { $set })
  }
  return exports.getProfile(userId)
}

// —— Resume updates ——

exports.getResumeUpdates = async (userId) => {
  const list = await getDb()
    .collection("resumeUpdates")
    .find({ userId: uid(userId) })
    .toArray()
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  return { updates: list.map(stripMongo) }
}

exports.createResumeUpdate = async (userId, body) => {
  const { title, details, effectiveDate } = body || {}
  const bodyText = typeof details === "string" ? details : ""
  const effective =
    typeof effectiveDate === "string" && effectiveDate.trim()
      ? effectiveDate.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  const update = {
    userId: uid(userId),
    id: nextNumericId(),
    title: title.trim(),
    details: bodyText,
    effectiveDate: effective,
    createdAt: new Date().toISOString(),
  }
  await getDb().collection("resumeUpdates").insertOne(update)

  await exports.ensureProfile(userId)
  const profile = await getDb().collection("profiles").findOne({ userId: uid(userId) })
  const prev = profile?.lastResumeUpdate || ""
  if (!prev || effective > prev) {
    await getDb()
      .collection("profiles")
      .updateOne({ userId: uid(userId) }, { $set: { lastResumeUpdate: effective } })
  }
  return { update: stripMongo(update) }
}

exports.deleteResumeUpdate = async (userId, id) => {
  const result = await getDb().collection("resumeUpdates").deleteOne({ userId: uid(userId), id })
  return result.deletedCount > 0
}

// —— Resume buckets ——

exports.getFullResume = async (userId) => {
  const buckets = await getDb().collection("resumeBuckets").find({ userId: uid(userId) }).toArray()
  const bucket = buckets.find((b) => typeof b.text === "string" && b.text.trim())
  if (bucket) {
    return {
      resume: {
        text: bucket.text,
        fileName: bucket.fileName || "",
        uploadedAt: bucket.uploadedAt || "",
        bucketId: bucket.id,
        bucketName: bucket.name,
      },
    }
  }
  return { resume: null }
}

exports.getResumeBuckets = async (userId) => {
  const buckets = await getDb()
    .collection("resumeBuckets")
    .find({ userId: uid(userId) })
    .sort({ id: 1 })
    .toArray()
  return { buckets: buckets.map(stripMongo) }
}

exports.createResumeBucket = async (userId, body) => {
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  if (!name) throw new Error("name")
  const col = getDb().collection("resumeBuckets")
  const existing = await col
    .find({ userId: uid(userId) })
    .toArray()
  if (existing.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("duplicate")
  }
  const bucket = {
    userId: uid(userId),
    id: nextNumericId(),
    name,
    text: "",
    fileName: "",
    uploadedAt: "",
    createdAt: new Date().toISOString(),
    versions: [],
  }
  await col.insertOne(bucket)
  return { bucket: stripMongo(bucket) }
}

exports.patchResumeBucket = async (userId, id, body) => {
  const bucket = await findResumeBucket(userId, id)
  if (!bucket) return null
  if (typeof body?.name === "string" && body.name.trim()) {
    const nextName = body.name.trim()
    const existing = await getDb().collection("resumeBuckets").find({ userId: uid(userId) }).toArray()
    if (existing.some((b) => b.id !== bucket.id && b.name.toLowerCase() === nextName.toLowerCase())) {
      throw new Error("duplicate")
    }
    await getDb().collection("resumeBuckets").updateOne({ _id: bucket._id }, { $set: { name: nextName } })
    bucket.name = nextName
  }
  return { bucket: stripMongo(bucket) }
}

exports.deleteResumeBucket = async (userId, id) => {
  const bid = Number(id)
  const result = await getDb().collection("resumeBuckets").deleteOne({ userId: uid(userId), id: bid })
  if (result.deletedCount === 0) return false
  await getDb()
    .collection("contacts")
    .updateMany({ userId: uid(userId), resumeBucketId: bid }, { $set: { resumeBucketId: null } })
  return true
}

function ensureBucketVersions(bucket) {
  if (!Array.isArray(bucket.versions)) bucket.versions = []
}

function archiveCurrentBucketResume(bucket) {
  if (!bucket?.text || !String(bucket.text).trim()) return
  ensureBucketVersions(bucket)
  bucket.versions.push({
    id: nextNumericId(),
    text: bucket.text.trim(),
    fileName: typeof bucket.fileName === "string" ? bucket.fileName : "",
    uploadedAt: typeof bucket.uploadedAt === "string" ? bucket.uploadedAt : new Date().toISOString(),
    archivedAt: new Date().toISOString(),
  })
}

function findResumeVersion(bucket, versionId) {
  const vid = Number(versionId)
  if (!Number.isFinite(vid)) return null
  ensureBucketVersions(bucket)
  return bucket.versions.find((v) => v.id === vid) || null
}

exports.saveBucketResume = async (userId, bucketId, body) => {
  const { text, fileName } = body || {}
  if (typeof text !== "string" || !text.trim()) throw new Error("empty")
  const bucket = await findResumeBucket(userId, bucketId)
  if (!bucket) return null
  ensureBucketVersions(bucket)
  archiveCurrentBucketResume(bucket)
  const $set = {
    text: text.trim(),
    fileName: typeof fileName === "string" ? fileName.trim() : "",
    uploadedAt: new Date().toISOString(),
    versions: bucket.versions,
  }
  await getDb().collection("resumeBuckets").updateOne({ _id: bucket._id }, { $set })
  return { bucket: stripMongo({ ...bucket, ...$set }) }
}

exports.deleteBucketResume = async (userId, bucketId) => {
  const bucket = await findResumeBucket(userId, bucketId)
  if (!bucket || !bucket.text) return null
  ensureBucketVersions(bucket)
  archiveCurrentBucketResume(bucket)
  const $set = { text: "", fileName: "", uploadedAt: "", versions: bucket.versions }
  await getDb().collection("resumeBuckets").updateOne({ _id: bucket._id }, { $set })
  return { bucket: stripMongo({ ...bucket, ...$set }) }
}

exports.restoreResumeVersion = async (userId, bucketId, versionId) => {
  const bucket = await findResumeBucket(userId, bucketId)
  if (!bucket) return null
  const version = findResumeVersion(bucket, versionId)
  if (!version) return null
  ensureBucketVersions(bucket)
  bucket.versions = bucket.versions.filter((v) => v.id !== version.id)
  archiveCurrentBucketResume(bucket)
  const $set = {
    text: version.text,
    fileName: version.fileName || "",
    uploadedAt: version.uploadedAt || new Date().toISOString(),
    versions: bucket.versions,
  }
  await getDb().collection("resumeBuckets").updateOne({ _id: bucket._id }, { $set })
  return { bucket: stripMongo({ ...bucket, ...$set }) }
}

exports.deleteResumeVersion = async (userId, bucketId, versionId) => {
  const bucket = await findResumeBucket(userId, bucketId)
  if (!bucket) return null
  const version = findResumeVersion(bucket, versionId)
  if (!version) return null
  ensureBucketVersions(bucket)
  const versions = bucket.versions.filter((v) => v.id !== version.id)
  await getDb().collection("resumeBuckets").updateOne({ _id: bucket._id }, { $set: { versions } })
  return { bucket: stripMongo({ ...bucket, versions }) }
}

exports.saveFullResume = async (userId, body) => {
  const { text, fileName, bucketId } = body || {}
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("empty")
  }
  if (bucketId != null) {
    const out = await exports.saveBucketResume(userId, bucketId, { text, fileName })
    if (!out) throw new Error("bucket")
    const bucket = out.bucket
    return {
      resume: {
        text: bucket.text,
        fileName: bucket.fileName,
        uploadedAt: bucket.uploadedAt,
        bucketId: bucket.id,
        bucketName: bucket.name,
      },
    }
  }
  const { buckets } = await exports.getResumeBuckets(userId)
  let bucket
  if (buckets.length === 0) {
    const created = await exports.createResumeBucket(userId, { name: "General" })
    bucket = created.bucket
  } else {
    bucket = buckets[0]
  }
  const out = await exports.saveBucketResume(userId, bucket.id, { text, fileName })
  bucket = out.bucket
  return {
    resume: {
      text: bucket.text,
      fileName: bucket.fileName,
      uploadedAt: bucket.uploadedAt,
      bucketId: bucket.id,
      bucketName: bucket.name,
    },
  }
}

exports.deleteFullResume = async (userId, body) => {
  if (body?.bucketId != null) {
    const out = await exports.deleteBucketResume(userId, body.bucketId)
    return Boolean(out)
  }
  const { buckets } = await exports.getResumeBuckets(userId)
  const first = buckets.find((b) => b.text)
  if (!first) return false
  const out = await exports.deleteBucketResume(userId, first.id)
  return Boolean(out)
}

// —— Outreach logs ——

exports.getOutreachLogs = async (userId, contactId) => {
  const filter = { userId: uid(userId) }
  if (contactId !== undefined && contactId !== null && contactId !== "") {
    const cid = Number(contactId)
    if (Number.isFinite(cid)) filter.contactId = cid
  }
  const logs = await getDb().collection("outreachLogs").find(filter).toArray()
  logs.sort((a, b) => new Date(b.contactedAt) - new Date(a.contactedAt))
  return { logs: logs.map(stripMongo) }
}

exports.createOutreachLog = async (userId, body) => {
  const { contactId, contactedAt, channel, note } = body || {}
  const cid = Number(contactId)
  if (!Number.isFinite(cid)) throw new Error("contactId")
  const when = typeof contactedAt === "string" && contactedAt.trim() ? contactedAt.trim() : ""
  if (!when) throw new Error("contactedAt")

  const contact = await getDb().collection("contacts").findOne({ userId: uid(userId), id: cid })
  if (!contact) return null

  const log = {
    userId: uid(userId),
    id: nextNumericId(),
    contactId: cid,
    contactedAt: when,
    channel: typeof channel === "string" ? channel : "",
    note: typeof note === "string" ? note : "",
  }
  await getDb().collection("outreachLogs").insertOne(log)

  const prev = contact.lastContacted || ""
  const prevT = prev ? new Date(prev).getTime() : 0
  const newT = new Date(when).getTime()
  if (!Number.isNaN(newT) && newT >= prevT) {
    await getDb()
      .collection("contacts")
      .updateOne({ _id: contact._id }, { $set: { lastContacted: when } })
  }
  return { log: stripMongo(log) }
}

exports.deleteOutreachLog = async (userId, id) => {
  const result = await getDb().collection("outreachLogs").deleteOne({ userId: uid(userId), id })
  return result.deletedCount > 0
}

exports.numId = (param) => {
  const id = Number(param)
  return Number.isFinite(id) ? id : null
}

/** Bulk import from legacy app-data.json shape into a user (one-time migration). */
exports.importLegacyData = async (userId, data) => {
  const user = uid(userId)
  const db = getDb()

  if (data.profile && typeof data.profile === "object") {
    await exports.ensureProfile(user, { name: data.profile.name })
    await db.collection("profiles").updateOne(
      { userId: user },
      {
        $set: {
          name: typeof data.profile.name === "string" ? data.profile.name : "",
          careerGoals: typeof data.profile.careerGoals === "string" ? data.profile.careerGoals : "",
          lastResumeUpdate:
            typeof data.profile.lastResumeUpdate === "string" ? data.profile.lastResumeUpdate : "",
          hideGettingStarted: Boolean(data.profile.hideGettingStarted),
        },
      }
    )
  } else {
    await exports.ensureProfile(user)
  }

  const contactMap = new Map()
  for (const c of data.contacts || []) {
    const oldId = c.id
    const contact = {
      userId: user,
      id: typeof c.id === "number" ? c.id : nextNumericId(),
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      company: c.company || "",
      role: c.role || "",
      notes: c.notes || "",
      lastContacted: c.lastContacted || "",
      linkedin: c.linkedin || "",
      website: c.website || "",
      resumeBucketId: c.resumeBucketId ?? null,
    }
    await db.collection("contacts").insertOne(contact)
    contactMap.set(oldId, contact.id)
  }

  for (const r of data.reminders || []) {
    await db.collection("reminders").insertOne({
      userId: user,
      id: typeof r.id === "number" ? r.id : nextNumericId(),
      contactName: r.contactName || "",
      reason: r.reason || "",
      dueDate: r.dueDate || "",
      done: Boolean(r.done),
      customReason: r.customReason || "",
      googleEventId: r.googleEventId || "",
    })
  }

  for (const u of data.resumeUpdates || []) {
    await db.collection("resumeUpdates").insertOne({
      userId: user,
      id: typeof u.id === "number" ? u.id : nextNumericId(),
      title: u.title || "",
      details: u.details || "",
      effectiveDate: u.effectiveDate || "",
      createdAt: u.createdAt || new Date().toISOString(),
    })
  }

  for (const b of data.resumeBuckets || []) {
    await db.collection("resumeBuckets").insertOne({
      userId: user,
      id: typeof b.id === "number" ? b.id : nextNumericId(),
      name: b.name || "General",
      text: b.text || "",
      fileName: b.fileName || "",
      uploadedAt: b.uploadedAt || "",
      createdAt: b.createdAt || new Date().toISOString(),
    })
  }

  if (
    (!data.resumeBuckets || data.resumeBuckets.length === 0) &&
    data.fullResume?.text
  ) {
    await db.collection("resumeBuckets").insertOne({
      userId: user,
      id: nextNumericId(),
      name: "General",
      text: data.fullResume.text,
      fileName: data.fullResume.fileName || "",
      uploadedAt: data.fullResume.uploadedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
  }

  for (const l of data.outreachLogs || []) {
    const mappedContactId = contactMap.has(l.contactId) ? contactMap.get(l.contactId) : l.contactId
    await db.collection("outreachLogs").insertOne({
      userId: user,
      id: typeof l.id === "number" ? l.id : nextNumericId(),
      contactId: mappedContactId,
      contactedAt: l.contactedAt || "",
      channel: l.channel || "",
      note: l.note || "",
    })
  }

  for (const e of data.scheduledEmails || []) {
    await db.collection("scheduledEmails").insertOne({
      userId: user,
      id: typeof e.id === "number" ? e.id : nextNumericId(),
      to: e.to || "",
      subject: e.subject || "",
      body: e.body || "",
      sendAt: e.sendAt || "",
      contactName: e.contactName || "",
      status: e.status || "pending",
      createdAt: e.createdAt || new Date().toISOString(),
      sentAt: e.sentAt || "",
      error: e.error || "",
    })
  }

  if (data.googleCalendar?.refreshToken) {
    await db.collection("users").updateOne(
      { _id: new ObjectId(user) },
      {
        $set: {
          googleRefreshToken: data.googleCalendar.refreshToken,
          googleConnectedAt: data.googleCalendar.connectedAt || new Date().toISOString(),
        },
      }
    )
  }

  await db.collection("meta").updateOne(
    { key: "legacyMigrated" },
    { $set: { key: "legacyMigrated", userId: user, at: new Date().toISOString() } },
    { upsert: true }
  )
}

exports.hasLegacyMigrated = async () => {
  const doc = await getDb().collection("meta").findOne({ key: "legacyMigrated" })
  return Boolean(doc)
}
