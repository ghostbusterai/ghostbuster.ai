const pdfParse = require("pdf-parse")
const mammoth = require("mammoth")

const MAX_BYTES = 5 * 1024 * 1024

const TEXT_EXT = new Set([".txt", ".md", ".text"])
const PDF_EXT = new Set([".pdf"])
const DOCX_EXT = new Set([".docx"])

function extOf(name) {
  const i = String(name || "").lastIndexOf(".")
  return i === -1 ? "" : String(name).slice(i).toLowerCase()
}

async function extractResumeText(buffer, originalName) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Empty file")
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("File is too large (max 5 MB)")
  }

  const ext = extOf(originalName)

  if (TEXT_EXT.has(ext)) {
    return buffer.toString("utf8").replace(/^\uFEFF/, "")
  }

  if (PDF_EXT.has(ext)) {
    const parsed = await pdfParse(buffer)
    return typeof parsed.text === "string" ? parsed.text : ""
  }

  if (DOCX_EXT.has(ext)) {
    const { value } = await mammoth.extractRawText({ buffer })
    return typeof value === "string" ? value : ""
  }

  throw new Error("Unsupported file type — use PDF, DOCX, TXT, or MD")
}

module.exports = { extractResumeText, MAX_BYTES }
