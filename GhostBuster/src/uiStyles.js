import { font } from "./theme"

export function inputStyle() {
  return {
    width: "100%",
    background: "var(--gb-bg-input)",
    border: "1px solid var(--gb-border-strong)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "var(--gb-text)",
    fontSize: 14,
    fontFamily: font.body,
    outline: "none",
    boxSizing: "border-box",
  }
}

export function sectionCard(borderColor = "var(--gb-border-subtle)", embedded = false) {
  return {
    background: embedded ? "var(--gb-bg-panel)" : "var(--gb-bg-elevated)",
    border: `1px solid ${borderColor}`,
    borderRadius: embedded ? 12 : 16,
    padding: embedded ? 16 : 24,
    marginBottom: embedded ? 14 : 24,
  }
}

export function secondaryBtn() {
  return {
    background: "var(--gb-surface-muted)",
    border: "1px solid var(--gb-border)",
    color: "var(--gb-text-strong)",
    padding: "10px 16px",
    borderRadius: 9,
    fontFamily: font.body,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    boxShadow: "none",
  }
}

export function primaryBtn() {
  return {
    background: "var(--gb-accent-bright)",
    color: "var(--gb-accent-text-on)",
    border: "1px solid color-mix(in srgb, var(--gb-accent-text-on) 22%, transparent)",
    boxShadow: "none",
    padding: "10px 24px",
    borderRadius: 9,
    fontFamily: font.h1,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  }
}
