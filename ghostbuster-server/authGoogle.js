const { google } = require("googleapis")

const LOGIN_SCOPES = ["openid", "email", "profile"]

function isLoginConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.GOOGLE_LOGIN_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI)
  )
}

function loginRedirectUri() {
  return (
    process.env.GOOGLE_LOGIN_REDIRECT_URI ||
    (process.env.GOOGLE_REDIRECT_URI
      ? String(process.env.GOOGLE_REDIRECT_URI).replace("/api/google/callback", "/api/auth/google/callback")
      : null)
  )
}

function getLoginOAuthClient() {
  if (!isLoginConfigured()) return null
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    loginRedirectUri()
  )
}

function getLoginAuthUrl() {
  const client = getLoginOAuthClient()
  if (!client) throw new Error("Google login is not configured on the server")
  return client.generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: LOGIN_SCOPES,
  })
}

async function exchangeLoginCode(code) {
  const client = getLoginOAuthClient()
  if (!client) throw new Error("Google login is not configured on the server")
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: "v2", auth: client })
  const { data } = await oauth2.userinfo.get()
  if (!data?.id) throw new Error("Could not read Google profile")
  return {
    googleId: data.id,
    email: data.email || "",
    name: data.name || "",
    picture: data.picture || "",
  }
}

module.exports = {
  LOGIN_SCOPES,
  isLoginConfigured,
  getLoginAuthUrl,
  exchangeLoginCode,
  loginRedirectUri,
}
