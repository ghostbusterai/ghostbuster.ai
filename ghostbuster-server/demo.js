/**
 * Demo access for reviewers (e.g. accelerators) who aren't on the Google OAuth beta-tester list.
 *
 * Enabled only when DEMO_ACCESS_CODE is set. Each demo login gets its own sandbox account seeded with
 * sample data; demo accounts can't connect Google, have a capped number of AI requests, and are
 * deleted after DEMO_TTL_DAYS.
 */
const crypto = require("crypto")

const DEMO_TTL_DAYS = Number(process.env.DEMO_TTL_DAYS) || 7
const DEMO_AI_LIMIT = Number(process.env.DEMO_AI_LIMIT) || 15

function demoEnabled() {
  return Boolean(String(process.env.DEMO_ACCESS_CODE || "").trim())
}

function checkDemoCode(code) {
  const expected = String(process.env.DEMO_ACCESS_CODE || "").trim()
  if (!expected || typeof code !== "string") return false
  const a = crypto.createHash("sha256").update(code.trim()).digest()
  const b = crypto.createHash("sha256").update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

function daysFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const SAMPLE_RESUME = `Alex Rivera
alex.rivera@example.com · Boston, MA · linkedin.com/in/alexrivera-demo

EDUCATION
Northeastern University — B.S. Computer Science, expected May 2027 · GPA 3.7

EXPERIENCE
Software Engineering Co-op, Brightpath Health (Jan–Jun 2026)
- Built a React dashboard for clinic scheduling used by 40+ staff
- Cut appointment API latency 35% by adding caching in Node.js

Teaching Assistant, Fundamentals of Computer Science (Sep–Dec 2025)
- Led weekly labs for 30 students; wrote autograder tests in Python

PROJECTS
Campus Rideshare — React Native app matching students for airport trips (1,200 users)

SKILLS
JavaScript, TypeScript, React, Node.js, Python, SQL, AWS`

/** Fill a new demo account with realistic sample data so every page has something to show. */
async function seedDemoAccount(store, uid) {
  await store.patchProfile(uid, {
    name: "Alex Rivera",
    careerGoals: "Software engineering internship for summer 2027, ideally in health tech or developer tools.",
    autofill: {
      firstName: "Alex",
      lastName: "Rivera",
      email: "alex.rivera@example.com",
      phone: "555-010-2468",
      city: "Boston",
      state: "MA",
      country: "United States",
      linkedin: "https://linkedin.com/in/alexrivera-demo",
      school: "Northeastern University",
      degree: "Bachelor of Science",
      major: "Computer Science",
      graduationDate: "May 2027",
      gpa: "3.7",
      workAuthorized: "Yes",
      needsSponsorship: "No",
    },
  })

  await store.saveFullResume(uid, { text: SAMPLE_RESUME, fileName: "Alex-Rivera-Resume.pdf" })

  const contacts = [
    {
      name: "Priya Shah",
      email: "priya.shah@example.com",
      company: "Stripe",
      role: "Software Engineer",
      notes: "Met at the Northeastern career fair. Offered to refer me for the internship.",
      lastContacted: daysFromToday(-12),
    },
    {
      name: "Marcus Lee",
      email: "marcus.lee@example.com",
      company: "Ramp",
      role: "Engineering Manager",
      notes: "Alumni coffee chat. Said to reach out when applications open.",
      lastContacted: daysFromToday(-30),
    },
    {
      name: "Dana Okafor",
      email: "dana.okafor@example.com",
      company: "Datadog",
      role: "University Recruiter",
      notes: "Recruiter for the summer intern program.",
      lastContacted: "",
    },
  ]
  for (const c of contacts) await store.createContact(uid, c)

  await store.createReminder(uid, {
    contactName: "Priya Shah",
    reason: "Follow up about the referral",
    customReason: "Follow up about the referral",
    dueDate: daysFromToday(2),
  })
  await store.createReminder(uid, {
    contactName: "Marcus Lee",
    reason: "Check in now that applications are open",
    customReason: "Check in now that applications are open",
    dueDate: daysFromToday(5),
  })

  const applications = [
    { company: "Stripe", role: "Software Engineering Intern", url: "https://stripe.com/jobs/search?query=intern", status: "todo" },
    { company: "Ramp", role: "Software Engineer Intern", url: "https://jobs.ashbyhq.com/ramp", status: "todo" },
    { company: "Datadog", role: "Software Engineering Intern", url: "https://careers.datadoghq.com/", status: "completed" },
  ]
  for (const a of applications) await store.createApplication(uid, { ...a, source: "manual" })
}

module.exports = { demoEnabled, checkDemoCode, seedDemoAccount, DEMO_TTL_DAYS, DEMO_AI_LIMIT }
