const PIPELINE_IDS = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]

const CLOSED = new Set(["rejected", "withdrawn", "offer"])

function normalizePipelineStatus(value, fallback = "saved") {
  const s = String(value || fallback).toLowerCase().trim()
  return PIPELINE_IDS.includes(s) ? s : fallback
}

function pipelineFromLegacyStatus(status) {
  return status === "completed" ? "applied" : "saved"
}

function isoDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

module.exports = {
  PIPELINE_IDS,
  CLOSED,
  normalizePipelineStatus,
  pipelineFromLegacyStatus,
  isoDateOnly,
}