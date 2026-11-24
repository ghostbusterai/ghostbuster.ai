import { font } from "./theme"

/** Shared class names — pair with theme.css `.gb-*` rules */
export const uiClass = {
  input: "gb-field",
  btnPrimary: "gb-btn gb-btn--primary",
  btnSecondary: "gb-btn gb-btn--secondary",
  btnGhost: "gb-btn gb-btn--ghost",
  btnAccentSoft: "gb-btn gb-btn--accent-soft",
  btnDanger: "gb-btn gb-btn--danger-soft",
  btnDangerSolid: "gb-btn gb-btn--danger",
  btnLink: "gb-btn gb-btn--link",
  btnChip: "gb-btn gb-btn--chip",
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
    "gb-reveal-block",
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

function mergeBtnProps(base, extra = {}) {
  const { className: extraClass, style: extraStyle, sm, fullWidth, ...rest } = extra
  return {
    ...rest,
    className: [base.className, extraClass].filter(Boolean).join(" "),
    style: { ...base.style, ...(fullWidth ? { width: "100%" } : {}), ...extraStyle },
  }
}

export function secondaryBtn(extra = {}) {
  return mergeBtnProps(
    {
      className: [uiClass.btnSecondary, extra.sm ? uiClass.btnSm : ""].filter(Boolean).join(" "),
      style: {},
    },
    extra
  )
}

export function primaryBtn(extra = {}) {
  return mergeBtnProps(
    {
      className: [uiClass.btnPrimary, extra.sm ? uiClass.btnSm : ""].filter(Boolean).join(" "),
      style: {},
    },
    extra
  )
}

export function ghostBtn(extra = {}) {
  return mergeBtnProps(
    {
      className: [uiClass.btnGhost, extra.sm !== false ? uiClass.btnSm : ""].filter(Boolean).join(" "),
      style: {},
    },
    extra
  )
}

export function accentSoftBtn(extra = {}) {
  return mergeBtnProps(
    {
      className: [uiClass.btnAccentSoft, extra.sm !== false ? uiClass.btnSm : ""].filter(Boolean).join(" "),
      style: {},
    },
    extra
  )
}

export function dangerBtn(extra = {}) {
  return mergeBtnProps(
    {
      className: [uiClass.btnDanger, extra.sm !== false ? uiClass.btnSm : ""].filter(Boolean).join(" "),
      style: {},
    },
    extra
  )
}

export function dangerSolidBtn(extra = {}) {
  return mergeBtnProps(
    {
      className: [uiClass.btnDangerSolid, extra.sm !== false ? uiClass.btnSm : ""].filter(Boolean).join(" "),
      style: {},
    },
    extra
  )
}

export function linkBtn(extra = {}) {
  return mergeBtnProps(
    {
      className: [uiClass.btnLink, extra.sm ? uiClass.btnSm : ""].filter(Boolean).join(" "),
      style: {},
    },
    extra
  )
}

export function chipBtn(extra = {}) {
  return mergeBtnProps(
    {
      className: [uiClass.btnChip, extra.sm !== false ? uiClass.btnSm : ""].filter(Boolean).join(" "),
      style: {},
    },
    extra
  )
}