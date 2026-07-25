import React from "react"
import { font } from "../theme"

/** Same wording as the Compose “Generated message” helper. */
export const AI_DISCLAIMER_TEXT =
  "This message is AI-generated and may contain errors or outdated details. Proofread carefully and edit anything that does not sound like you before copying or sending."

/** Shared AI disclaimer used on Compose and Ghostwriter. */
export default function AiDisclaimer({ style } = {}) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 12,
        fontFamily: font.body,
        color: "var(--gb-text-faint)",
        lineHeight: 1.5,
        ...style,
      }}
    >
      {AI_DISCLAIMER_TEXT}
    </p>
  )
}
