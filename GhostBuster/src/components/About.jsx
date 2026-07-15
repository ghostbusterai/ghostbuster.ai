import React from "react"
import { font, accentNeon, neonAlpha } from "../theme"
import GhostBusterLogo from "./GhostBusterLogo"
import { FOUNDERS, PRODUCT_FEATURES, PRODUCT_MISSION, PRODUCT_TAGLINE, SITE_URL } from "../aboutContent"

function founderInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
}

function FounderCard({ founder }) {
  const { name, role, tagline, bio, photo, links = {} } = founder
  const hasPhoto = typeof photo === "string" && photo.trim()
  const linkEntries = [
    links.linkedin ? { label: "LinkedIn", href: links.linkedin } : null,
    links.github ? { label: "GitHub", href: links.github } : null,
  ].filter(Boolean)

  return (
    <article
      style={{
        background: "#111118",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "24px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 14,
            background: neonAlpha(0.12),
            border: `1px solid ${neonAlpha(0.25)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 22,
            color: accentNeon,
            flexShrink: 0,
            overflow: "hidden",
          }}
          aria-hidden={!hasPhoto}
        >
          {hasPhoto ? (
            <img
              src={photo.trim()}
              alt={name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            founderInitials(name)
          )}
        </div>
        <div>
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" }}>
            {name}
          </div>
          <div style={{ fontSize: 12, fontFamily: font.mono, color: accentNeon, letterSpacing: "0.08em", marginTop: 2 }}>
            {role.toUpperCase()}
          </div>
        </div>
      </div>

      {tagline ? (
        <div style={{ fontSize: 13, fontFamily: font.mono, color: "rgba(240,240,245,0.45)" }}>{tagline}</div>
      ) : null}

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "rgba(240,240,245,0.62)", flex: 1 }}>
        {bio}
      </p>

      {linkEntries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
          {linkEntries.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                fontFamily: font.mono,
                color: "rgba(240,240,245,0.55)",
                textDecoration: "none",
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </article>
  )
}

export default function About() {
  return (
    <div style={{ width: "100%", maxWidth: 960, minWidth: 0 }}>
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: font.mono,
            letterSpacing: "0.14em",
            color: "rgba(240,240,245,0.3)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          About us
        </div>
        <h1 style={{ fontFamily: font.display, fontWeight: 800, fontSize: 36, letterSpacing: "-1px", marginBottom: 12 }}>
          GhostBuster
        </h1>
        <p style={{ color: "rgba(240,240,245,0.55)", fontSize: 16, fontFamily: font.body, lineHeight: 1.65, maxWidth: 680 }}>
          {PRODUCT_TAGLINE}
        </p>
      </div>

      <section
        style={{
          marginBottom: 48,
          padding: "28px 26px",
          borderRadius: 18,
          background: `linear-gradient(135deg, ${neonAlpha(0.08)} 0%, rgba(17,17,24,0.95) 55%)`,
          border: `1px solid ${neonAlpha(0.18)}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: accentNeon,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GhostBusterLogo size={22} />
          </span>
          <div
            style={{
              fontFamily: font.mono,
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "rgba(240,240,245,0.4)",
              textTransform: "uppercase",
            }}
          >
            Our mission
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "rgba(240,240,245,0.65)", maxWidth: 720 }}>
          {PRODUCT_MISSION}
        </p>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "-0.4px",
            marginBottom: 8,
          }}
        >
          What you can do
        </h2>
        <p style={{ margin: "0 0 22px 0", fontSize: 14, color: "rgba(240,240,245,0.42)", lineHeight: 1.55 }}>
          Everything in GhostBuster is built around one goal: help you show up thoughtfully, not just once.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: 14,
          }}
        >
          {PRODUCT_FEATURES.map((feature) => (
            <div
              key={feature.title}
              style={{
                background: "#111118",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14,
                padding: "18px 16px",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 10 }} aria-hidden>
                {feature.icon}
              </div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                {feature.title}
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "rgba(240,240,245,0.5)" }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "-0.4px",
            marginBottom: 8,
          }}
        >
          Co-founders
        </h2>
        <p style={{ margin: "0 0 22px 0", fontSize: 14, color: "rgba(240,240,245,0.42)", lineHeight: 1.55 }}>
          GhostBuster is built by students, for students navigating professional networking.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 16,
          }}
        >
          {FOUNDERS.map((founder) => (
            <FounderCard key={founder.name} founder={founder} />
          ))}
        </div>
      </section>

      <footer
        style={{
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: 13,
          fontFamily: font.mono,
          color: "rgba(240,240,245,0.35)",
        }}
      >
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(240,240,245,0.5)", textDecoration: "none" }}
        >
          {SITE_URL.replace(/^https?:\/\//, "")}
        </a>
      </footer>
    </div>
  )
}
