const { getSupabase } = require("./supabaseAdmin")
const { suggestContactsForUpdate } = require("./relevance")

function numId(v) {
  const n = typeof v === "string" ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

function toContact(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    company: row.company ?? "",
    role: row.role ?? "",
    notes: row.notes ?? "",
    lastContacted: row.last_contacted ?? "",
    linkedin: row.linkedin ?? "",
    website: row.website ?? "",
  }
}

function toReminder(row) {
  return {
    id: Number(row.id),
    contactName: row.contact_name,
    reason: row.reason ?? "",
    dueDate: row.due_date ?? "",
    done: Boolean(row.done),
    customReason: row.custom_reason ?? "",
  }
}

function toLog(row) {
  return {
    id: Number(row.id),
    contactId: Number(row.contact_id),
    contactedAt: row.contacted_at,
    channel: row.channel ?? "",
    note: row.note ?? "",
  }
}

function toUpdate(row) {
  return {
    id: Number(row.id),
    title: row.title,
    details: row.details ?? "",
    effectiveDate: row.effective_date ?? "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
  }
}

exports.getContacts = async (userId) => {
  const { data, error } = await getSupabase()
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: true })
  if (error) throw error
  return { contacts: (data || []).map(toContact) }
}

exports.createContact = async (userId, body) => {
  const { name, email, phone, company, role, notes, lastContacted, linkedin, website } = body || {}
  const id = Date.now()
  const row = {
    id,
    user_id: userId,
    name: name.trim(),
    email: email ?? "",
    phone: phone ?? "",
    company: company ?? "",
    role: role ?? "",
    notes: notes ?? "",
    last_contacted: lastContacted ?? "",
    linkedin: linkedin ?? "",
    website: website ?? "",
  }
  const { data, error } = await getSupabase().from("contacts").insert(row).select("*").single()
  if (error) throw error
  return { contact: toContact(data) }
}

exports.updateContact = async (userId, id, body) => {
  const patch = {}
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.email !== undefined) patch.email = body.email
  if (body.phone !== undefined) patch.phone = body.phone
  if (body.company !== undefined) patch.company = body.company
  if (body.role !== undefined) patch.role = body.role
  if (body.notes !== undefined) patch.notes = body.notes
  if (body.lastContacted !== undefined) patch.last_contacted = body.lastContacted
  if (body.linkedin !== undefined) patch.linkedin = body.linkedin
  if (body.website !== undefined) patch.website = body.website

  const { data, error } = await getSupabase()
    .from("contacts")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { contact: toContact(data) }
}

exports.deleteContact = async (userId, id) => {
  await getSupabase().from("outreach_logs").delete().eq("user_id", userId).eq("contact_id", id)
  const { data, error } = await getSupabase()
    .from("contacts")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}

exports.getReminders = async (userId) => {
  const { data, error } = await getSupabase().from("reminders").select("*").eq("user_id", userId)
  if (error) throw error
  return { reminders: (data || []).map(toReminder) }
}

exports.createReminder = async (userId, body) => {
  const { contactName, reason, dueDate, done, customReason } = body || {}
  const id = Date.now()
  const row = {
    id,
    user_id: userId,
    contact_name: contactName.trim(),
    reason: reason ?? "",
    due_date: dueDate ?? "",
    done: Boolean(done),
    custom_reason: customReason ?? "",
  }
  const { data, error } = await getSupabase().from("reminders").insert(row).select("*").single()
  if (error) throw error
  return { reminder: toReminder(data) }
}

exports.patchReminder = async (userId, id, body) => {
  const patch = {}
  if (body.contactName !== undefined) patch.contact_name = String(body.contactName).trim()
  if (body.reason !== undefined) patch.reason = body.reason
  if (body.dueDate !== undefined) patch.due_date = body.dueDate
  if (body.done !== undefined) patch.done = Boolean(body.done)
  if (body.customReason !== undefined) patch.custom_reason = body.customReason

  const { data, error } = await getSupabase()
    .from("reminders")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { reminder: toReminder(data) }
}

