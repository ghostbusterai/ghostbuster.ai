import React from "react"
import { secondaryBtn } from "../uiStyles"

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

  const btn = secondaryBtn({ sm: true, style })

  return (
    <button type="button" onClick={onToggle} className={btn.className} style={btn.style}>
      {showAll
        ? "Show less"
        : hiddenCount > 0
          ? `View ${hiddenCount} more ${hiddenCount === 1 ? singular : pluralLabel}`
          : "View more"}
    </button>
  )
}