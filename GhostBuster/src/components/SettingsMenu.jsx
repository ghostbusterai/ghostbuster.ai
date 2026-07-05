import React, { useState, useEffect, useRef } from "react"
import { font } from "../theme"
import Settings from "./Settings"

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M19.4 13a7.97 7.97 0 0 0 .1-2l2-1.2-2-3.46-2.3.7a8.1 8.1 0 0 0-1.7-1l-.4-2.4H9.9l-.4 2.4a8.1 8.1 0 0 0-1.7 1l-2.3-.7-2 3.46 2 1.2a7.97 7.97 0 0 0 .1 2l-2 1.2 2 3.46 2.3-.7a8.1 8.1 0 0 0 1.7 1l.4 2.4h4.2l.4-2.4a8.1 8.1 0 0 0 1.7-1l2.3.7 2-3.46-2-1.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function SettingsMenu({
  setPage,
  googleNotice = null,
  onConsumeGoogleNotice = () => {},
  open: controlledOpen,
  onOpenChange,
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === "Escape") setOpen(false)
    }
    function onClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onClick)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onClick)
    }
  }, [open, setOpen])

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Settings"
        onClick={() => setOpen(!open)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: open ? "1px solid var(--gb-accent-border)" : "1px solid var(--gb-border-strong)",
          background: open ? "var(--gb-accent-soft)" : "var(--gb-surface-hover)",
          color: open ? "var(--gb-accent)" : "var(--gb-text-secondary)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "none",
          transition: "border-color 0.15s, background 0.15s, color 0.15s",
        }}
      >
        <GearIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Settings"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: "min(420px, calc(100vw - 32px))",
            maxHeight: "min(85vh, 720px)",
            background: "var(--gb-bg-elevated)",
            border: "1px solid var(--gb-border-strong)",
            borderRadius: 14,
            boxShadow: "var(--gb-shadow-panel)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid var(--gb-border-subtle)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: font.h2,
                fontWeight: 800,
                fontSize: 17,
                letterSpacing: "-0.3px",
              }}
            >
              Settings
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: "var(--gb-text-muted)",
                lineHeight: 1.45,
              }}
            >
              Tutorial, reminders, compose, integrations, and how urgency works.
            </p>
          </div>

          <div style={{ overflowY: "auto", padding: "16px 18px 18px", flex: 1, minHeight: 0 }}>
            <Settings
              embedded
              setPage={(page) => {
                setOpen(false)
                setPage(page)
              }}
              googleNotice={googleNotice}
              onConsumeGoogleNotice={onConsumeGoogleNotice}
            />
          </div>
        </div>
      )}
    </div>
  )
}
