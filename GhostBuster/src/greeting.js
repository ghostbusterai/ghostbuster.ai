import { useState, useEffect } from "react"

/** Positive, realistic Home welcome lines — encouraging networking nudges */
export const ANTI_GHOST_GREETINGS = [
  "A timely note keeps good connections growing.",
  "You already made the connection — now stay in touch.",
  "One thoughtful follow-up can start the next great conversation.",
  "Small check-ins keep your network warm.",
  "You're building relationships one message at a time.",
  "Today is a great day to reconnect with someone you met.",
  "Your network grows when you show up consistently.",
  "A short message can keep a good conversation going.",
  "Every follow-up makes the next one feel more natural.",
  "You have people worth staying in touch with.",
  "Logging outreach helps you see the relationships you're building.",
  "Compose is here when you want help finding the right words.",
  "Reminders turn good intentions into real connections.",
  "Staying in touch keeps opportunities flowing both ways.",
  "You met them for a reason — keep that momentum going.",
  "Warm relationships grow with a little regular care.",
  "One person, one message — that's a win for today.",
  "Your tracker helps you nurture the connections that matter.",
  "Consistency builds trust over time.",
  "Fresh conversations deserve a friendly follow-up.",
  "You're doing the work that builds a strong network.",
  "A two-sentence hello can restart a great conversation.",
  "Your career network is something you're actively growing.",
  "Each touchpoint strengthens a relationship you already started.",
  "Showing up thoughtfully is how lasting connections are built.",
]
export function pickRandomGreeting(pool = ANTI_GHOST_GREETINGS) {
  if (!pool.length) return ""
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Random welcome line; picks a new one each time Home mounts */
export function useMotivationalGreeting() {
  const [greeting, setGreeting] = useState(() => pickRandomGreeting())

  useEffect(() => {
    setGreeting(pickRandomGreeting())
  }, [])

  return greeting
}
