const { getSupabase, isSupabaseEnabled } = require("./supabaseAdmin")

/**
 * When Supabase is enabled, require Authorization: Bearer <access_token>.
 * Ensures a profile row exists for new users.
 */
async function requireUser(req, res, next) {
  if (!isSupabaseEnabled()) {
    return next()
  }
  const h = req.headers.authorization
  if (!h || !String(h).startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sign in required" })
  }
  const token = String(h).slice(7).trim()
  if (!token) {
    return res.status(401).json({ error: "Sign in required" })
  }
  try {
    const { data, error } = await getSupabase().auth.getUser(token)
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired session" })
    }
    req.userId = data.user.id
    const sb = getSupabase()
    const { data: prof } = await sb.from("profiles").select("user_id").eq("user_id", data.user.id).maybeSingle()
    if (!prof) {
      const { error: insErr } = await sb
        .from("profiles")
        .insert({ user_id: data.user.id, last_resume_update: "" })
      if (insErr && insErr.code !== "23505") {
        console.error(insErr)
        return res.status(500).json({ error: "Failed to initialize profile" })
      }
    }
    next()
  } catch (e) {
    console.error(e)
    return res.status(401).json({ error: "Session verification failed" })
  }
}

module.exports = { requireUser }
