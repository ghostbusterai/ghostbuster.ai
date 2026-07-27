import React from "react"
import { font } from "../theme"

export default function ViewMoreButton({
  hiddenCount,
  showAll,
  onToggle,
  singular = "item",
  plural,
  style,
}) {
  const pluralLabel = plural || `${singular}s`
  if (hiddenCount <= 0 && !showAll) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        alignSelf: "flex-start",
        background: "var(--gb-surface-hover)",
        border: "1px solid var(--gb-border)",
        color: "var(--gb-text-secondary)",
        padding: "10px 16px",
        borderRadius: 9,
        fontFamily: font.body,
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        boxShadow: "none",
        ...style,
      }}
    >
      {showAll
        ? "Show less"
        : hiddenCount > 0
          ? `View ${hiddenCount} more ${hiddenCount === 1 ? singular : pluralLabel}`
          : "View more"}
    </button>
  )
}
