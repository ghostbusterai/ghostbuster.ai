/**
 * Typography: Lexend for h1 and h2, Syne for other display type,
 * DM Mono for labels, DM Sans for body. Load fonts in index.html.
 */
export const font = {
  h1: "Lexend, sans-serif",
  h2: "Lexend, sans-serif",
  display: "Syne, sans-serif",
  mono: "DM Mono, monospace",
  body: "DM Sans, sans-serif",
}

/** Primary neon lime — button fills & highlights */
export const accentNeon = "#b8ff57"

/** RGB tuple for the neon accent (184, 255, 87) */
export function neonAlpha(a) {
  return `rgba(184, 255, 87, ${a})`
}

export const COLOR_SCHEMES = ["dark", "light"]

const DARK_VARS = {
  "--gb-bg": "#0a0a0f",
  "--gb-bg-elevated": "#111118",
  "--gb-bg-panel": "#0d0d14",
  "--gb-bg-input": "#0a0a0f",
  "--gb-header-bg": "#0a0a0f",
  "--gb-text": "#f0f0f5",
  "--gb-text-strong": "rgba(240,240,245,0.85)",
  "--gb-text-secondary": "rgba(240,240,245,0.75)",
  "--gb-text-subtle": "rgba(240,240,245,0.55)",
  "--gb-text-muted": "rgba(240,240,245,0.45)",
  "--gb-text-faint": "rgba(240,240,245,0.35)",
  "--gb-text-dim": "rgba(240,240,245,0.3)",
  "--gb-border": "rgba(255,255,255,0.12)",
  "--gb-border-subtle": "rgba(255,255,255,0.08)",
  "--gb-border-strong": "rgba(255,255,255,0.1)",
  "--gb-surface-hover": "rgba(255,255,255,0.04)",
  "--gb-surface-muted": "rgba(255,255,255,0.05)",
  "--gb-surface-active": "rgba(255,255,255,0.06)",
  "--gb-accent": "#b8ff57",
  "--gb-accent-bright": "#b8ff57",
  "--gb-accent-muted": "rgba(184,255,87,0.75)",
  "--gb-accent-soft": "rgba(184,255,87,0.14)",
  "--gb-accent-border": "rgba(184,255,87,0.35)",
  "--gb-accent-text-on": "#0a0f09",
  "--gb-logo-stroke": "#b8ff57",
  "--gb-logo-fill": "rgba(184,255,87,0.12)",
  "--gb-danger": "#ff6b6b",
  "--gb-warning": "#ffc96b",
  "--gb-shadow-panel": "0 16px 48px rgba(0,0,0,0.45)",
  "--gb-inset-highlight": "0 1px 0 rgba(255,255,255,0.04) inset",
}

const LIGHT_VARS = {
  "--gb-bg": "#ffffff",
  "--gb-bg-elevated": "#f7f8fa",
  "--gb-bg-panel": "#f1f3f6",
  "--gb-bg-input": "#ffffff",
  "--gb-header-bg": "#ffffff",
  "--gb-text": "#181b22",
  "--gb-text-strong": "rgba(24,27,34,0.88)",
  "--gb-text-secondary": "rgba(24,27,34,0.78)",
  "--gb-text-subtle": "rgba(24,27,34,0.62)",
  "--gb-text-muted": "rgba(24,27,34,0.55)",
  "--gb-text-faint": "rgba(24,27,34,0.42)",
  "--gb-text-dim": "rgba(24,27,34,0.34)",
  "--gb-border": "rgba(24,27,34,0.12)",
  "--gb-border-subtle": "rgba(24,27,34,0.08)",
  "--gb-border-strong": "rgba(24,27,34,0.16)",
  "--gb-surface-hover": "rgba(24,27,34,0.04)",
  "--gb-surface-muted": "rgba(24,27,34,0.05)",
  "--gb-surface-active": "rgba(24,27,34,0.07)",
  "--gb-accent": "#4d8c18",
  "--gb-accent-bright": "#b8ff57",
  "--gb-accent-muted": "rgba(77,140,24,0.88)",
  "--gb-accent-soft": "rgba(109,184,50,0.14)",
  "--gb-accent-border": "rgba(77,140,24,0.35)",
  "--gb-accent-text-on": "#0a0f09",
  "--gb-logo-stroke": "#4d8c18",
  "--gb-logo-fill": "#f4f9ef",
  "--gb-danger": "#c93434",
  "--gb-warning": "#b8740a",
  "--gb-shadow-panel": "0 16px 48px rgba(24,27,34,0.12)",
  "--gb-inset-highlight": "0 1px 0 rgba(255,255,255,0.8) inset",
}

export const THEME_VARS = {
  dark: DARK_VARS,
  light: LIGHT_VARS,
}

export function applyTheme(colorScheme = "dark") {
  const mode = COLOR_SCHEMES.includes(colorScheme) ? colorScheme : "dark"
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode === "light" ? "light" : "dark"
  const vars = THEME_VARS[mode]
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}
