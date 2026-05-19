/**
 * Typography: Syne for display / headlines, DM Mono for labels, metrics, and UI chrome,
 * DM Sans for longer reading text — editorial-tech pairing. Load fonts in index.html.
 */
export const font = {
  display: "Syne, sans-serif",
  mono: "DM Mono, monospace",
  body: "DM Sans, sans-serif",
}

/** Primary neon lime */
export const accentNeon = "#b8ff57"

/** RGB tuple for the neon accent (184, 255, 87) */
export function neonAlpha(a) {
  return `rgba(184, 255, 87, ${a})`
}
