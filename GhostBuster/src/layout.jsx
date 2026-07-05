import React from "react"
import { font } from "./theme"

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
            <div
              style={{
                fontSize: 10,
                fontFamily: font.mono,
                letterSpacing: "0.16em",
                color: "var(--gb-text-faint)",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {eyebrow}
            </div>
          )}
          {title && (
            <h1
              style={{
                fontFamily: font.h1,
                fontWeight: 800,
                fontSize: 28,
                letterSpacing: "-0.5px",
                margin: "0 0 8px",
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              style={{
                margin: 0,
                color: "var(--gb-text-muted)",
                fontSize: 15,
                fontFamily: font.body,
                lineHeight: 1.55,
                maxWidth: 560,
              }}
            >
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
    <div
      style={{
        fontSize: 11,
        fontFamily: font.h1,
        fontWeight: 700,
        letterSpacing: "0.14em",
        color: "#ffffff",
        textTransform: "uppercase",
        marginBottom: 12,
        ...style,
      }}
    >
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

/** In-card section title */
export function CardTitle({ children, helper }) {
  return (
    <div style={{ marginBottom: helper ? 14 : 16 }}>
      <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, marginBottom: helper ? 6 : 0 }}>
        {children}
      </div>
      {helper && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--gb-text-muted)", lineHeight: 1.5 }}>
          {helper}
        </p>
      )}
    </div>
  )
}
