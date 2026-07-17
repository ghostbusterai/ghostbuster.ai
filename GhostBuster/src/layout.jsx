import React from "react"
import { font } from "./theme"

/** Typography aligned with the Home dashboard */
export const type = {
  eyebrow: {
    fontSize: 12,
    fontFamily: font.body,
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "var(--gb-accent-muted)",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontFamily: font.h1,
    fontWeight: 800,
    fontSize: 28,
    letterSpacing: "-0.5px",
    lineHeight: 1.2,
  },
  heroSubtitle: {
    fontFamily: font.body,
    fontSize: 15,
    color: "var(--gb-text-muted)",
    lineHeight: 1.5,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: font.h1,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "var(--gb-accent-muted)",
    textTransform: "uppercase",
  },
  cardTitle: {
    fontFamily: font.h2,
    fontWeight: 700,
    fontSize: 17,
    color: "var(--gb-accent-muted)",
  },
  cardSubtitle: {
    fontFamily: font.body,
    fontSize: 13,
    color: "var(--gb-text-muted)",
    lineHeight: 1.5,
  },
  itemTitle: {
    fontFamily: font.h1,
    fontWeight: 700,
    fontSize: 15,
  },
  statValue: {
    fontFamily: font.h1,
    fontWeight: 800,
    fontSize: 28,
  },
  body: { fontFamily: font.body },
  bodyMuted: {
    fontFamily: font.body,
    fontSize: 13,
    color: "var(--gb-text-muted)",
    lineHeight: 1.5,
  },
  meta: { fontFamily: font.mono },
}

/** Centered column matching Home dashboard width */
export function PageShell({ children }) {
  return (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", minWidth: 0 }}>
      {children}
    </div>
  )
}

/** Top hero card — same pattern as Home greeting block */
export function PageHero({ eyebrow, title, subtitle, action, children }) {
  return (
    <section
      style={{
        background: "var(--gb-bg-elevated)",
        border: "1px solid var(--gb-border)",
        borderRadius: 20,
        padding: "22px 20px 20px",
        marginBottom: 24,
        boxShadow: "var(--gb-shadow-panel)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          {eyebrow && (
            <div style={{ ...type.eyebrow, marginBottom: 10 }}>
              {eyebrow}
            </div>
          )}
          {title && (
            <h1 style={{ ...type.heroTitle, margin: "0 0 8px" }}>
              {title}
            </h1>
          )}
          {subtitle && (
            <p style={{ ...type.heroSubtitle, margin: 0, maxWidth: 560 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function SectionLabel({ children, style }) {
  return (
    <div style={{ ...type.sectionLabel, marginBottom: 12, ...style }}>
      {children}
    </div>
  )
}

/** Standard elevated content card */
export function ContentCard({ children, style, padding = "18px 18px 16px", marginBottom = 24 }) {
  return (
    <section
      style={{
        background: "var(--gb-bg-elevated)",
        border: "1px solid var(--gb-border)",
        borderRadius: 16,
        padding,
        marginBottom,
        ...style,
      }}
    >
      {children}
    </section>
  )
}

/** In-card section title — matches Contacts “Search” style site-wide */
export function CardTitle({ children, helper, style }) {
  return (
    <div style={{ marginBottom: helper ? 14 : 16, ...style }}>
      <div style={{ ...type.cardTitle, marginBottom: helper ? 6 : 0 }}>
        {children}
      </div>
      {helper && (
        <p style={{ ...type.cardSubtitle, margin: 0 }}>
          {helper}
        </p>
      )}
    </div>
  )
}
