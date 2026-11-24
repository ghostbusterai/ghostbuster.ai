import React from "react"
import { font } from "./theme"
import { primaryBtn, secondaryBtn } from "./uiStyles"

/** Shared page width — wider column to use horizontal space on desktop */
export const PAGE_CONTENT_MAX_WIDTH = 1240
export const PAGE_PADDING_X = "clamp(20px, 3vw, 40px)"

/** Responsive grid: auto-fills columns at `minPx` minimum cell width */
export function responsiveGrid(minPx = 240) {
  return `repeat(auto-fit, minmax(min(100%, ${minPx}px), 1fr))`
}

/** Two-column page section that stacks on narrow viewports */
export const PAGE_SPLIT_GRID = responsiveGrid(420)

/** Typography aligned with the Home dashboard */
export const type = {
  eyebrow: {
    fontSize: 11,
    fontFamily: font.mono,
    fontWeight: 500,
    letterSpacing: "0.2em",
    color: "var(--gb-text-subtle)",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontFamily: font.sans,
    fontWeight: 800,
    fontSize: "clamp(1.65rem, 3.2vw, 2.35rem)",
    letterSpacing: "-0.035em",
    lineHeight: 1.12,
  },
  heroSubtitle: {
    fontFamily: font.body,
    fontSize: 16,
    color: "var(--gb-text-secondary)",
    lineHeight: 1.55,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: font.mono,
    fontWeight: 500,
    letterSpacing: "0.16em",
    color: "var(--gb-text-subtle)",
    textTransform: "uppercase",
  },
  cardTitle: {
    fontFamily: font.sans,
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: "-0.02em",
    color: "var(--gb-text)",
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

/** Centered column — uses most of the viewport width on large screens */
export function PageShell({ children, className = "" }) {
  const shellClass = ["gb-page-shell", "gb-stagger-in", className].filter(Boolean).join(" ")
  return (
    <div
      className={shellClass}
      style={{ width: "100%", maxWidth: PAGE_CONTENT_MAX_WIDTH, margin: "0 auto", minWidth: 0 }}
    >
      {children}
    </div>
  )
}

/** Top hero — default `mission` = cinematic display type; use `variant="card"` for legacy boxed hero */
export function PageHero({ eyebrow, title, subtitle, action, children, className = "", variant = "mission" }) {
  const heroClass = [
    "gb-page-hero",
    variant === "mission" ? "gb-page-hero--mission" : "gb-page-hero--card",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  const titleStyle = variant === "mission" ? { margin: "0 0 10px" } : { ...type.heroTitle, margin: "0 0 8px" }

  return (
    <section className={heroClass}>
      <div className="gb-page-hero__row">
        <div className="gb-page-hero__copy">
          {eyebrow && <div className="gb-eyebrow">{eyebrow}</div>}
          {title && (
            <h1 className="gb-hero-title" style={titleStyle}>
              {title}
            </h1>
          )}
          {subtitle && <p className="gb-page-hero__subtitle">{subtitle}</p>}
        </div>
        {action && <div className="gb-page-hero__action">{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function SectionLabel({ children, style }) {
  return (
    <div className="gb-section-label" style={{ marginBottom: 12, ...style }}>
      {children}
    </div>
  )
}

/** Standard elevated content card */
export function ContentCard({
  children,
  style,
  className = "",
  padding = "22px 24px 20px",
  marginBottom = 28,
  bento = false,
}) {
  const cardClass = ["gb-content-card", bento ? "gb-bento" : "", className].filter(Boolean).join(" ")
  return (
    <section
      className={cardClass}
      style={{
        padding,
        marginBottom,
        position: "relative",
        zIndex: 1,
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
    <div className="gb-card-title-block" style={style}>
      <h2 className="gb-card-title">{children}</h2>
      {helper && <p className="gb-card-helper">{helper}</p>}
    </div>
  )
}

/** Flat empty state — pair with site-ui.css */
export function EmptyState({ title, lede, icon, action, align = "center", className = "" }) {
  const rootClass = ["gb-empty-state", align === "left" ? "gb-empty-state--left" : "", className]
    .filter(Boolean)
    .join(" ")
  return (
    <div className={rootClass}>
      {icon && <div className="gb-empty-state__icon">{icon}</div>}
      {title && <h3 className="gb-empty-state__title">{title}</h3>}
      {lede && <p className="gb-empty-state__lede">{lede}</p>}
      {action && <div className="gb-empty-state__actions">{action}</div>}
    </div>
  )
}

/** Uppercase segmented filter control */
export function SegmentedFilter({ value, onChange, options, className = "" }) {
  return (
    <div className={["gb-segmented", className].filter(Boolean).join(" ")} role="tablist">
      {options.map((opt) => {
        const id = typeof opt === "string" ? opt : opt.id
        const label = typeof opt === "string" ? opt : opt.label
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={["gb-segmented__btn", active ? "gb-segmented__btn--active" : ""].filter(Boolean).join(" ")}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function FormActions({ primary, secondary }) {
  return (
    <div className="gb-form-actions">
      {primary}
      {secondary}
    </div>
  )
}

export function FormPrimaryButton({ children, onClick, type = "button", disabled }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} {...primaryBtn()}>
      {children}
    </button>
  )
}

export function FormSecondaryButton({ children, onClick, type = "button", disabled }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} {...secondaryBtn()}>
      {children}
    </button>
  )
}

export function ListDivider({ children, tone }) {
  return (
    <div className={["gb-list-divider", tone === "warn" ? "gb-list-divider--warn" : ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  )
}
