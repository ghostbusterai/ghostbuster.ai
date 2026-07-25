import React, { useEffect, useMemo, useRef, useState } from "react"
import { font } from "../theme"

const COLORS = ["#b8ff57", "#5be4d8", "#ffc96b", "#ff6b9d", "#b482ff", "#ffffff"]

function makePieces(count) {
  return Array.from({ length: count }, (_, i) => {
    const left = Math.random() * 100
    const delay = Math.random() * 0.8
    const duration = 2.4 + Math.random() * 1.8
    const size = 6 + Math.random() * 8
    const rotate = Math.random() * 360
    const drift = (Math.random() - 0.5) * 120
    const color = COLORS[i % COLORS.length]
    const round = Math.random() > 0.55
    return { id: i, left, delay, duration, size, rotate, drift, color, round }
  })
}

/**
 * Full-page confetti rain + toast for first-contact celebration.
 */
export default function FirstContactCelebration({ onDone }) {
  const pieces = useMemo(() => makePieces(72), [])
  const [visible, setVisible] = useState(true)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const hideToast = window.setTimeout(() => setVisible(false), 4200)
    const done = window.setTimeout(() => onDoneRef.current?.(), 5200)
    return () => {
      window.clearTimeout(hideToast)
      window.clearTimeout(done)
    }
  }, [])

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes gb-confetti-fall {
          0% {
            transform: translate3d(0, -12vh, 0) rotate(var(--gb-rot));
            opacity: 1;
          }
          85% { opacity: 1; }
          100% {
            transform: translate3d(var(--gb-drift), 110vh, 0) rotate(calc(var(--gb-rot) + 720deg));
            opacity: 0;
          }
        }
        @keyframes gb-celebrate-in {
          0% { opacity: 0; transform: translate(-50%, -12px) scale(0.94); }
          18% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          78% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -8px) scale(0.98); }
        }
      `}</style>

      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.55,
            borderRadius: p.round ? "50%" : 2,
            background: p.color,
            boxShadow: `0 0 8px ${p.color}55`,
            "--gb-rot": `${p.rotate}deg`,
            "--gb-drift": `${p.drift}px`,
            animation: `gb-confetti-fall ${p.duration}s linear ${p.delay}s forwards`,
            willChange: "transform, opacity",
          }}
        />
      ))}

      {visible && (
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: "50%",
            transform: "translateX(-50%)",
            animation: "gb-celebrate-in 4.2s ease forwards",
            background: "var(--gb-bg-elevated)",
            border: "1px solid var(--gb-accent-border)",
            boxShadow: "var(--gb-shadow-panel)",
            borderRadius: 16,
            padding: "16px 22px",
            maxWidth: "min(420px, calc(100vw - 40px))",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: font.h1,
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "-0.02em",
              color: "var(--gb-text)",
              lineHeight: 1.35,
            }}
          >
            Yay! You&apos;ve added your first contact!
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: font.body,
              fontSize: 13,
              color: "var(--gb-text-muted)",
              lineHeight: 1.45,
            }}
          >
            Your network starts here.
          </div>
        </div>
      )}
    </div>
  )
}
