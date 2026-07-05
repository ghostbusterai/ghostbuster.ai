const { read, write } = require("./store")
const { suggestResumeBucket } = require("./resumeBucketMatch")

/** Single-tenant JSON file store (no user id). */

function resolveResumeBucketId(data, body, prev = null) {
  const buckets = data.resumeBuckets || []
  if (body.resumeBucketId !== undefined) {
    if (body.resumeBucketId === null || body.resumeBucketId === "") return null
    const id = Number(body.resumeBucketId)
    return Number.isFinite(id) && buckets.some((b) => b.id === id) ? id : null
  }

  const role = body.role !== undefined ? String(body.role ?? "") : String(prev?.role ?? "")
  const roleChanged =
    prev && body.role !== undefined && String(body.role ?? "") !== String(prev.role ?? "")
  if (prev && !roleChanged && prev.resumeBucketId != null) return prev.resumeBucketId

  const suggested = suggestResumeBucket(role, buckets)
  return suggested?.id ?? null
}

function findResumeBucket(data, id) {
  const bid = Number(id)
  if (!Number.isFinite(bid)) return null
  return (data.resumeBuckets || []).find((b) => b.id === bid) || null
}

function ensureBucketVersions(bucket) {
  if (!Array.isArray(bucket.versions)) bucket.versions = []
}

