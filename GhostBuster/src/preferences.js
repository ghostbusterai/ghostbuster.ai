export const COMPOSE_TONES = [
  "Warm & professional (balanced)",
  "Formal & concise",
  "Friendly & conversational",
  "Casual (still respectful)",
  "Enthusiastic / upbeat",
  "Direct & minimal",
]

export const LS_DEFAULT_SYNC_CALENDAR = "gb_pref_default_sync_calendar"
export const LS_DEFAULT_COMPOSE_TONE = "gb_pref_default_compose_tone"
export const LS_PREFILL_BACKGROUND = "gb_pref_prefill_background"

export const DEFAULT_PREFERENCES = {
  defaultSyncToCalendar: true,
  defaultComposeTone: COMPOSE_TONES[0],
  prefillBackgroundFromGoals: false,
}

export function readPreferences() {
  try {
    const sync = localStorage.getItem(LS_DEFAULT_SYNC_CALENDAR)
    const tone = localStorage.getItem(LS_DEFAULT_COMPOSE_TONE)
    const prefill = localStorage.getItem(LS_PREFILL_BACKGROUND)
    return {
      defaultSyncToCalendar: sync === null ? DEFAULT_PREFERENCES.defaultSyncToCalendar : sync === "1",
      defaultComposeTone: COMPOSE_TONES.includes(tone) ? tone : DEFAULT_PREFERENCES.defaultComposeTone,
      prefillBackgroundFromGoals: prefill === "1",
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(partial) {
  const current = readPreferences()
  const next = { ...current, ...partial }
  try {
    localStorage.setItem(LS_DEFAULT_SYNC_CALENDAR, next.defaultSyncToCalendar ? "1" : "0")
    localStorage.setItem(LS_DEFAULT_COMPOSE_TONE, next.defaultComposeTone)
    localStorage.setItem(LS_PREFILL_BACKGROUND, next.prefillBackgroundFromGoals ? "1" : "0")
  } catch {
    /* ignore */
  }
  return next
}
