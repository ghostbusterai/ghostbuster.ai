const fs = require("fs")
const path = require("path")

const DATA_DIR = path.join(__dirname, "data")
const DATA_FILE = path.join(DATA_DIR, "app-data.json")

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        { contacts: [], reminders: [], outreachLogs: [], resumeUpdates: [], profile: { lastResumeUpdate: "" } },
        null,
        2
      )
    )
  }
}

function read() {
  ensureFile()
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
  return {
    contacts: Array.isArray(raw.contacts) ? raw.contacts : [],
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    outreachLogs: Array.isArray(raw.outreachLogs) ? raw.outreachLogs : [],
    resumeUpdates: Array.isArray(raw.resumeUpdates) ? raw.resumeUpdates : [],
    profile:
      raw.profile && typeof raw.profile === "object"
        ? { lastResumeUpdate: raw.profile.lastResumeUpdate || "" }
        : { lastResumeUpdate: "" },
  }
}

function write(data) {
  ensureFile()
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

module.exports = { read, write, DATA_FILE }
