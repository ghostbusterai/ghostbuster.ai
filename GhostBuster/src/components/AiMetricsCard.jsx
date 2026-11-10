import React, { useEffect, useState } from "react"
import { api } from "../api"
import { font } from "../theme"
import { sectionCard, secondaryBtn } from "../uiStyles"

const fmtMs = (n) => (n == null ? "–" : n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`)
const fmtUsd = (n) => (n == null ? "–" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`)
const pct = (n) => `${Math.round((n || 0) * 100)}%`

function Stat({ label, value }) {
  return (
    <div style={{ minWidth: 92 }}>
      <div style={{ fontSize: 11, color: "var(--gb-text-faint)", fontFamily: font.mono, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gb-text-strong)" }}>{value}</div>
    </div>
  )
}

/** Admin-only: latency, cost, prompt-cache hits, and errors for Claude calls (from aiLog.js). */
export default function AiMetricsCard({ embedded }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api
      .getMe()
      .then((me) => setIsAdmin(Boolean(me?.isAdmin)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    setError("")
    api
      .getAiMetrics(days)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load"))
  }, [isAdmin, days])

  if (!isAdmin) return null
  const o = data?.overall
  const cell = { padding: "4px 6px" }
  return (
    <div style={sectionCard("var(--gb-border-subtle)", embedded)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--gb-text-strong)", fontFamily: font.h1 }}>AI metrics</strong>
        <span style={{ fontSize: 12, color: "var(--gb-text-faint)" }}>Admin only · excludes demo accounts</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              style={{ ...secondaryBtn(), padding: "4px 10px", fontSize: 12, opacity: d === days ? 1 : 0.6 }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      {error && <p style={{ color: "var(--gb-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      {o && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
            <Stat label="Calls" value={o.calls} />
            <Stat label="p50" value={fmtMs(o.p50LatencyMs)} />
            <Stat label="p95" value={fmtMs(o.p95LatencyMs)} />
            <Stat label="Cost" value={fmtUsd(o.totalCostUsd)} />
            <Stat label="Avg/call" value={fmtUsd(o.avgCostUsd)} />
            <Stat label="Cache hits" value={pct(o.cacheHitRate)} />
            <Stat label="Errors" value={pct(o.errorRate)} />
          </div>
          {data.byRoute.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "var(--gb-text)" }}>
                <thead>
                  <tr style={{ color: "var(--gb-text-faint)", textAlign: "left" }}>
                    {["Route", "Calls", "p50", "p95", "Avg cost", "Cache", "Errors"].map((h) => (
                      <th key={h} style={{ ...cell, fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byRoute.map((r) => (
                    <tr key={r.key} style={{ borderTop: "1px solid var(--gb-border-subtle)" }}>
                      <td style={{ ...cell, fontFamily: font.mono }}>{r.key}</td>
                      <td style={cell}>{r.calls}</td>
                      <td style={cell}>{fmtMs(r.p50LatencyMs)}</td>
                      <td style={cell}>{fmtMs(r.p95LatencyMs)}</td>
                      <td style={cell}>{fmtUsd(r.avgCostUsd)}</td>
                      <td style={cell}>{pct(r.cacheHitRate)}</td>
                      <td style={cell}>{r.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {o.calls === 0 && (
            <p style={{ fontSize: 13, color: "var(--gb-text-muted)", margin: 0 }}>No AI calls in this period yet.</p>
          )}
        </>
      )}
    </div>
  )
}
