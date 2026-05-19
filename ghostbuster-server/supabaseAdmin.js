const { createClient } = require("@supabase/supabase-js")

let _admin = null

function isSupabaseEnabled() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return Boolean(url && String(url).trim() && key && String(key).trim())
}

function getSupabase() {
  if (!isSupabaseEnabled()) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for database mode")
  }
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _admin
}

module.exports = { getSupabase, isSupabaseEnabled }
