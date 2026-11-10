/**
 * Fixed synthetic dataset for evaluating Ask GhostBuster. One fictional student's networking data,
 * plus questions with the record ids a correct answer must use.
 *
 * Question kinds:
 *   keyword    - the question shares words with the right records
 *   semantic   - paraphrases ("fintech", "money apps") that plain keyword search can miss
 *   multi      - needs several records combined
 *   abstain    - the answer isn't in the data; a correct answer says so and cites nothing
 */

const contacts = [
  { id: 1, name: "Priya Shah", company: "Stripe", role: "Software Engineer", school: "Northeastern", notes: "Met at the Northeastern career fair. Offered to refer me for the summer internship.", lastContacted: "2026-10-28" },
  { id: 2, name: "Marcus Lee", company: "Ramp", role: "Engineering Manager", notes: "Alumni coffee chat. Manages the corporate card team.", lastContacted: "2026-10-10" },
  { id: 3, name: "Dana Okafor", company: "Datadog", role: "University Recruiter", notes: "Recruiter for the summer intern program.", lastContacted: "" },
  { id: 4, name: "Wei Chen", company: "Plaid", role: "Product Manager", notes: "Builds bank account linking APIs. Met through Priya.", lastContacted: "2026-09-15" },
  { id: 5, name: "Sofia Alvarez", company: "Epic Games", role: "Gameplay Programmer", notes: "Works on Unreal Engine tooling. Loves talking about game jams.", lastContacted: "2026-08-02" },
  { id: 6, name: "Jordan Patel", company: "Moderna", role: "Data Scientist", notes: "Computational biology, mRNA vaccine research pipelines.", lastContacted: "2026-07-20" },
  { id: 7, name: "Hannah Kim", company: "Google", role: "Site Reliability Engineer", notes: "Talked about on-call rotations and Kubernetes at a hackathon.", lastContacted: "2026-10-30" },
  { id: 8, name: "Luis Romero", company: "Tesla", role: "Firmware Engineer", notes: "Embedded C for battery management systems.", lastContacted: "2026-06-11" },
  { id: 9, name: "Aisha Bello", company: "McKinsey", role: "Associate", notes: "Strategy consulting, healthcare practice. Case interview tips.", lastContacted: "2026-09-29" },
  { id: 10, name: "Tom Becker", company: "Duolingo", role: "iOS Engineer", notes: "Swift and SwiftUI. Language-learning app growth experiments.", lastContacted: "2026-05-04" },
  { id: 11, name: "Grace Liu", company: "Robinhood", role: "Backend Engineer", notes: "Trading systems, order matching, Go services.", lastContacted: "2026-10-05" },
  { id: 12, name: "Omar Haddad", company: "Lockheed Martin", role: "Systems Engineer", notes: "Satellite guidance software. Former intern manager.", lastContacted: "2026-04-18" },
  { id: 13, name: "Nina Volkova", company: "Anthropic", role: "Research Engineer", notes: "Interpretability research. Met at NeurIPS poster session.", lastContacted: "2026-10-20" },
  { id: 14, name: "Ben Carter", company: "Figma", role: "Designer", notes: "Design systems and prototyping. Gave portfolio feedback.", lastContacted: "2026-03-30" },
  { id: 15, name: "Rachel Green", company: "Northeastern", role: "Career Advisor", notes: "Helps with résumé reviews and co-op search.", lastContacted: "2026-10-01" },
]

const outreachLogs = [
  { id: 101, contactId: 1, contactedAt: "2026-10-28", channel: "email", note: "Sent résumé and asked about the referral timeline." },
  { id: 102, contactId: 2, contactedAt: "2026-10-10", channel: "coffee", note: "Coffee chat about Ramp new-grad hiring." },
  { id: 103, contactId: 7, contactedAt: "2026-10-30", channel: "linkedin", note: "Thanked her for the hackathon mentoring." },
  { id: 104, contactId: 11, contactedAt: "2026-10-05", channel: "email", note: "Asked about backend internship openings." },
  { id: 105, contactId: 13, contactedAt: "2026-10-20", channel: "email", note: "Followed up on her poster about interpretability." },
]

const reminders = [
  { id: 201, contactName: "Priya Shah", reason: "Follow up about the referral", dueDate: "2026-11-11", done: false },
  { id: 202, contactName: "Marcus Lee", reason: "Apply when the Ramp portal opens", dueDate: "2026-11-15", done: false },
  { id: 203, contactName: "Aisha Bello", reason: "Send case interview thank-you", dueDate: "2026-10-02", done: true },
]

const applications = [
  { id: 301, company: "Stripe", role: "Software Engineering Intern", status: "applied", appliedAt: "2026-10-29" },
  { id: 302, company: "Datadog", role: "Software Engineering Intern", status: "interviewing", appliedAt: "2026-09-20" },
  { id: 303, company: "Google", role: "STEP Intern", status: "rejected", appliedAt: "2026-09-01" },
  { id: 304, company: "Ramp", role: "Software Engineer Intern", status: "todo" },
]

