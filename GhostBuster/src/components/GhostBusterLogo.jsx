import React from "react"

const ink = "#0a0f09"

/**
 * Header mark: outreach (envelope + small node link) and a ghost silhouette
 * crossed out — “busting,” not celebrating the ghost.
 */
export default function GhostBusterLogo({ size = 22, className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...rest}
    >
      {/* Mini network: two nodes + edge — relationships / outreach */}
      <circle cx={7} cy={8} r={2.2} fill={ink} />
      <circle cx={14.5} cy={6} r={2.2} fill={ink} />
      <path
        d="M 9.1 8.3 L 12.5 6.9"
        stroke={ink}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* Envelope */}
      <path
        d="M 5.5 13 L 16 21 L 26.5 13"
        stroke={ink}
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 5.5 13 V 24.5 H 26.5 V 13"
        stroke={ink}
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Ghost sheet — small, tucked by the flap; then strike through */}
      <path
        d="M 19.2 10.5
           C 19.2 8.2 21.2 6.5 23.5 6.5
           C 26 6.5 27.8 8.4 27.8 10.8
           V 14.2
           C 26.6 15 25.2 14.8 24.2 14.2
           C 23.2 14.9 21.8 15 20.6 14.2
           C 19.6 14.8 18.2 15 17 14.2
           V 10.8
           C 17 10.2 18 10.5 19.2 10.5 Z"
        stroke={ink}
        strokeWidth={1.65}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Bust: bold slash through the specter */}
      <path
        d="M 17.2 7.2 L 28.2 15.4"
        stroke={ink}
        strokeWidth={2.65}
        strokeLinecap="round"
      />
    </svg>
  )
}
