import React from "react"

/**
 * Circular mark: character emerging from an open envelope (theme-aware green line art).
 */
export default function GhostBusterLogo({ size = 22, className, ...rest }) {
  const sw = 3

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
      <circle cx="50" cy="50" r="46" fill="var(--gb-logo-fill)" stroke="var(--gb-logo-stroke)" strokeWidth={sw} />

      <path
        d="M 26.5 63 L 37 29.5 L 53.5 59.5"
        stroke="var(--gb-logo-stroke)"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M 42 61.5
           C 33.5 60 28.5 52.5 29.5 43.5
           C 30.5 35 37 28.5 46 27.5
           C 56.5 26.5 66 31 68.5 40
           C 70.5 47.5 66 54.5 58 57.5
           C 52 59.5 46 61 42 61.5 Z"
        stroke="var(--gb-logo-stroke)"
        strokeWidth={sw}
        strokeLinejoin="round"
        fill="none"
      />

      <circle cx="45.5" cy="36" r="2.2" fill="var(--gb-logo-stroke)" />
      <circle cx="55" cy="37.5" r="2.2" fill="var(--gb-logo-stroke)" />
      <path
        d="M 48 42.5 H 57"
        stroke="var(--gb-logo-stroke)"
        strokeWidth={sw * 0.7}
        strokeLinecap="round"
      />

      <path
        d="M 26.5 63 V 80.5 H 67.5 V 63"
        stroke="var(--gb-logo-stroke)"
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <path
        d="M 26.5 63 L 47 51 L 67.5 63"
        stroke="var(--gb-logo-stroke)"
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    </svg>
  )
}
