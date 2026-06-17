const { read, write } = require("./store")

/** Single-tenant JSON file store (no user id). */

exports.getContacts = async () => {
  const data = read()
  return { contacts: data.contacts || [] }
}

exports.createContact = async (_userId, body) => {
  const { name, email, phone, company, role, notes, lastContacted, linkedin, website } = body || {}
  const data = read()
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

exports.getProfile = async () => {
  const data = read()
  const p = data.profile || {}
  return {
    profile: {
      name: typeof p.name === "string" ? p.name : "",
      careerGoals: typeof p.careerGoals === "string" ? p.careerGoals : "",
      lastResumeUpdate: typeof p.lastResumeUpdate === "string" ? p.lastResumeUpdate : "",
    },
  }
}

exports.patchProfile = async (_userId, body) => {
  const data = read()
  if (!data.profile) data.profile = { name: "", careerGoals: "", lastResumeUpdate: "" }
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
  const { suggestContactsForUpdate } = require("./relevance")
  const { title, details, effectiveDate } = body || {}
  const bodyText = typeof details === "string" ? details : ""
  const data = read()
  const haystack = `${title.trim()}\n${bodyText}`
  const relevance = suggestContactsForUpdate(data.contacts || [], haystack)
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
  return { update, relevance }
}

exports.getFullResume = async () => {
  const data = read()
  return { resume: data.fullResume || null }
}

exports.saveFullResume = async (_userId, body) => {
  const { text, fileName } = body || {}
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("empty")
  }
  const data = read()
  data.fullResume = {
    text: text.trim(),
    fileName: typeof fileName === "string" ? fileName.trim() : "",
    uploadedAt: new Date().toISOString(),
  }
  write(data)
  return { resume: data.fullResume }
}

exports.deleteFullResume = async () => {
  const data = read()
  if (!data.fullResume) return false
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
