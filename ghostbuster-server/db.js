const { MongoClient } = require("mongodb")

let client = null
let db = null

async function connectDb() {
  if (db) return db
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI is not set")
  }
  client = new MongoClient(uri)
  await client.connect()
  db = client.db()
  await ensureIndexes(db)
  return db
}

async function ensureIndexes(database) {
  await database.collection("users").createIndex({ googleId: 1 }, { unique: true })
  await database.collection("contacts").createIndex({ userId: 1 })
  await database.collection("reminders").createIndex({ userId: 1 })
  await database.collection("outreachLogs").createIndex({ userId: 1, contactId: 1 })
  await database.collection("resumeUpdates").createIndex({ userId: 1 })
  await database.collection("resumeBuckets").createIndex({ userId: 1 })
  await database.collection("scheduledEmails").createIndex({ status: 1, sendAt: 1 })
  await database.collection("profiles").createIndex({ userId: 1 }, { unique: true })
}

function getDb() {
  if (!db) throw new Error("Database not connected — call connectDb() first")
  return db
}

async function closeDb() {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}

module.exports = { connectDb, getDb, closeDb }
