/**
 * Typography: Plus Jakarta Sans everywhere (UI, headings, labels, meta).
 * Loaded in index.html.
 */
const FONT_SANS = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif'

export const font = {
  sans: FONT_SANS,
  h1: FONT_SANS,
  h2: FONT_SANS,
  display: FONT_SANS,
  body: FONT_SANS,
  /** Same family — use size/weight/letter-spacing for “mono” labels, not a second typeface */
  mono: FONT_SANS,
}

/** Primary accent — aerospace lime (readable on charcoal, not neon) */
export const accentNeon = "#9dce5c"

/** RGB tuple for the accent (157, 206, 92) */
export function neonAlpha(a) {
  return `rgba(157, 206, 92, ${a})`
}

export const COLOR_SCHEMES = ["dark", "light"]

const DARK_VARS = {
  "--gb-font-sans": FONT_SANS,
  "--gb-font-display": FONT_SANS,
  "--gb-font-mono": FONT_SANS,
  "--gb-bg-sky": "#0a0a0a",
  "--gb-bg": "#050505",
  "--gb-bg-deep": "#000000",
  "--gb-bg-mist": "#141414",
  "--gb-bg-canvas": "#000000",
  "--gb-bg-elevated": "rgba(12, 12, 12, 0.96)",
  "--gb-bg-panel": "rgba(255, 255, 255, 0.04)",
  "--gb-bg-input": "rgba(255, 255, 255, 0.06)",
  "--gb-bg-card-start": "rgba(255, 255, 255, 0.05)",
  "--gb-bg-card-end": "rgba(255, 255, 255, 0.02)",
  "--gb-overlay": "rgba(0, 0, 0, 0.72)",
  "--gb-header-bg": "rgba(0, 0, 0, 0.85)",
  "--gb-text": "#ffffff",
  "--gb-text-strong": "rgba(236,236,238,0.9)",
  "--gb-text-secondary": "rgba(236,236,238,0.78)",
  "--gb-text-subtle": "rgba(236,236,238,0.58)",
  "--gb-text-muted": "rgba(236,236,238,0.48)",
  "--gb-text-faint": "rgba(236,236,238,0.38)",
  "--gb-text-dim": "rgba(236,236,238,0.32)",
  "--gb-border": "rgba(255,255,255,0.14)",
  "--gb-border-subtle": "rgba(255,255,255,0.09)",
  "--gb-border-strong": "rgba(255,255,255,0.11)",
  "--gb-surface-hover": "rgba(255,255,255,0.05)",
  "--gb-surface-muted": "rgba(255,255,255,0.06)",
  "--gb-surface-active": "rgba(255,255,255,0.08)",
  "--gb-accent": "#9dce5c",
  "--gb-accent-bright": "#b8e07a",
  "--gb-accent-muted": "rgba(184, 220, 140, 0.82)",
  "--gb-accent-soft": "rgba(157, 206, 92, 0.11)",
  "--gb-accent-border": "rgba(157, 206, 92, 0.34)",
  "--gb-accent-glow": "rgba(157, 206, 92, 0.22)",
  "--gb-accent-text-on": "#1a1c18",
  "--gb-logo-stroke": "#9dce5c",
  "--gb-logo-fill": "rgba(157,206,92,0.24)",
  "--gb-logo-ghost": "#ffffff",
  "--gb-logo-ghost-stroke": "rgba(255,255,255,0.92)",
  "--gb-logo-ghost-feature": "#2a2a2e",
  "--gb-logo-envelope": "#b8e07a",
  "--gb-logo-envelope-deep": "#7ab844",
  "--gb-danger": "#ff6b6b",
  "--gb-warning": "#ffc96b",
  "--gb-shadow-panel": "0 1px 0 rgba(255, 255, 255, 0.04) inset",
  "--gb-shadow-accent": "none",
  "--gb-inset-highlight": "0 1px 0 rgba(255,255,255,0.06) inset",
  "--gb-glass-blur": "20px",
  "--gb-radius-sm": "2px",
  "--gb-radius-md": "4px",
  "--gb-radius-lg": "8px",
  "--gb-radius-xl": "10px",
}

const LIGHT_VARS = {
  "--gb-font-sans": FONT_SANS,
  "--gb-font-display": FONT_SANS,
  "--gb-font-mono": FONT_SANS,
  "--gb-bg": "#ffffff",
  "--gb-bg-deep": "#f6f7f9",
  "--gb-bg-elevated": "#ffffff",
  "--gb-bg-panel": "#ffffff",
  "--gb-bg-sky": "#ffffff",
  "--gb-bg-mist": "#ffffff",
  "--gb-bg-canvas": "#ffffff",
  "--gb-bg-card-start": "#ffffff",
  "--gb-bg-card-end": "#fafbfc",
  "--gb-overlay": "rgba(24, 27, 34, 0.08)",
  "--gb-bg-input": "#fafbfc",
  "--gb-header-bg": "rgba(255, 255, 255, 0.92)",
  "--gb-divider": "rgba(24, 27, 34, 0.08)",
  "--gb-divider-subtle": "rgba(24, 27, 34, 0.06)",
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
  "--gb-logo-fill": "rgba(109,184,50,0.22)",
  "--gb-logo-ghost": "#ffffff",
  "--gb-logo-ghost-stroke": "#ffffff",
  "--gb-logo-ghost-feature": "#0a0f09",
  "--gb-logo-envelope": "#6db832",
  "--gb-logo-envelope-deep": "#4d8c18",
  "--gb-danger": "#c93434",
  "--gb-warning": "#b8740a",
  "--gb-shadow-panel": "0 1px 0 rgba(24, 27, 34, 0.04) inset",
  "--gb-shadow-accent": "0 0 24px -6px rgba(109, 184, 50, 0.35), 0 8px 24px -8px rgba(77, 140, 24, 0.2)",
  "--gb-accent-glow": "rgba(109, 184, 50, 0.38)",
  "--gb-inset-highlight": "0 1px 0 rgba(255,255,255,0.8) inset",
  "--gb-glass-blur": "20px",
  "--gb-radius-sm": "2px",
  "--gb-radius-md": "4px",
  "--gb-radius-lg": "8px",
  "--gb-radius-xl": "10px",
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