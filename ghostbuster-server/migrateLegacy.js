const fs = require("fs")
const path = require("path")
const store = require("./mongoStore")

const LEGACY_FILE = path.join(__dirname, "data", "app-data.json")

/**
 * If MIGRATE_LEGACY_JSON=1 and legacy JSON exists and has not been imported yet,
 * copy that data into the given user once.
 */
async function maybeMigrateLegacyJson(userId) {
  if (String(process.env.MIGRATE_LEGACY_JSON || "").trim() !== "1") return false
  if (await store.hasLegacyMigrated()) return false
  if (!fs.existsSync(LEGACY_FILE)) return false

  let data
  try {
    data = JSON.parse(fs.readFileSync(LEGACY_FILE, "utf8"))
  } catch (e) {
    console.warn("Legacy JSON migration skipped — could not parse app-data.json:", e.message)
    return false
  }

  await store.importLegacyData(userId, data)
  console.log(`Migrated legacy app-data.json into user ${userId}`)
  return true
}

module.exports = { maybeMigrateLegacyJson, LEGACY_FILE }
