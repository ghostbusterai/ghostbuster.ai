import React from "react"
import { font } from "../theme"
import GhostBusterLogo from "./GhostBusterLogo"
import BrandName from "./BrandName"
import { PageShell, PageHero, SectionLabel, ContentCard, CardTitle } from "../layout"
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
        background: "var(--gb-bg-panel)",
        border: "1px solid var(--gb-border-subtle)",
        borderRadius: 14,
        padding: "20px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            background: "var(--gb-accent-soft)",
            border: "1px solid var(--gb-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font.h2,
            fontWeight: 800,
            fontSize: 20,
            color: "var(--gb-accent)",
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
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17, letterSpacing: "-0.3px" }}>
            {name}
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: font.mono,
              color: "var(--gb-accent)",
              letterSpacing: "0.08em",
              marginTop: 3,
            }}
          >
            {role.toUpperCase()}
          </div>
        </div>
      </div>

      {tagline ? (
        <div style={{ fontSize: 12, fontFamily: font.mono, color: "var(--gb-text-dim)", lineHeight: 1.45 }}>
          {tagline}
        </div>
      ) : null}

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--gb-text-muted)", flex: 1 }}>
        {bio}
      </p>

      {linkEntries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
          {linkEntries.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                fontFamily: font.mono,
                color: "var(--gb-text-subtle)",
                textDecoration: "none",
                borderBottom: "1px solid var(--gb-border)",
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
    <PageShell>
      <PageHero eyebrow="About us" title={<BrandName variant="hero" />} subtitle={PRODUCT_TAGLINE} />

      <SectionLabel>Our mission</SectionLabel>
      <ContentCard
        style={{
          background: "var(--gb-accent-soft)",
          border: "1px solid var(--gb-border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "var(--gb-accent-bright)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 0 0 1px var(--gb-border-subtle)",
            }}
          >
            <GhostBusterLogo size={22} />
          </span>
          <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 17 }}>
            Built for student networking
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--gb-text-muted)" }}>
          {PRODUCT_MISSION}
        </p>
      </ContentCard>

      <SectionLabel>What you can do</SectionLabel>
      <ContentCard marginBottom={24}>
        <CardTitle helper="Everything in GhostBuster is built around one goal: help you show up thoughtfully, not just once.">
          Product
        </CardTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
            gap: 12,
          }}
        >
          {PRODUCT_FEATURES.map((feature) => (
            <div
              key={feature.title}
              style={{
                background: "var(--gb-bg-panel)",
                border: "1px solid var(--gb-border-subtle)",
                borderRadius: 12,
                padding: "14px 14px 16px",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 8 }} aria-hidden>
                {feature.icon}
              </div>
              <div style={{ fontFamily: font.h2, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                {feature.title}
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--gb-text-muted)" }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </ContentCard>

      <SectionLabel>Co-founders</SectionLabel>
      <ContentCard marginBottom={24}>
        <CardTitle helper="GhostBuster is built by students, for students navigating professional networking.">
          The team
        </CardTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: 14,
          }}
        >
          {FOUNDERS.map((founder) => (
            <FounderCard key={founder.name} founder={founder} />
          ))}
        </div>
      </ContentCard>

      <footer
        style={{
          paddingTop: 8,
          paddingBottom: 8,
          fontSize: 12,
          fontFamily: font.mono,
          color: "var(--gb-text-faint)",
          textAlign: "center",
        }}
      >
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--gb-text-dim)", textDecoration: "none" }}
        >
          {SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      </footer>
    </PageShell>
  )
}
