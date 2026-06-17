export const LS_PROFILE = "gb_profile"

export const DEFAULT_PROFILE = {
  name: "",
  careerGoals: "",
  lastResumeUpdate: "",
}

export function normalizeProfile(raw) {
  const p = raw && typeof raw === "object" ? raw : {}
  return {
    name: typeof p.name === "string" ? p.name : "",
    careerGoals: typeof p.careerGoals === "string" ? p.careerGoals : "",
    lastResumeUpdate: typeof p.lastResumeUpdate === "string" ? p.lastResumeUpdate : "",
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
