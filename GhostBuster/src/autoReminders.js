/**
 * Client-side suggested reminders (warmth, résumé nudges). Merged with saved reminders in the feed.
 * Dismissals are stored locally; suggestions can reappear after a cooldown if the issue persists.
 */

import { needsResumeNudge } from "./resumeNudge"
import { formatDayIso, sortRemindersForDisplay } from "./reminderUtils"

export const LS_AUTO_REMINDER_DISMISSALS = "gb_auto_reminder_dismissals"

const DISMISS_COOLDOWN_DAYS = 21

/** Warmth thresholds — aligned with Dashboard / Tracker */
const WARM_DAYS = 21
const CHECK_IN_DAYS = 45

function parseTouchDay(iso) {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function daysSinceLastTouch(contact, outreachLogs) {
  let ms = contact?.lastContacted ? parseTouchDay(contact.lastContacted) : 0
  for (const log of outreachLogs || []) {
    if (log.contactId !== contact.id) continue
    const t = parseTouchDay(log.contactedAt)
    if (t > ms) ms = t
  }
  if (!ms) return Infinity
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
}

export function hasPendingReminderForContact(reminders, contactName) {
  const n = normalizeName(contactName)
  if (!n) return false
  return (reminders || []).some((r) => !r.done && normalizeName(r.contactName) === n)
}

export function readAutoReminderDismissals() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_AUTO_REMINDER_DISMISSALS) || "[]")
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function writeAutoReminderDismissals(entries) {
  try {
    localStorage.setItem(LS_AUTO_REMINDER_DISMISSALS, JSON.stringify(entries))
  } catch {
    /* ignore */
  }
}

export function dismissAutoSuggestion(suggestionKey) {
  const list = readAutoReminderDismissals().filter((e) => e.key !== suggestionKey)
  list.push({ key: suggestionKey, dismissedAt: new Date().toISOString() })
  writeAutoReminderDismissals(list)
}

export function isDismissedSuggestion(suggestionKey, dismissals) {
  const row = (dismissals || readAutoReminderDismissals()).find((e) => e.key === suggestionKey)
  if (!row?.dismissedAt) return false
  const dismissed = new Date(row.dismissedAt).getTime()
  if (Number.isNaN(dismissed)) return false
  const days = Math.floor((Date.now() - dismissed) / (24 * 60 * 60 * 1000))
  return days < DISMISS_COOLDOWN_DAYS
}

function addDaysFromToday(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return formatDayIso(d)
}

export function isAutoReminder(reminder) {
  return Boolean(reminder?.auto)
}

/**
 * @returns {Array<import('./reminderUtils').Reminder-like>}
 */
export function generateAutoReminders({
  contacts = [],
  outreachLogs = [],
  savedReminders = [],
  lastResumeUpdate = "",
  dismissals = readAutoReminderDismissals(),
} = {}) {
  const suggestions = []
  const seenKeys = new Set()

  for (const contact of contacts) {
    if (!contact?.name?.trim()) continue
    const name = contact.name.trim()
    if (hasPendingReminderForContact(savedReminders, name)) continue

    const days = daysSinceLastTouch(contact, outreachLogs)

    let warmthKey = null
    let reason = ""
    let dueDate = ""

    if (days === Infinity) {
      warmthKey = `warmth:first:${contact.id}`
      reason = "You saved this contact but haven't logged outreach yet — send a first follow-up."
      dueDate = addDaysFromToday(5)
    } else if (days > CHECK_IN_DAYS) {
      warmthKey = `warmth:overdue:${contact.id}`
      reason = `No touch in ${days} days — reconnect before this relationship goes cold.`
      dueDate = addDaysFromToday(0)
    } else if (days > WARM_DAYS) {
      warmthKey = `warmth:checkin:${contact.id}`
      reason = `Last touch was ${days} days ago — a quick check-in keeps you warm.`
      dueDate = addDaysFromToday(2)
    }

    if (warmthKey && !seenKeys.has(warmthKey) && !isDismissedSuggestion(warmthKey, dismissals)) {
      seenKeys.add(warmthKey)
      suggestions.push({
        id: `auto-${warmthKey}`,
        auto: true,
        suggestionKey: warmthKey,
        contactId: contact.id,
        contactName: name,
        reason,
        dueDate,
        done: false,
        customReason: "",
        googleEventId: "",
      })
    }

    const resumeKey = `resume:${contact.id}`
    if (
      lastResumeUpdate &&
      needsResumeNudge(contact.id, contact, outreachLogs, lastResumeUpdate) &&
      !seenKeys.has(resumeKey) &&
      !isDismissedSuggestion(resumeKey, dismissals) &&
      !hasPendingReminderForContact(savedReminders, name)
    ) {
      seenKeys.add(resumeKey)
      suggestions.push({
        id: `auto-${resumeKey}`,
        auto: true,
        suggestionKey: resumeKey,
        contactId: contact.id,
        contactName: name,
        reason: "You updated your résumé after your last message — consider sharing the refresh.",
        dueDate: addDaysFromToday(0),
        done: false,
        customReason: "",
        googleEventId: "",
      })
    }
  }

  return suggestions
}

/** Saved reminders plus live suggestions (does not dedupe by sort — caller should sort). */
export function mergeReminderFeed(savedReminders = [], autoReminders = []) {
  return [...(savedReminders || []), ...(autoReminders || [])]
}

export function buildSortedReminderFeed({
  savedReminders = [],
  contacts = [],
  outreachLogs = [],
  lastResumeUpdate = "",
  dismissals,
} = {}) {
  const auto = generateAutoReminders({
    contacts,
    outreachLogs,
    savedReminders,
    lastResumeUpdate,
    dismissals,
  })
  return sortRemindersForDisplay(mergeReminderFeed(savedReminders, auto))
}