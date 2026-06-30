export const LS_PROFILE = "gb_profile"
export const GETTING_STARTED_SESSION_KEY = "gb_getting_started_dismissed"
export const GETTING_STARTED_RESTORED_EVENT = "gb_getting_started_restored"

export const DEFAULT_PROFILE = {
  name: "",
  careerGoals: "",
  lastResumeUpdate: "",
  hideGettingStarted: false,
}

export function normalizeProfile(raw) {
  const p = raw && typeof raw === "object" ? raw : {}
  return {
    name: typeof p.name === "string" ? p.name : "",
    careerGoals: typeof p.careerGoals === "string" ? p.careerGoals : "",
    lastResumeUpdate: typeof p.lastResumeUpdate === "string" ? p.lastResumeUpdate : "",
    hideGettingStarted: Boolean(p.hideGettingStarted),
  }
}

export function readLocalProfile() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PROFILE) || "null")
    return normalizeProfile(raw)
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveLocalProfile(profile) {
  localStorage.setItem(LS_PROFILE, JSON.stringify(normalizeProfile(profile)))
}

export function profileInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return null
}

export function isGettingStartedSessionDismissed() {
  try {
    return sessionStorage.getItem(GETTING_STARTED_SESSION_KEY) === "1"
  } catch {
    return false
  }
}

export function isGettingStartedHidden(profile = readLocalProfile()) {
  return profile.hideGettingStarted === true || isGettingStartedSessionDismissed()
}

export function restoreGettingStartedTutorial() {
  try {
    sessionStorage.removeItem(GETTING_STARTED_SESSION_KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(GETTING_STARTED_RESTORED_EVENT))
}
