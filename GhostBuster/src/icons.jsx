import React from "react"

export const ICON_STROKE = {
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
}

export function Icon({ name, size = 20, color = "currentColor", className = "", title }) {
  const svgProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className: `gb-icon ${className}`.trim(),
    "aria-hidden": title ? undefined : true,
    role: title ? "img" : undefined,
  }
  const stroke = { stroke: color, ...ICON_STROKE }

  let body = null

  switch (name) {
    case "chevron-right":
      body = <path d="m9 6 6 6-6 6" {...stroke} />
      break
    case "chevron-down":
      body = <path d="m6 9 6 6 6-6" {...stroke} />
      break
    case "check":
      body = <path d="M20 6 9 17l-5-5" {...stroke} />
      break
    case "mail":
      body = (
        <>
          <path d="m22 2-7 20-4-9-9-4Z" {...stroke} />
          <path d="M22 2 11 13" {...stroke} />
        </>
      )
      break
    case "phone":
      body = <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" {...stroke} />
      break
    case "users":
      body = (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...stroke} />
          <circle cx="9" cy="7" r="4" {...stroke} />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" {...stroke} />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" {...stroke} />
        </>
      )
      break
    case "map-pin":
      body = (
        <>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" {...stroke} />
          <circle cx="12" cy="10" r="3" {...stroke} />
        </>
      )
      break
    case "linkedin":
      body = (
        <>
          <path d="M16 8a6 6 0 0 1 6 6v7" {...stroke} />
          <path d="M6 9H2v12h4V9Z" {...stroke} />
          <path d="M6 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" {...stroke} />
        </>
      )
      break
    case "more":
      body = (
        <>
          <circle cx="12" cy="12" r="1" fill={color} stroke="none" />
          <circle cx="19" cy="12" r="1" fill={color} stroke="none" />
          <circle cx="5" cy="12" r="1" fill={color} stroke="none" />
        </>
      )
      break
    case "file":
      body = (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...stroke} />
          <path d="M14 2v6h6" {...stroke} />
        </>
      )
      break
    case "clipboard":
      body = (
        <>
          <rect x="8" y="3" width="8" height="4" rx="1" {...stroke} />
          <path d="M8 7v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" {...stroke} />
        </>
      )
      break
    case "bell":
      body = (
        <>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...stroke} />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" {...stroke} />
        </>
      )
      break
    case "chart":
      body = (
        <>
          <path d="M3 3v18h18" {...stroke} />
          <path d="M7 16V9" {...stroke} />
          <path d="M12 16V5" {...stroke} />
          <path d="M17 16v-7" {...stroke} />
        </>
      )
      break
    case "mic":
      body = (
        <>
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" {...stroke} />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" {...stroke} />
          <path d="M12 19v3" {...stroke} />
        </>
      )
      break
    case "spark":
      body = <path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2Z" {...stroke} />
      break
    default:
      return null
  }

  return (
    <svg {...svgProps}>
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  )
}

export function ChannelIcon({ channel, size = 18, color }) {
  const key =
    channel === "Email"
      ? "mail"
      : channel === "Call"
        ? "phone"
        : channel === "In-person"
          ? "map-pin"
          : channel === "LinkedIn"
            ? "linkedin"
            : "more"
  return <Icon name={key} size={size} color={color || "currentColor"} />
}