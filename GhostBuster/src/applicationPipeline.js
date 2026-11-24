export const PIPELINE_STATUSES = [
  { id: "saved", label: "To apply", short: "To apply", tone: "var(--gb-text-muted)" },
  { id: "applied", label: "Applied", short: "Applied", tone: "var(--gb-accent)" },
  { id: "screening", label: "Screening", short: "Screening", tone: "#6eb5ff" },
  { id: "interview", label: "Interview", short: "Interview", tone: "#b482ff" },
  { id: "offer", label: "Offer", short: "Offer", tone: "var(--gb-accent-bright)" },
  { id: "rejected", label: "Rejected", short: "Rejected", tone: "var(--gb-danger)" },
  { id: "withdrawn", label: "Withdrawn", short: "Withdrawn", tone: "var(--gb-text-faint)" },
]

export const PIPELINE_IDS = PIPELINE_STATUSES.map((s) => s.id)

const CLOSED = new Set(["rejected", "withdrawn", "offer"])

export function pipelineMeta(id) {
  return PIPELINE_STATUSES.find((s) => s.id === id) || PIPELINE_STATUSES[0]
}

export function normalizePipelineStatus(value, fallback = "saved") {
  const s = String(value || fallback).toLowerCase().trim()
  return PIPELINE_IDS.includes(s) ? s : fallback
}

export function pipelineFromLegacy(application) {
  if (application?.pipelineStatus) return normalizePipelineStatus(application.pipelineStatus)
  return application?.status === "completed" ? "applied" : "saved"
}

export function isPipelineClosed(id) {
  return CLOSED.has(id)
}

export function withPipelineDefaults(application) {
  if (!application || typeof application !== "object") return application
  return {
    ...application,
    pipelineStatus: pipelineFromLegacy(application),
    portalUrl: typeof application.portalUrl === "string" ? application.portalUrl : "",
    statusNote: typeof application.statusNote === "string" ? application.statusNote : "",
    lastPortalCheck: typeof application.lastPortalCheck === "string" ? application.lastPortalCheck : "",
  }
}

export function portalHref(application) {
  const u = (application?.portalUrl || application?.url || "").trim()
  return u || ""
}