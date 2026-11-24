import React from "react"
import { font } from "../theme"

const PRESETS = {
  header: {
    fontSize: 18,
    aiSize: 10,
    aiPad: "2px 5px",
    gap: 6,
    fontFamily: font.sans,
    fontWeight: 700,
    letterSpacing: "-0.04em",
  },
  login: {
    fontSize: 26,
    aiSize: 11,
    aiPad: "2px 6px",
    gap: 7,
    fontFamily: font.sans,
    fontWeight: 800,
    letterSpacing: "-0.045em",
  },
  hero: {
    fontSize: 26,
    aiSize: 12,
    aiPad: "3px 7px",
    gap: 8,
    fontFamily: font.sans,
    fontWeight: 800,
    letterSpacing: "-0.04em",
  },
  sm: {
    fontSize: 11,
    aiSize: 8,
    aiPad: "1px 4px",
    gap: 4,
    fontFamily: font.sans,
    fontWeight: 600,
    letterSpacing: "-0.02em",
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
        data-brand-ai
        style={{
          fontFamily: font.sans,
          fontSize: preset.aiSize,
          fontWeight: 800,
          letterSpacing: "0.02em",
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
