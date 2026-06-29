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
        {
          contacts: [],
          reminders: [],
          outreachLogs: [],
          resumeUpdates: [],
          fullResume: null,
          googleCalendar: null,
          resumeBuckets: [],
          profile: { name: "", careerGoals: "", lastResumeUpdate: "" },
        },
        null,
        2
      )
    )
  }
}

function normalizeResumeBucket(raw) {
  if (!raw || typeof raw !== "object") return null
  const text = typeof raw.text === "string" ? raw.text : ""
  return {
    id: Number(raw.id),
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    text,
    fileName: typeof raw.fileName === "string" ? raw.fileName : "",
    uploadedAt: typeof raw.uploadedAt === "string" ? raw.uploadedAt : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
  }
}

function readResumeBuckets(raw) {
  const buckets = Array.isArray(raw.resumeBuckets)
    ? raw.resumeBuckets.map(normalizeResumeBucket).filter((b) => b && b.name && Number.isFinite(b.id))
    : []

  if (buckets.length === 0 && raw.fullResume && typeof raw.fullResume.text === "string" && raw.fullResume.text.trim()) {
    buckets.push({
      id: Date.now(),
      name: "General",
      text: raw.fullResume.text.trim(),
      fileName: typeof raw.fullResume.fileName === "string" ? raw.fullResume.fileName : "",
      uploadedAt: typeof raw.fullResume.uploadedAt === "string" ? raw.fullResume.uploadedAt : new Date().toISOString(),
      createdAt: typeof raw.fullResume.uploadedAt === "string" ? raw.fullResume.uploadedAt : new Date().toISOString(),
    })
  }

  return buckets
}

function read() {
  ensureFile()
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
  const resumeBuckets = readResumeBuckets(raw)
  return {
    contacts: Array.isArray(raw.contacts) ? raw.contacts : [],
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    outreachLogs: Array.isArray(raw.outreachLogs) ? raw.outreachLogs : [],
    resumeUpdates: Array.isArray(raw.resumeUpdates) ? raw.resumeUpdates : [],
    resumeBuckets,
    fullResume:
      raw.fullResume && typeof raw.fullResume === "object" && typeof raw.fullResume.text === "string"
        ? {
            text: raw.fullResume.text,
            fileName: typeof raw.fullResume.fileName === "string" ? raw.fullResume.fileName : "",
            uploadedAt: typeof raw.fullResume.uploadedAt === "string" ? raw.fullResume.uploadedAt : "",
          }
        : resumeBuckets[0]?.text
          ? {
              text: resumeBuckets[0].text,
              fileName: resumeBuckets[0].fileName || "",
              uploadedAt: resumeBuckets[0].uploadedAt || "",
            }
          : null,
    googleCalendar:
      raw.googleCalendar &&
      typeof raw.googleCalendar === "object" &&
      typeof raw.googleCalendar.refreshToken === "string" &&
      raw.googleCalendar.refreshToken
        ? {
            refreshToken: raw.googleCalendar.refreshToken,
            connectedAt:
              typeof raw.googleCalendar.connectedAt === "string"
                ? raw.googleCalendar.connectedAt
                : "",
          }
        : null,
    profile:
      raw.profile && typeof raw.profile === "object"
        ? {
            name: typeof raw.profile.name === "string" ? raw.profile.name : "",
            careerGoals: typeof raw.profile.careerGoals === "string" ? raw.profile.careerGoals : "",
            lastResumeUpdate: raw.profile.lastResumeUpdate || "",
          }
        : { name: "", careerGoals: "", lastResumeUpdate: "" },
  }
}

function write(data) {
  ensureFile()
  if (Array.isArray(data.resumeBuckets) && data.resumeBuckets.length > 0) {
    data.fullResume = null
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

module.exports = { read, write, DATA_FILE }