function archiveCurrentBucketResume(bucket) {
  if (!bucket?.text || !String(bucket.text).trim()) return
  ensureBucketVersions(bucket)
  bucket.versions.push({
    id: Date.now(),
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

exports.getContacts = async () => {
  const data = read()
  return { contacts: data.contacts || [] }
}

exports.createContact = async (_userId, body) => {
  const { name, email, phone, company, role, notes, lastContacted, linkedin, website } = body || {}
  const data = read()
  if (!Array.isArray(data.resumeBuckets)) data.resumeBuckets = []
  const resumeBucketId = resolveResumeBucketId(data, body)
  const contact = {
    id: Date.now(),
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
    pinned: Boolean(body.pinned),
  }
  data.contacts.push(contact)
  write(data)
  return { contact }
}

exports.updateContact = async (_userId, id, body) => {
  const data = read()
  const idx = data.contacts.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const prev = data.contacts[idx]
  const resumeBucketId = resolveResumeBucketId(data, body, prev)
  data.contacts[idx] = {
    ...prev,
    name: typeof body.name === "string" ? body.name.trim() : prev.name,
    email: body.email !== undefined ? body.email : prev.email,
    phone: body.phone !== undefined ? body.phone : prev.phone,
    company: body.company !== undefined ? body.company : prev.company,
    role: body.role !== undefined ? body.role : prev.role,
    notes: body.notes !== undefined ? body.notes : prev.notes,
    lastContacted: body.lastContacted !== undefined ? body.lastContacted : prev.lastContacted,
    linkedin: body.linkedin !== undefined ? body.linkedin : (prev.linkedin ?? ""),
    website: body.website !== undefined ? body.website : (prev.website ?? ""),
    resumeBucketId,
    pinned: body.pinned !== undefined ? Boolean(body.pinned) : Boolean(prev.pinned),
  }
  if (!data.contacts[idx].name) return null
  write(data)
  return { contact: data.contacts[idx] }
}

exports.deleteContact = async (_userId, id) => {
  const data = read()
  const before = data.contacts.length
  data.contacts = data.contacts.filter((c) => c.id !== id)
  if (data.contacts.length === before) return false
  if (!Array.isArray(data.outreachLogs)) data.outreachLogs = []
  data.outreachLogs = data.outreachLogs.filter((log) => log.contactId !== id)
  write(data)
  return true
}

exports.getReminders = async () => {
  const { reminders } = read()
  return { reminders }
}

exports.createReminder = async (_userId, body) => {
  const { contactName, reason, dueDate, done, customReason } = body || {}
  const data = read()
  const reminder = {
    id: Date.now(),
    contactName: contactName.trim(),
    reason: reason ?? "",
    dueDate: dueDate ?? "",
    done: Boolean(done),
    customReason: customReason ?? "",
    googleEventId: "",
  }
  data.reminders.push(reminder)
  write(data)
  return { reminder }
}

exports.patchReminder = async (_userId, id, body) => {
  const data = read()
  const idx = data.reminders.findIndex((r) => r.id === id)
  if (idx === -1) return null
  const prev = data.reminders[idx]
  data.reminders[idx] = {
    ...prev,
    contactName: body.contactName !== undefined ? String(body.contactName).trim() : prev.contactName,
    reason: body.reason !== undefined ? body.reason : prev.reason,
    dueDate: body.dueDate !== undefined ? body.dueDate : prev.dueDate,
    done: body.done !== undefined ? Boolean(body.done) : prev.done,
    customReason: body.customReason !== undefined ? body.customReason : prev.customReason,
  }
  write(data)
  return { reminder: data.reminders[idx] }
}

exports.deleteReminder = async (_userId, id) => {
  const data = read()
  const before = data.reminders.length
  data.reminders = data.reminders.filter((r) => r.id !== id)
  if (data.reminders.length === before) return false
  write(data)
  return true
}

exports.getGoogleCalendarStatus = async () => {
  const data = read()
  const g = data.googleCalendar
  return {
    connected: Boolean(g?.refreshToken),
    connectedAt: g?.connectedAt || "",
  }
}

exports.saveGoogleCalendarTokens = async (_userId, tokens) => {
  const refreshToken = tokens?.refresh_token
  if (!refreshToken) throw new Error("missing_refresh_token")
  const data = read()
  data.googleCalendar = {
    refreshToken,
    connectedAt: new Date().toISOString(),
  }
  write(data)
  return { connected: true, connectedAt: data.googleCalendar.connectedAt }
}

exports.clearGoogleCalendar = async () => {
  const data = read()
  if (!data.googleCalendar) return false
  data.googleCalendar = null
  write(data)
  return true
}

exports.getGoogleRefreshToken = async () => {
  const data = read()
  return data.googleCalendar?.refreshToken || null
}

exports.setReminderGoogleEventId = async (_userId, id, googleEventId) => {
  const data = read()
  const idx = data.reminders.findIndex((r) => r.id === id)
  if (idx === -1) return null
  data.reminders[idx] = {
    ...data.reminders[idx],
    googleEventId: typeof googleEventId === "string" ? googleEventId : "",
  }
  write(data)
  return { reminder: data.reminders[idx] }
}

exports.createScheduledEmail = async (_userId, body) => {
  const { to, subject, body: emailBody, sendAt, contactName } = body || {}
  const when = typeof sendAt === "string" ? sendAt.trim() : ""
  const recipient = typeof to === "string" ? to.trim() : ""
  if (!recipient) throw new Error("recipient")
  if (!when) throw new Error("sendAt")
  const sendMs = new Date(when).getTime()
  if (Number.isNaN(sendMs) || sendMs <= Date.now()) throw new Error("future")

  const data = read()
  if (!Array.isArray(data.scheduledEmails)) data.scheduledEmails = []
  const item = {
    id: Date.now(),
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
  data.scheduledEmails.push(item)
  write(data)
  return { scheduled: item }
}

exports.getDueScheduledEmails = async () => {
  const data = read()
  const list = Array.isArray(data.scheduledEmails) ? data.scheduledEmails : []
  const now = Date.now()
  return list.filter((item) => {
    if (item.status !== "pending") return false
    const t = new Date(item.sendAt).getTime()
    return !Number.isNaN(t) && t <= now
  })
}

exports.markScheduledEmailSent = async (id, messageId) => {
  const data = read()
  const idx = (data.scheduledEmails || []).findIndex((e) => e.id === id)
  if (idx === -1) return false
  data.scheduledEmails[idx] = {
    ...data.scheduledEmails[idx],
    status: "sent",
    sentAt: new Date().toISOString(),
    messageId: typeof messageId === "string" ? messageId : "",
    error: "",
  }
  write(data)
  return true
}

exports.markScheduledEmailFailed = async (id, errorMessage) => {
  const data = read()
  const idx = (data.scheduledEmails || []).findIndex((e) => e.id === id)
  if (idx === -1) return false
  data.scheduledEmails[idx] = {
    ...data.scheduledEmails[idx],
    status: "failed",
    error: typeof errorMessage === "string" ? errorMessage : "Send failed",
  }
  write(data)
  return true
}

exports.getProfile = async () => {
  const data = read()
  const p = data.profile || {}
  return {
    profile: {
      name: typeof p.name === "string" ? p.name : "",
      careerGoals: typeof p.careerGoals === "string" ? p.careerGoals : "",
      lastResumeUpdate: typeof p.lastResumeUpdate === "string" ? p.lastResumeUpdate : "",
      hideGettingStarted: Boolean(p.hideGettingStarted),
    },
  }
}

exports.patchProfile = async (_userId, body) => {
  const data = read()
  if (!data.profile) data.profile = { name: "", careerGoals: "", lastResumeUpdate: "", hideGettingStarted: false }
  if (body.name !== undefined) {
    data.profile.name = typeof body.name === "string" ? body.name.trim() : ""
  }
  if (body.careerGoals !== undefined) {
    data.profile.careerGoals = typeof body.careerGoals === "string" ? body.careerGoals : ""
  }
  if (body.lastResumeUpdate !== undefined) {
    data.profile.lastResumeUpdate =
      typeof body.lastResumeUpdate === "string" ? body.lastResumeUpdate : ""
  }
  if (body.hideGettingStarted !== undefined) {
    data.profile.hideGettingStarted = Boolean(body.hideGettingStarted)
  }
  write(data)
  return { profile: data.profile }
}

exports.getResumeUpdates = async () => {
  const data = read()
  const list = Array.isArray(data.resumeUpdates) ? [...data.resumeUpdates] : []
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  return { updates: list }
}

exports.createResumeUpdate = async (_userId, body) => {
  const { title, details, effectiveDate } = body || {}
  const bodyText = typeof details === "string" ? details : ""
  const data = read()
  const effective =
    typeof effectiveDate === "string" && effectiveDate.trim()
      ? effectiveDate.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  const update = {
    id: Date.now(),
    title: title.trim(),
    details: bodyText,
    effectiveDate: effective,
    createdAt: new Date().toISOString(),
  }
  if (!Array.isArray(data.resumeUpdates)) data.resumeUpdates = []
  data.resumeUpdates.unshift(update)
  if (!data.profile) data.profile = { name: "", careerGoals: "", lastResumeUpdate: "" }
  const prev = data.profile.lastResumeUpdate || ""
  if (!prev || effective > prev) {
    data.profile.lastResumeUpdate = effective
  }
  write(data)
  return { update }
}

exports.getFullResume = async () => {
  const data = read()
  const bucket = (data.resumeBuckets || []).find((b) => typeof b.text === "string" && b.text.trim())
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
  return { resume: data.fullResume || null }
}

exports.getResumeBuckets = async () => {
  const data = read()
  return { buckets: data.resumeBuckets || [] }
}

exports.createResumeBucket = async (_userId, body) => {
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  if (!name) throw new Error("name")
  const data = read()
  if (!Array.isArray(data.resumeBuckets)) data.resumeBuckets = []
  if (data.resumeBuckets.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("duplicate")
  }
  const bucket = {
    id: Date.now(),
    name,
    text: "",
    fileName: "",
    uploadedAt: "",
    createdAt: new Date().toISOString(),
    versions: [],
  }
  data.resumeBuckets.push(bucket)
  write(data)
  return { bucket }
}

exports.patchResumeBucket = async (_userId, id, body) => {
  const data = read()
  const bucket = findResumeBucket(data, id)
  if (!bucket) return null
  if (typeof body?.name === "string" && body.name.trim()) {
    const nextName = body.name.trim()
    if (
      (data.resumeBuckets || []).some((b) => b.id !== bucket.id && b.name.toLowerCase() === nextName.toLowerCase())
    ) {
      throw new Error("duplicate")
    }
    bucket.name = nextName
  }
  write(data)
  return { bucket }
}

exports.deleteResumeBucket = async (_userId, id) => {
  const data = read()
  const bid = Number(id)
  const before = (data.resumeBuckets || []).length
  data.resumeBuckets = (data.resumeBuckets || []).filter((b) => b.id !== bid)
  if (data.resumeBuckets.length === before) return false
  data.contacts = (data.contacts || []).map((c) =>
    c.resumeBucketId === bid ? { ...c, resumeBucketId: null } : c
  )
  write(data)
  return true
}

exports.saveBucketResume = async (_userId, bucketId, body) => {
  const { text, fileName } = body || {}
  if (typeof text !== "string" || !text.trim()) throw new Error("empty")
  const data = read()
  const bucket = findResumeBucket(data, bucketId)
  if (!bucket) return null
  archiveCurrentBucketResume(bucket)
  bucket.text = text.trim()
  bucket.fileName = typeof fileName === "string" ? fileName.trim() : ""
  bucket.uploadedAt = new Date().toISOString()
  write(data)
  return { bucket }
}

exports.deleteBucketResume = async (_userId, bucketId) => {
  const data = read()
  const bucket = findResumeBucket(data, bucketId)
  if (!bucket || !bucket.text) return null
  archiveCurrentBucketResume(bucket)
  bucket.text = ""
  bucket.fileName = ""
  bucket.uploadedAt = ""
  write(data)
  return { bucket }
}

exports.restoreResumeVersion = async (_userId, bucketId, versionId) => {
  const data = read()
  const bucket = findResumeBucket(data, bucketId)
  if (!bucket) return null
  const version = findResumeVersion(bucket, versionId)
  if (!version) return null
  ensureBucketVersions(bucket)
  bucket.versions = bucket.versions.filter((v) => v.id !== version.id)
  archiveCurrentBucketResume(bucket)
  bucket.text = version.text
  bucket.fileName = version.fileName || ""
  bucket.uploadedAt = version.uploadedAt || new Date().toISOString()
  write(data)
  return { bucket }
}

exports.deleteResumeVersion = async (_userId, bucketId, versionId) => {
  const data = read()
  const bucket = findResumeBucket(data, bucketId)
  if (!bucket) return null
  const version = findResumeVersion(bucket, versionId)
  if (!version) return null
  ensureBucketVersions(bucket)
  bucket.versions = bucket.versions.filter((v) => v.id !== version.id)
  write(data)
  return { bucket }
}

exports.saveFullResume = async (_userId, body) => {
  const { text, fileName, bucketId } = body || {}
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("empty")
  }
  const data = read()
  if (!Array.isArray(data.resumeBuckets)) data.resumeBuckets = []
  if (bucketId != null) {
    const bucket = findResumeBucket(data, bucketId)
    if (!bucket) throw new Error("bucket")
    archiveCurrentBucketResume(bucket)
    bucket.text = text.trim()
    bucket.fileName = typeof fileName === "string" ? fileName.trim() : ""
    bucket.uploadedAt = new Date().toISOString()
    write(data)
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
  if (data.resumeBuckets.length === 0) {
    data.resumeBuckets.push({
      id: Date.now(),
      name: "General",
      text: text.trim(),
      fileName: typeof fileName === "string" ? fileName.trim() : "",
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      versions: [],
    })
  } else {
    const bucket = data.resumeBuckets[0]
    archiveCurrentBucketResume(bucket)
    bucket.text = text.trim()
    bucket.fileName = typeof fileName === "string" ? fileName.trim() : ""
    bucket.uploadedAt = new Date().toISOString()
  }
  const bucket = data.resumeBuckets[0]
  write(data)
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

exports.deleteFullResume = async (_userId, body) => {
  const data = read()
  if (body?.bucketId != null) {
    const bucket = findResumeBucket(data, body.bucketId)
    if (!bucket || !bucket.text) return false
    archiveCurrentBucketResume(bucket)
    bucket.text = ""
    bucket.fileName = ""
    bucket.uploadedAt = ""
    write(data)
    return true
  }
  if (!data.fullResume) {
    const first = (data.resumeBuckets || []).find((b) => b.text)
    if (!first) return false
    archiveCurrentBucketResume(first)
    first.text = ""
    first.fileName = ""
    first.uploadedAt = ""
    write(data)
    return true
  }
  data.fullResume = null
  write(data)
  return true
}

exports.deleteResumeUpdate = async (_userId, id) => {
  const data = read()
  if (!Array.isArray(data.resumeUpdates)) data.resumeUpdates = []
  const before = data.resumeUpdates.length
  data.resumeUpdates = data.resumeUpdates.filter((u) => u.id !== id)
  if (data.resumeUpdates.length === before) return false
  write(data)
  return true
}

exports.getOutreachLogs = async (_userId, contactId) => {
  const data = read()
  let logs = Array.isArray(data.outreachLogs) ? [...data.outreachLogs] : []
  if (contactId !== undefined && contactId !== null && contactId !== "") {
    const cid = Number(contactId)
    if (Number.isFinite(cid)) logs = logs.filter((l) => l.contactId === cid)
  }
  logs.sort((a, b) => new Date(b.contactedAt) - new Date(a.contactedAt))
  return { logs }
}

exports.createOutreachLog = async (_userId, body) => {
  const { contactId, contactedAt, channel, note } = body || {}
  const cid = Number(contactId)
  if (!Number.isFinite(cid)) throw new Error("contactId")
  const when = typeof contactedAt === "string" && contactedAt.trim() ? contactedAt.trim() : ""
  if (!when) throw new Error("contactedAt")
  const data = read()
  const exists = data.contacts.some((c) => c.id === cid)
  if (!exists) return null
  if (!Array.isArray(data.outreachLogs)) data.outreachLogs = []
  const log = {
    id: Date.now(),
    contactId: cid,
    contactedAt: when,
    channel: typeof channel === "string" ? channel : "",
    note: typeof note === "string" ? note : "",
  }
  data.outreachLogs.push(log)
  const cidx = data.contacts.findIndex((c) => c.id === cid)
  if (cidx !== -1) {
    const prev = data.contacts[cidx].lastContacted || ""
    const prevT = prev ? new Date(prev).getTime() : 0
    const newT = new Date(when).getTime()
    if (!Number.isNaN(newT) && newT >= prevT) {
      data.contacts[cidx] = { ...data.contacts[cidx], lastContacted: when }
    }
  }
  write(data)
  return { log }
}

exports.deleteOutreachLog = async (_userId, id) => {
  const data = read()
  if (!Array.isArray(data.outreachLogs)) data.outreachLogs = []
  const before = data.outreachLogs.length
  data.outreachLogs = data.outreachLogs.filter((l) => l.id !== id)
  if (data.outreachLogs.length === before) return false
  write(data)
  return true
}

exports.numId = (param) => {
  const id = Number(param)
  return Number.isFinite(id) ? id : null
}
