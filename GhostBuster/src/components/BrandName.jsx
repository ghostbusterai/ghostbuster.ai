import React from "react"
import { font } from "../theme"

const PRESETS = {
  header: {
    fontSize: 19,
    aiSize: 10,
    aiPad: "2px 5px",
    gap: 6,
    fontFamily: font.display,
    fontWeight: 700,
    letterSpacing: "-0.3px",
  },
  login: {
    fontSize: 28,
    aiSize: 12,
    aiPad: "2px 6px",
    gap: 7,
    fontFamily: font.display,
    fontWeight: 800,
    letterSpacing: "-0.4px",
  },
  hero: {
    fontSize: 28,
    aiSize: 13,
    aiPad: "3px 7px",
    gap: 8,
    fontFamily: font.h1,
    fontWeight: 800,
    letterSpacing: "-0.5px",
  },
  sm: {
    fontSize: 11,
    aiSize: 8,
    aiPad: "1px 4px",
    gap: 4,
    fontFamily: font.mono,
    fontWeight: 500,
    letterSpacing: 0,
  },
}

export default function BrandName({ variant = "header", style, className }) {
  const preset = PRESETS[variant] || PRESETS.header

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: preset.gap,
        fontFamily: preset.fontFamily,
        fontWeight: preset.fontWeight,
        fontSize: preset.fontSize,
        letterSpacing: preset.letterSpacing,
        lineHeight: 1,
        ...style,
      }}
    >
      <span>GhostBuster</span>
      <span
        style={{
          fontFamily: font.mono,
          fontSize: preset.aiSize,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: "var(--gb-accent)",
          background: "var(--gb-accent-soft)",
          border: "1px solid var(--gb-border-subtle)",
          borderRadius: 4,
          padding: preset.aiPad,
          lineHeight: 1.2,
        }}
      >
        AI
      </span>
    </span>
  )
}
