/**
 * Home / login success reel — journey templates only (no member names or photos).
 * Replace with verified stories in this file when members opt in.
 */
export const NETWORKING_REEL_SECTION_TITLE = "From networking to offers"
export const NETWORKING_REEL_SECTION_HINT =
  "Sample flows below. Real member stories can replace these anytime."
export const NETWORKING_REEL_ARIA_LABEL = "Example networking journeys"

export const NETWORKING_SUCCESS_STORIES = [
  {
    id: "pattern-fair",
    icon: "users",
    title: "Career fair follow-up",
    chapter: "Meet in person",
    detail: "Same-day log-in, a specific thank-you, and a reminder before the thread goes cold.",
    networking:
      "Log the recruiter the same day, send a specific thank-you, and set a reminder before the thread goes cold.",
    outcome: "Interview or offer",
    company: "Outcome varies by member",
    hue: "120, 255, 90",
  },
  {
    id: "pattern-referral",
    icon: "mail",
    title: "Warm introduction",
    chapter: "Referral path",
    detail: "Ask for a mutual intro and track every touch in Tracker.",
    networking: "Ask for a mutual intro instead of a cold apply—track each touch so nothing slips.",
    outcome: "Pipeline or offer",
    company: "Outcome varies by member",
    hue: "100, 220, 255",
  },
  {
    id: "pattern-coffee",
    icon: "phone",
    title: "Coffee chat rhythm",
    chapter: "Stay in touch",
    detail: "Short calls become steady check-ins—not only asks when you need something.",
    networking: "Turn a short call into steady check-ins—light updates, not only big asks.",
    outcome: "Internship or return offer",
    company: "Outcome varies by member",
    hue: "200, 255, 90",
  },
  {
    id: "pattern-mentor",
    icon: "map-pin",
    title: "Long-term mentorship",
    chapter: "Mentors & alumni",
    detail: "Logged outreach across semesters so mentors never slip off your radar.",
    networking: "Keep mentors from info sessions warm with logged outreach across semesters.",
    outcome: "Full-time or new role",
    company: "Outcome varies by member",
    hue: "255, 200, 120",
  },
]