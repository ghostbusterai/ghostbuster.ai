/** Contacts who haven't heard from you since your last résumé update. */

function parseDay(iso) {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function lastTouchMs(contactId, contact, logs) {
  let max = 0
  for (const l of logs) {
    if (l.contactId !== contactId) continue
    const t = parseDay(l.contactedAt)
    if (t > max) max = t
  }
  if (contact?.lastContacted) {
    const t = parseDay(contact.lastContacted)
    if (t > max) max = t
  }
  return max
}

export function needsResumeNudge(contactId, contact, logs, lastResumeUpdate) {
  if (!lastResumeUpdate) return false
  const resumeMs = parseDay(lastResumeUpdate)
  if (!resumeMs) return false
  const lastMs = lastTouchMs(contactId, contact, logs)
  return lastMs < resumeMs
}

export function contactsNeedingResumeNudge(contacts, logs, lastResumeUpdate) {
  if (!lastResumeUpdate) return []
  return (contacts || []).filter((c) => needsResumeNudge(c.id, c, logs || [], lastResumeUpdate))
}

export function buildResumeShareComposePrefill(contact, lastResumeUpdate) {
  const resumeLine = lastResumeUpdate
    ? `I last updated my résumé on ${lastResumeUpdate}.`
    : "I recently refreshed my résumé."
  return {
    contactId: contact.id,
    situation: "Sharing a resume update",
    tone: "Warm & professional (balanced)",
    purpose:
      "Briefly let them know my résumé is updated, offer to share it if helpful, and invite a light next step (feedback, referrals, or staying in touch) without pressure.",
    extraContext: `${resumeLine} This contact: ${contact.name}${contact.company ? ` at ${contact.company}` : ""}.`,
  }
}
