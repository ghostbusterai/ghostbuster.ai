import { useState, useEffect } from "react"

/** Playful Home header lines — realistic networking nudges, ghost-busting themed */
export const ANTI_GHOST_GREETINGS = [
  "Someone in your network is going cold 👻",
  "That coffee chat deserves a part two",
  "Un-ghost one contact today",
  "They won't know unless you reach out",
  "Follow-ups are just polite haunting",
  "Quiet contacts aren't mad — just waiting",
  "One short note beats months of guilt",
  "Career fairs spawn ghosts. You fix that.",
  "Your warm list needs a quick patrol",
  "The scariest ghost is a draft you never sent",
  "Networking isn't weird if you already met",
  "A nudge now beats an awkward re-intro later",
  "Reply threads die. Relationships don't have to.",
  "Check in before they forget your face",
  "Ghostbusting mode: say hi to one person",
  "Cold outreach is still outreach",
  "You met them for a reason — remind them",
  "Pending follow-up? Today's a good day.",
  "No poltergeists — just people you haven't pinged",
  "Warm beats radio silence every time",
  "They're probably not ignoring you",
  "One message can un-haunt a connection",
  "Your network won't maintain itself 👻",
  "Silence is how good contacts become strangers",
  "Send the follow-up. Rip off the band-aid.",
]
export function pickRandomGreeting(pool = ANTI_GHOST_GREETINGS) {
  if (!pool.length) return ""
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Random anti-ghosting line; refreshes when returning to Home */
export function useMotivationalGreeting(active = true) {
  const [greeting, setGreeting] = useState(() => pickRandomGreeting())

  useEffect(() => {
    if (active) setGreeting(pickRandomGreeting())
  }, [active])

  return greeting
}
