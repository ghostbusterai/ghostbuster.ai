import { font } from "./theme"

/** Shared class names — pair with theme.css `.gb-*` rules */
export const uiClass = {
  input: "gb-field",
  btnPrimary: "gb-btn gb-btn--primary",
  btnSecondary: "gb-btn gb-btn--secondary",
  btnGhost: "gb-btn gb-btn--ghost",
  btnSm: "gb-btn--sm",
  sectionCard: "gb-section-card",
  floatingPanel: "gb-floating-panel",
  iconBtn: "gb-icon-btn",
  menuItem: "gb-menu-item",
}

export function inputStyle() {
  return {
    width: "100%",
    background: "var(--gb-bg-input)",
    border: "1px solid var(--gb-border-strong)",
    borderRadius: "var(--gb-radius-md, 12px)",
    padding: "11px 14px",
    color: "var(--gb-text)",
    fontSize: 14,
    fontFamily: font.body,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  }
}

export function inputProps(extraStyle) {
  return {
    className: uiClass.input,
    style: { ...inputStyle(), ...extraStyle },
  }
}

export function sectionCard(borderColor = "var(--gb-border-subtle)", embedded = false) {
  const className = [
    uiClass.sectionCard,
    embedded ? "gb-section-card--embedded" : "",
  ]
    .filter(Boolean)
    .join(" ")
  const style = {}
  if (borderColor && borderColor !== "var(--gb-border-subtle)") {
    style.borderColor = borderColor
  }
  return { className, style }
}

export function secondaryBtn(extra = {}) {
  return {
    className: [uiClass.btnSecondary, extra.sm ? uiClass.btnSm : ""].filter(Boolean).join(" "),
    style: {
      ...(extra.fullWidth ? { width: "100%" } : {}),
      ...extra.style,
    },
  }
}

export function primaryBtn(extra = {}) {
  return {
    className: [uiClass.btnPrimary, extra.sm ? uiClass.btnSm : ""].filter(Boolean).join(" "),
    style: {
      ...(extra.fullWidth ? { width: "100%" } : {}),
      ...extra.style,
    },
  }
}