exports.deleteReminder = async (userId, id) => {
  const { data, error } = await getSupabase()
    .from("reminders")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}

exports.getProfile = async (userId) => {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("last_resume_update")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  const last = data?.last_resume_update ?? ""
  return { profile: { lastResumeUpdate: last } }
}

exports.patchProfile = async (userId, body) => {
  const last =
    body.lastResumeUpdate !== undefined
      ? typeof body.lastResumeUpdate === "string"
        ? body.lastResumeUpdate
        : ""
      : undefined
  if (last === undefined) return exports.getProfile(userId)
  const { data, error } = await getSupabase()
    .from("profiles")
    .update({ last_resume_update: last, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("last_resume_update")
    .single()
  if (error) throw error
  return { profile: { lastResumeUpdate: data?.last_resume_update ?? "" } }
}

exports.getResumeUpdates = async (userId) => {
  const { data, error } = await getSupabase()
    .from("resume_updates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return { updates: (data || []).map(toUpdate) }
}

exports.createResumeUpdate = async (userId, body) => {
  const { title, details, effectiveDate } = body || {}
  const bodyText = typeof details === "string" ? details : ""
  const effective =
    typeof effectiveDate === "string" && effectiveDate.trim()
      ? effectiveDate.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  const id = Date.now()
  const row = {
    id,
    user_id: userId,
    title: title.trim(),
    details: bodyText,
    effective_date: effective,
    created_at: new Date().toISOString(),
  }
  const { contacts } = await exports.getContacts(userId)
  const haystack = `${title.trim()}\n${bodyText}`
  const relevance = suggestContactsForUpdate(contacts, haystack)

  const { data, error } = await getSupabase().from("resume_updates").insert(row).select("*").single()
  if (error) throw error

  const prof = await exports.getProfile(userId)
  const prev = prof.profile.lastResumeUpdate || ""
  if (!prev || effective > prev) {
    await getSupabase()
      .from("profiles")
      .update({ last_resume_update: effective, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
  }

  return { update: toUpdate(data), relevance }
}

exports.deleteResumeUpdate = async (userId, id) => {
  const { data, error } = await getSupabase()
    .from("resume_updates")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}

exports.getOutreachLogs = async (userId, contactId) => {
  let q = getSupabase().from("outreach_logs").select("*").eq("user_id", userId)
  const cid = numId(contactId)
  if (cid != null) q = q.eq("contact_id", cid)
  const { data, error } = await q.order("contacted_at", { ascending: false })
  if (error) throw error
  return { logs: (data || []).map(toLog) }
}

exports.createOutreachLog = async (userId, body) => {
  const { contactId, contactedAt, channel, note } = body || {}
  const cid = numId(contactId)
  if (cid == null) throw new Error("contactId")
  const when = typeof contactedAt === "string" && contactedAt.trim() ? contactedAt.trim() : ""
  if (!when) throw new Error("contactedAt")

  const { contacts } = await exports.getContacts(userId)
  const exists = contacts.some((c) => c.id === cid)
  if (!exists) return null

  const id = Date.now()
  const row = {
    id,
    user_id: userId,
    contact_id: cid,
    contacted_at: when,
    channel: typeof channel === "string" ? channel : "",
    note: typeof note === "string" ? note : "",
  }
  const { data, error } = await getSupabase().from("outreach_logs").insert(row).select("*").single()
  if (error) throw error

  const cidx = contacts.findIndex((c) => c.id === cid)
  if (cidx !== -1) {
    const prev = contacts[cidx].lastContacted || ""
    const prevT = prev ? new Date(prev).getTime() : 0
    const newT = new Date(when).getTime()
    if (!Number.isNaN(newT) && newT >= prevT) {
      await getSupabase()
        .from("contacts")
        .update({ last_contacted: when })
        .eq("user_id", userId)
        .eq("id", cid)
    }
  }

  return { log: toLog(data) }
}

exports.deleteOutreachLog = async (userId, id) => {
  const { data, error } = await getSupabase()
    .from("outreach_logs")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}

exports.numId = numId