const ghostIts = [
  {
    id: 401,
    title: "Coffee with Marcus",
    contactName: "Marcus Lee",
    startedAt: "2026-10-10",
    summary: {
      overview: "Discussed Ramp's infrastructure team, new-grad hiring, and how expense management products are built.",
      keyPoints: ["Ramp hires interns in the spring", "Team values ownership"],
      actionItems: ["Send thank-you note", "Apply when the portal opens in November"],
    },
    segments: [],
  },
  {
    id: 402,
    title: "Datadog recruiter screen",
    contactName: "Dana Okafor",
    startedAt: "2026-10-22",
    summary: {
      overview: "Phone screen. Next step is a technical interview focused on data structures; they want availability for early December.",
      actionItems: ["Send December availability", "Practice graph problems"],
    },
    segments: [],
  },
]

const buckets = [
  { id: 501, name: "Software Engineering", text: "Alex Rivera. Skills: Python, TypeScript, React, Node, PostgreSQL. Built GhostBuster, a networking CRM with Claude. Intern at Acme Robotics: wrote Python data pipelines." },
  { id: 502, name: "Product Management", text: "Alex Rivera. Led user interviews for GhostBuster beta. Ran A/B tests on onboarding. Wrote product specs." },
]

const store = {
  getContacts: async () => ({ contacts }),
  getOutreachLogs: async () => ({ logs: outreachLogs }),
  getReminders: async () => ({ reminders }),
  getApplications: async () => ({ applications }),
  getGhostIts: async () => ({ ghostIts }),
  getResumeBuckets: async () => ({ buckets }),
  getProfile: async () => ({ profile: { name: "Alex Rivera" } }),
}

/** expected: record ids a correct answer must draw on (any one counts for retrieval "hit"). */
const questions = [
  { q: "Who do I know at Stripe?", kind: "keyword", expected: ["contact-1"] },
  { q: "Who is the recruiter at Datadog?", kind: "keyword", expected: ["contact-3"] },
  { q: "What did Marcus and I talk about?", kind: "keyword", expected: ["note-401", "outreach-102"] },
  { q: "When is my referral follow-up with Priya due?", kind: "keyword", expected: ["reminder-201"] },
  { q: "What's the status of my Datadog application?", kind: "keyword", expected: ["application-302"] },
  { q: "What happened in the Datadog recruiter screen?", kind: "keyword", expected: ["note-402"] },
  { q: "Who did I meet at the hackathon?", kind: "keyword", expected: ["contact-7"] },
  { q: "Which contact works on satellite software?", kind: "keyword", expected: ["contact-12"] },
  { q: "Who gave me portfolio feedback?", kind: "keyword", expected: ["contact-14"] },
  { q: "What skills are on my software engineering résumé?", kind: "keyword", expected: ["resume-501-1"] },
  { q: "Who works in fintech?", kind: "semantic", expected: ["contact-1", "contact-2", "contact-4", "contact-11"] },
  { q: "Who could tell me about the video game industry?", kind: "semantic", expected: ["contact-5"] },
  { q: "Do I know anyone in biotech or pharma?", kind: "semantic", expected: ["contact-6"] },
  { q: "Who works on electric cars?", kind: "semantic", expected: ["contact-8"] },
  { q: "Who can help me prepare for consulting interviews?", kind: "semantic", expected: ["contact-9"] },
  { q: "Who builds mobile apps?", kind: "semantic", expected: ["contact-10"] },
  { q: "Who do I know doing AI safety research?", kind: "semantic", expected: ["contact-13"] },
  { q: "Who works in aerospace or defense?", kind: "semantic", expected: ["contact-12"] },
  { q: "Who can review my CV?", kind: "semantic", expected: ["contact-15"] },
  { q: "Who knows about stock trading platforms?", kind: "semantic", expected: ["contact-11"] },
  { q: "Which interviews do I need to prep for?", kind: "multi", expected: ["note-402", "application-302"] },
  { q: "Who should I follow up with this week?", kind: "multi", expected: ["reminder-201", "reminder-202"] },
  { q: "Which applications are still not submitted?", kind: "multi", expected: ["application-304"] },
  { q: "Who introduced me to Wei?", kind: "multi", expected: ["contact-4", "contact-1"] },
  { q: "What are my open action items from meetings?", kind: "multi", expected: ["note-401", "note-402"] },
  { q: "Who do I know at Netflix?", kind: "abstain", expected: [] },
  { q: "What did the Meta recruiter say?", kind: "abstain", expected: [] },
  { q: "When is my Amazon interview?", kind: "abstain", expected: [] },
  { q: "What is Priya's phone number?", kind: "abstain", expected: [] },
  { q: "Did I apply to Microsoft?", kind: "abstain", expected: [] },
]

module.exports = { store, questions }
