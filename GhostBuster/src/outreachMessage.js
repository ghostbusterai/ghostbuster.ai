/** Shared helpers for résumé-update outreach drafts (Compose + inline modal). */

export function contactInfoLine(contact) {
  if (!contact) return null
  return [
    `Name: ${contact.name}`,
    `Company: ${contact.company || "unknown"}`,
    `Role: ${contact.role || "unknown"}`,
    `LinkedIn: ${contact.linkedin || "none"}`,
    `Website: ${contact.website || "none"}`,
    `Notes: ${contact.notes || "none"}`,
  ].join(", ")
}

export function buildResumeUpdateComposePayload(contact, update, reasons) {
  const reasonText = Array.isArray(reasons) ? reasons.join(" ") : ""
  return {
    contactId: contact?.id ?? contact?.contactId,
    situation: "Sharing a resume update",
    tone: "Warm & professional (balanced)",
    purpose:
      "Briefly summarize this career/résumé update, explain why I'm reaching out to them specifically, and suggest a light next step (feedback, staying in touch, or sharing the update) without pressure.",
    extraContext: [
      `Update title: "${update.title}" (effective ${update.effectiveDate || "recently"}).`,
      `Update details:\n${update.details || ""}`,
      reasonText ? `Why this contact is a fit: ${reasonText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  }
}

export function generateTemplateOutreachMessage(contact, update, reasons, senderName = "") {
  const name = contact?.name || "there"
  const firstName = name.split(/\s+/)[0] || name
  const company = contact?.company?.trim()
  const title = update?.title?.trim() || "a career update"
  const detailLine =
    String(update?.details || "")
      .trim()
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)[0] || ""
  const detailSnippet = detailLine.length > 220 ? `${detailLine.slice(0, 217)}…` : detailLine
  const reason =
    Array.isArray(reasons) && reasons.length > 0
      ? reasons[0]
      : "This update seems relevant to what they're working on."
  const signOff = senderName?.trim() || "[Your name]"

  const bodyParts = [
    `Hi ${firstName},`,
    "",
    `I wanted to share a quick update: ${title}.`,
  ]
  if (detailSnippet) bodyParts.push("", detailSnippet.endsWith(".") ? detailSnippet : `${detailSnippet}.`)
  bodyParts.push(
    "",
    `${reason}${company ? ` Given your work at ${company}, I thought this might be especially relevant.` : " I thought you might find this relevant."}`,
    "",
    "Happy to share more detail if helpful — would love to stay in touch.",
    "",
    "Best,",
    signOff
  )

  return `Subject: Quick update — ${title}\n\n${bodyParts.join("\n")}`
}

export async function generateResumeUpdateOutreachMessage({
  contact,
  update,
  reasons,
  senderName,
  composeFn,
}) {
  const payload = buildResumeUpdateComposePayload(contact, update, reasons)
  try {
    const data = await composeFn({
      contactInfo: contactInfoLine(contact),
      situation: payload.situation,
      tone: payload.tone,
      purpose: payload.purpose,
      extraContext: payload.extraContext,
    })
    if (data?.result?.trim()) {
      return { message: data.result.trim(), source: "ai" }
    }
  } catch {
    /* fall through to template */
  }
  return {
    message: generateTemplateOutreachMessage(contact, update, reasons, senderName),
    source: "template",
  }
}
