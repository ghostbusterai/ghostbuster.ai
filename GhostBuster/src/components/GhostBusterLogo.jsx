import React from "react"

/** Minimal mark — square frame, thin strokes (SpaceX-adjacent, not cartoon). */
export default function GhostBusterLogo({ size = 22, className, ...rest }) {
  const sw = 2
  const ink = "var(--gb-logo-stroke)"
  const env = "var(--gb-logo-envelope)"
  const envDeep = "var(--gb-logo-envelope-deep)"
  const ghost = "var(--gb-logo-ghost)"
  const feature = "var(--gb-logo-ghost-feature)"

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...rest}
    >
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="10"
        fill="var(--gb-logo-fill)"
        stroke={ink}
        strokeWidth={sw}
      />

      <path d="M 28 54 L 47 64 L 66 54 L 66 80 H 28 Z" fill={envDeep} />

      <path
        d="M 43 62 C 35 60.5 30.5 53 31.5 45 C 32.5 36.5 39 30.5 47.5 29.5 C 57 28.5 65.5 33 67.5 41.5 C 69 48 65 54.5 57.5 57.5 C 52 59.5 47 60.5 43 62 Z"
        stroke={ink}
        strokeWidth={sw}
        strokeLinejoin="round"
        fill={ghost}
      />

      <path d="M 28 64 V 80 H 66 V 64 Z" fill={env} />

      <path d="M 28 54 V 80 H 66 V 64" stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M 28 54 L 47 64 L 66 54" stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M 28 54 H 66" stroke={ink} strokeWidth={sw} strokeLinecap="round" />

      <circle cx="45" cy="37" r="1.8" fill={feature} />
      <circle cx="54" cy="38" r="1.8" fill={feature} />
    </svg>
  )
}