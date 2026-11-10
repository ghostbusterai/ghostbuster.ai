/**
 * LLM observability. Every Claude call is timed and logged with its route, user, token usage
 * (including prompt-cache reads/writes), estimated cost, and outcome:
 *   - as one JSON line on stdout ({"type":"ai_call",...}) for Render / Cloud Logging, and
 *   - in the Mongo `aiCalls` collection (30-day TTL) for the admin metrics endpoint.
 *
 * traceAnthropic() wraps the client once, so call sites don't change. The route and user come from
 * request context set by aiContextMiddleware (AsyncLocalStorage), so nested helpers are covered too.
 */
const { AsyncLocalStorage } = require("node:async_hooks")

const als = new AsyncLocalStorage()

// USD per million tokens. Estimates for reporting only; check current pricing before quoting costs.
const PRICES = [
  { match: /haiku/i, input: 1, output: 5 },
  { match: /opus/i, input: 5, output: 25 },
  { match: /sonnet/i, input: 3, output: 15 },
]
const CACHE_WRITE_MULT = 1.25
const CACHE_READ_MULT = 0.1

function estimateCost(model, usage) {
  const p = PRICES.find((x) => x.match.test(model || "")) || PRICES[2]
  const u = usage || {}
  const usd =
    ((u.input_tokens || 0) * p.input +
      (u.cache_creation_input_tokens || 0) * p.input * CACHE_WRITE_MULT +
      (u.cache_read_input_tokens || 0) * p.input * CACHE_READ_MULT +
      (u.output_tokens || 0) * p.output) /
    1e6
  return Math.round(usd * 1e6) / 1e6
}

/** "/api/ghostwriter/123/summarize" -> "/api/ghostwriter/:id/summarize" */
function normalizeRoute(method, path) {
  const p = String(path || "").replace(/\/\d+(?=\/|$)/g, "/:id").replace(/\/[0-9a-f]{24}(?=\/|$)/gi, "/:id")
  return `${method} ${p}`
}

function aiContextMiddleware(getUserId) {
  return (req, _res, next) => {
    als.run({ route: normalizeRoute(req.method, req.path), userId: getUserId(req), demo: Boolean(req.session?.demo) }, next)
  }
}

/** Run fn with a named context, for calls made outside a request (background jobs, evals). */
function withAiContext(ctx, fn) {
  return als.run({ route: ctx.route || "background", userId: ctx.userId || null, demo: false }, fn)
}

let sink = null // async (row) => void; set to a Mongo insert once the database is connected

function setAiLogSink(fn) {
  sink = fn
}

function record(row) {
  try {
    console.log(JSON.stringify({ type: "ai_call", ...row, createdAt: row.createdAt.toISOString() }))
  } catch {
    /* never let logging break a request */
  }
  if (sink) Promise.resolve(sink(row)).catch((e) => console.warn("aiCalls insert failed:", e.message))
}

function traceAnthropic(client) {
  if (!client || client.__gbTraced) return client
  const original = client.messages.create.bind(client.messages)
  client.messages.create = async (params, options) => {
    const ctx = als.getStore() || { route: "unknown", userId: null, demo: false }
    const started = Date.now()
    const base = {
      route: ctx.route,
      userId: ctx.userId ? String(ctx.userId) : null,
      demo: ctx.demo,
      model: params?.model,
      createdAt: new Date(),
    }
    try {
      const message = await original(params, options)
      const u = message?.usage || {}
      record({
        ...base,
        ok: true,
        latencyMs: Date.now() - started,
        inputTokens: u.input_tokens || 0,
        outputTokens: u.output_tokens || 0,
        cacheReadTokens: u.cache_read_input_tokens || 0,
        cacheWriteTokens: u.cache_creation_input_tokens || 0,
        stopReason: message?.stop_reason || null,
        costUsd: estimateCost(params?.model, u),
      })
      return message
    } catch (err) {
      record({
        ...base,
        ok: false,
        latencyMs: Date.now() - started,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        error: String(err?.status || err?.name || "error"),
        costUsd: 0,
      })
      throw err
    }
  }
  client.__gbTraced = true
  return client
}

function percentile(sorted, p) {
  if (!sorted.length) return null
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[i]
}

function summarize(rows) {
  const lat = rows.map((r) => r.latencyMs).sort((a, b) => a - b)
  const ok = rows.filter((r) => r.ok)
  const cost = rows.reduce((n, r) => n + (r.costUsd || 0), 0)
  const promptTokens = ok.reduce((n, r) => n + r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens, 0)
  const cachedTokens = ok.reduce((n, r) => n + r.cacheReadTokens, 0)
  const outTokens = ok.reduce((n, r) => n + r.outputTokens, 0)
  const okLatencySec = ok.reduce((n, r) => n + r.latencyMs, 0) / 1000
  return {
    calls: rows.length,
    errors: rows.length - ok.length,
    errorRate: rows.length ? +((rows.length - ok.length) / rows.length).toFixed(3) : 0,
    p50LatencyMs: percentile(lat, 50),
    p95LatencyMs: percentile(lat, 95),
    totalCostUsd: +cost.toFixed(4),
    avgCostUsd: rows.length ? +(cost / rows.length).toFixed(5) : 0,
    cacheHitRate: ok.length ? +(ok.filter((r) => r.cacheReadTokens > 0).length / ok.length).toFixed(3) : 0,
    cachedPromptShare: promptTokens ? +(cachedTokens / promptTokens).toFixed(3) : 0,
    outputTokensPerSec: okLatencySec ? +(outTokens / okLatencySec).toFixed(1) : 0,
  }
}

/** Aggregate rows into overall, per-route, and per-day summaries. */
function buildMetrics(rows) {
  const group = (key) => {
    const m = new Map()
    for (const r of rows) {
      const k = key(r)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(r)
    }
    return [...m.entries()].map(([k, list]) => ({ key: k, ...summarize(list) }))
  }
  return {
    overall: summarize(rows),
    byRoute: group((r) => r.route).sort((a, b) => b.calls - a.calls),
    byDay: group((r) => new Date(r.createdAt).toISOString().slice(0, 10)).sort((a, b) => a.key.localeCompare(b.key)),
  }
}

module.exports = {
  traceAnthropic,
  aiContextMiddleware,
  withAiContext,
  setAiLogSink,
  buildMetrics,
  estimateCost,
  normalizeRoute,
}
