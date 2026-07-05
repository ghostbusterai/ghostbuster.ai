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
    const ua = urgencyRank(getReminderUrgency(a))
    const ub = urgencyRank(getReminderUrgency(b))
    if (ua !== ub) return ua - ub
    const da = parseDueDay(a.dueDate)?.getTime() ?? Infinity
    const db = parseDueDay(b.dueDate)?.getTime() ?? Infinity
    if (da !== db) return da - db
    return String(a.contactName || "").localeCompare(String(b.contactName || ""))
  })
}

export function daysUntilDue(reminder) {
  if (!reminder || reminder.done) return null
  const due = parseDueDay(reminder.dueDate)
  if (!due) return null
  const today = todayDay()
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export function daysOverdue(reminder) {
  const days = daysUntilDue(reminder)
  if (days === null) return 0
  return days < 0 ? Math.abs(days) : 0
}

/** critical | overdue | today | soon | upcoming | done */
export function getReminderUrgency(reminder) {
  if (!reminder || reminder.done) return "done"
  const status = getReminderDueStatus(reminder)
  if (status.overdue) {
    return daysOverdue(reminder) >= 7 ? "critical" : "overdue"
  }
  if (status.dueToday) return "today"
  const days = daysUntilDue(reminder)
  if (days !== null && days > 0 && days <= 3) return "soon"
  return "upcoming"
}

function urgencyRank(urgency) {
  const order = { critical: 0, overdue: 1, today: 2, soon: 3, upcoming: 4, done: 5 }
  return order[urgency] ?? 4
}

export function getReminderUrgencyStyle(urgency) {
  switch (urgency) {
    case "critical":
      return {
        label: "Critical",
        color: "var(--gb-danger)",
        bg: "rgba(255,107,107,0.16)",
        border: "rgba(255,107,107,0.7)",
        cardBg: "rgba(255,107,107,0.07)",
        shadow: "0 0 0 1px rgba(255,107,107,0.2), 0 8px 28px rgba(255,107,107,0.12)",
      }
    case "overdue":
      return {
        label: "Overdue",
        color: "#ff8787",
        bg: "rgba(255,107,107,0.12)",
        border: "rgba(255,107,107,0.5)",
        cardBg: "rgba(255,107,107,0.04)",
        shadow: "0 0 0 1px rgba(255,107,107,0.12), 0 6px 20px rgba(255,107,107,0.08)",
      }
    case "today":
      return {
        label: "Due today",
        color: "#ffc96b",
        bg: "rgba(255,201,107,0.14)",
        border: "rgba(255,201,107,0.55)",
        cardBg: "rgba(255,201,107,0.05)",
        shadow: "0 0 0 1px rgba(255,201,107,0.15)",
      }
    case "soon":
      return {
        label: "Due soon",
        color: "#ffb347",
        bg: "rgba(255,179,71,0.12)",
        border: "rgba(255,179,71,0.4)",
        cardBg: "rgba(255,179,71,0.04)",
        shadow: "none",
      }
    case "upcoming":
      return {
        label: "Upcoming",
        color: "#5be4d8",
        bg: "rgba(91,228,216,0.1)",
        border: "rgba(91,228,216,0.28)",
        cardBg: "var(--gb-bg-elevated)",
        shadow: "none",
      }
    default:
      return {
        label: "Done",
        color: "#9ca3af",
        bg: "rgba(156,163,175,0.1)",
        border: "var(--gb-surface-active)",
        cardBg: "var(--gb-bg-elevated)",
        shadow: "none",
      }
  }
}

export function summarizePendingReminders(reminders) {
  const pending = (reminders || []).filter((r) => !r.done)
  const summary = { pending: pending.length, critical: 0, overdue: 0, today: 0, soon: 0, upcoming: 0 }
  for (const r of pending) {
    const u = getReminderUrgency(r)
    if (summary[u] !== undefined) summary[u] += 1
  }
  summary.attention = summary.critical + summary.overdue + summary.today
  return summary
}

export function reminderDueLabel(reminder) {
  const urgency = getReminderUrgency(reminder)
  const due = parseDueDay(reminder?.dueDate)
  const formatted = due ? due.toLocaleDateString() : reminder?.dueDate || "No date"
  if (urgency === "critical") {
    const d = daysOverdue(reminder)
    return d > 0 ? `${d} day${d !== 1 ? "s" : ""} overdue · ${formatted}` : `Overdue · ${formatted}`
  }
  if (urgency === "overdue") return `Overdue · ${formatted}`
  if (urgency === "today") return `Due today · ${formatted}`
  if (urgency === "soon") {
    const d = daysUntilDue(reminder)
    return d != null ? `Due in ${d} day${d !== 1 ? "s" : ""} · ${formatted}` : formatted
  }
  return formatted
}
