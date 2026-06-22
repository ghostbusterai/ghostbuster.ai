/** Date-only helpers for reminders (no auto-complete on due date). */

export function parseDueDay(value) {
  if (!value) return null
  const s = String(value).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function todayDay() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Pending reminder due status — never implies done; user must check off manually. */
export function getReminderDueStatus(reminder) {
  if (!reminder || reminder.done) {
    return { overdue: false, dueToday: false, upcoming: false }
  }
  const due = parseDueDay(reminder.dueDate)
  if (!due) return { overdue: false, dueToday: false, upcoming: true }

  const today = todayDay()
  const dueMs = due.getTime()
  const todayMs = today.getTime()

  if (dueMs < todayMs) return { overdue: true, dueToday: false, upcoming: false }
  if (dueMs === todayMs) return { overdue: false, dueToday: true, upcoming: false }
  return { overdue: false, dueToday: false, upcoming: true }
}

export function isReminderOverdue(reminder) {
  return getReminderDueStatus(reminder).overdue
}

export function sortRemindersForDisplay(list) {
  return [...list].sort((a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1
    const sa = getReminderDueStatus(a)
    const sb = getReminderDueStatus(b)
    if (sa.overdue !== sb.overdue) return sa.overdue ? -1 : 1
    if (sa.dueToday !== sb.dueToday) return sa.dueToday ? -1 : 1
    const da = parseDueDay(a.dueDate)?.getTime() ?? Infinity
    const db = parseDueDay(b.dueDate)?.getTime() ?? Infinity
    if (da !== db) return da - db
    return String(a.contactName || "").localeCompare(String(b.contactName || ""))
  })
}
