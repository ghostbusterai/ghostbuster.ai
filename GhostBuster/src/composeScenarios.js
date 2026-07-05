/** Scenario config for Message Composer — examples, defaults, and offline templates. */

export const COMPOSE_SITUATIONS = [
  "Cold outreach — never met",
  "Follow up after career fair",
  "Follow up after coffee chat",
  "Reconnecting after a while",
  "Sharing a resume update",
  "Sharing a new update",
  "Asking for a referral",
  "Thanking after an interview",
  "Checking in on application status",
]

export const SCENARIO_CONFIG = {
  "Cold outreach — never met": {
    shortLabel: "Cold outreach",
    purposeExample:
      "Introduce myself briefly, explain why their work resonates with me, and ask for a 15–20 minute informational chat — no hard ask for a job.",
    extraContextExample:
      "Found them through a mutual connection / company blog / LinkedIn post about [topic]. I admire their path from X to Y.",
    template: ({ contact, yourBackground }) => {
      const first = contactFirstName(contact)
      const company = contact?.company?.trim()
      const role = contact?.role?.trim()
      const bg = yourBackground?.trim() || "I'm exploring roles in this space and learning from people who've built careers there."
      return `Subject: Quick intro — ${first !== "there" ? `${first}, ` : ""}admire your work${company ? ` at ${company}` : ""}

Hi ${first},

I'm ${bg.split(".")[0]}.${company || role ? ` I've been following ${company || "your team"}${role ? ` and your work as a ${role}` : ""} — your perspective on the industry really stood out.` : " Your background stood out as I research this field."}

Would you be open to a brief 15–20 minute chat in the next couple of weeks? I'd love to learn how you got started and any advice you'd share with someone early in their path.

No pressure at all — happy to work around your schedule.

Best,
[Your name]`
    },
  },
  "Follow up after career fair": {
    shortLabel: "After career fair",
    purposeExample:
      "Reference our conversation at the fair, restate my interest in their team, and ask about next steps or who to stay in touch with.",
    extraContextExample:
      "Met at [school] career fair on [date]. We talked about [topic/project]. They mentioned [internship program / team name / timeline].",
    template: ({ contact, yourBackground }) => {
      const first = contactFirstName(contact)
      const company = contact?.company?.trim() || "your company"
      return `Subject: Great meeting you at the career fair — ${first}

Hi ${first},

It was great speaking with you at the career fair${contact?.company ? ` about ${company}` : ""}. I especially appreciated hearing about [specific topic you discussed].

${yourBackground?.trim() ? `${yourBackground.trim().split(".")[0]}.\n\n` : ""}I'm still very interested in learning more about opportunities on your team. Could you point me to the best next step — or someone else I should connect with?

Thanks again for your time at the fair.

Best,
[Your name]`
    },
  },
  "Follow up after coffee chat": {
    shortLabel: "After coffee chat",
    purposeExample:
      "Thank them for the conversation, mention one takeaway I applied, and ask a focused follow-up question or propose a light next step.",
    extraContextExample:
      "Coffee chat on [date]. They suggested I [action]. I took their advice on [specific thing].",
    template: ({ contact }) => {
      const first = contactFirstName(contact)
      return `Subject: Thank you — and a quick follow-up

Hi ${first},

Thank you again for taking the time to chat. Your point about [specific advice] really stuck with me — I [what you did with it].

I had one follow-up question if you have a moment: [focused question related to your goals].

Really appreciate your generosity with your time.

Best,
[Your name]`
    },
  },
  "Reconnecting after a while": {
    shortLabel: "Reconnect",
    purposeExample:
      "Warmly reopen the relationship, share a brief personal update, and suggest catching up without being pushy.",
    extraContextExample:
      "Last spoke [timeframe] about [topic]. Saw their [LinkedIn post / news / promotion] recently.",
    template: ({ contact, yourBackground }) => {
      const first = contactFirstName(contact)
      return `Subject: Catching up — hope you're doing well

Hi ${first},

It's been a while since we last connected — hope things are going well${contact?.company ? ` at ${contact.company}` : ""}!

${yourBackground?.trim() ? `Quick update on my end: ${yourBackground.trim().split(".").slice(0, 2).join(".")}.\n\n` : ""}I'd love to hear what you've been working on lately. Would you be up for a quick catch-up call or coffee in the next few weeks?

Best,
[Your name]`
    },
  },
  "Sharing a resume update": {
    shortLabel: "Résumé update",
    purposeExample:
      "Share a concise career/résumé update, explain why it's relevant to them, and offer to send the updated résumé or chat briefly.",
    extraContextExample:
      "Recent changes: [new role, project, skill, or accomplishment]. Effective [date].",
    template: ({ contact, yourBackground }) => {
      const first = contactFirstName(contact)
      const company = contact?.company?.trim()
      return `Subject: Quick career update — thought of you

Hi ${first},

I wanted to share a brief update: [your headline update — e.g. new internship, shipped project, changed focus area].

${yourBackground?.trim() ? `${yourBackground.trim()}\n\n` : ""}${company ? `Given your work at ${company}, I thought this might be especially relevant.` : "I thought you might find this relevant given our past conversations."}

Happy to send my updated résumé or jump on a quick call if helpful — no pressure either way.

Best,
[Your name]`
    },
  },
  "Sharing a new update": {
    shortLabel: "Share new update",
    purposeExample:
      "Share a recent career or project update, explain why it might interest them, and invite light feedback or a quick catch-up.",
    extraContextExample:
      "Update: [new project, role change, milestone, or skill you're building]. They previously encouraged me to pursue [related area].",
    template: ({ contact }) => {
      const first = contactFirstName(contact)
      return `Subject: Quick update I wanted to share

Hi ${first},

I wanted to share a quick update: [your news in one sentence — project, role, milestone, or focus area].

You came to mind because [how they're relevant or how they supported you]. Thank you for [specific encouragement if any].

Happy to share more detail if helpful — would love to hear your thoughts when you have a moment.

Best,
[Your name]`
    },
  },
  "Asking for a referral": {
    shortLabel: "Referral ask",
    purposeExample:
      "Politely ask if they'd be comfortable referring me or pointing me to the right person, with clear context on the role and why I'm a fit.",
    extraContextExample:
      "Applying to [role/title] at [company]. Met/know them through [context]. Strong fit because [1–2 reasons].",
    template: ({ contact, yourBackground }) => {
      const first = contactFirstName(contact)
      const company = contact?.company?.trim() || "[Company]"
      return `Subject: Referral question — ${company} [Role title]

Hi ${first},

I hope you're doing well. I'm applying for the [Role title] position at ${company} and immediately thought of you given [how you know them / their team].

${yourBackground?.trim() ? `${yourBackground.trim()}\n\n` : ""}Would you be comfortable referring me, or pointing me to the best person to talk to about the role? I've attached / can send my résumé and happy to share a short blurb you could forward.

Totally understand if the timing isn't right — either way, thank you for considering.

Best,
[Your name]`
    },
  },
  "Thanking after an interview": {
    shortLabel: "Post-interview thanks",
    purposeExample:
      "Send a thoughtful thank-you, reference something specific from the conversation, and reaffirm my interest.",
    extraContextExample:
      "Interview on [date] for [role]. Discussed [specific topic]. Interviewer mentioned [timeline or next step].",
    template: ({ contact }) => {
      const first = contactFirstName(contact)
      const company = contact?.company?.trim() || "the team"
      return `Subject: Thank you — [Role] interview

Hi ${first},

Thank you for taking the time to speak with me about the [Role] opportunity at ${company}. I really enjoyed our conversation, especially [specific topic or moment from the interview].

Our discussion reinforced my excitement about [team/mission/project]. Please let me know if I can provide any additional information as you move forward.

Thanks again — hope to stay in touch.

Best,
[Your name]`
    },
  },
  "Checking in on application status": {
    shortLabel: "Application check-in",
    purposeExample:
      "Politely check on the status of my application, reference when I applied or last spoke, and restate brief interest without sounding impatient.",
    extraContextExample:
      "Applied on [date] for [role]. Last update from them: [if any]. Still very interested because [reason].",
    template: ({ contact }) => {
      const first = contactFirstName(contact)
      const company = contact?.company?.trim() || "your team"
      return `Subject: Following up — [Role] application

Hi ${first},

I hope you're doing well. I wanted to follow up on my application for the [Role] position at ${company}, which I submitted on [date].

I remain very interested in the opportunity — especially [specific aspect of role/team]. Could you share any update on timing or next steps when you have a chance?

Thank you again for your time and consideration.

Best,
[Your name]`
    },
  },
}

function contactFirstName(contact) {
  const name = contact?.name?.trim()
  if (!name) return "there"
  return name.split(/\s+/)[0] || name
}

export function getScenarioConfig(situation) {
  return SCENARIO_CONFIG[situation] || null
}

export function applyScenarioExamples(situation, { fillEmptyOnly = true } = {}) {
  const config = getScenarioConfig(situation)
  if (!config) return { purpose: "", extraContext: "" }
  return {
    purpose: config.purposeExample || "",
    extraContext: config.extraContextExample || "",
    fillEmptyOnly,
  }
}

export function generateScenarioTemplateMessage(situation, { contact, yourBackground, purpose, extraContext } = {}) {
  const config = getScenarioConfig(situation)
  if (!config?.template) {
    return `Subject: Networking note

Hi there,

I wanted to reach out regarding ${situation.toLowerCase()}.

${purpose || extraContext || "I'd love to connect when you have a moment."}

Best,
[Your name]`
  }
  return config.template({ contact, yourBackground, purpose, extraContext })
}
