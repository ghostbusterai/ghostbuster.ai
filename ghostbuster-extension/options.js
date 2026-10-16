const MAX_BYTES = 5 * 1024 * 1024

const current = document.getElementById("current")
const status = document.getElementById("status")

async function show() {
  const { resumeFile } = await chrome.storage.local.get("resumeFile")
  current.textContent = resumeFile ? `${resumeFile.name} (saved ${new Date(resumeFile.savedAt).toLocaleDateString()})` : "None saved."
}

document.getElementById("resume").addEventListener("change", (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > MAX_BYTES) {
    status.textContent = "That file is over 5 MB. Most applications reject files that large."
    return
  }
  const reader = new FileReader()
  reader.onload = async () => {
    await chrome.storage.local.set({
      resumeFile: { name: file.name, type: file.type, dataUrl: reader.result, savedAt: Date.now() },
    })
    status.textContent = "Résumé saved."
    show()
  }
  reader.readAsDataURL(file)
})

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.local.remove("resumeFile")
  status.textContent = "Résumé removed."
  show()
})

show()

// —— Fill the current tab (the toolbar click grants activeTab access to it) ——

const fillStatus = document.getElementById("fillStatus")
document.getElementById("fillTab").addEventListener("click", async () => {
  const { lastProfile } = await chrome.storage.local.get("lastProfile")
  if (!lastProfile) {
    fillStatus.textContent = "Open GhostBuster once while signed in so the extension has your autofill profile."
    return
  }
  const resp = await chrome.runtime.sendMessage({ type: "FILL_ACTIVE_TAB" })
  fillStatus.textContent = resp?.ok ? "Filling. Check the GhostBuster panel on the page." : resp?.error || "Couldn't fill this page."
})

// —— Site access ——

const ALL_SITES = ["https://*/*", "http://*/*"]
const access = document.getElementById("access")
const revoke = document.getElementById("revoke")
const allSitesBtn = document.getElementById("allSites")

async function showAccess() {
  const all = await chrome.permissions.contains({ origins: ALL_SITES })
  const manifestHosts = chrome.runtime.getManifest().content_scripts.flatMap((c) => c.matches)
  const { origins = [] } = await chrome.permissions.getAll()
  const granted = origins.filter((o) => !manifestHosts.includes(o))
  allSitesBtn.hidden = all
  revoke.hidden = !granted.length
  access.textContent = all
    ? "Allowed on all sites. Autofill follows jobs from careers pages to the application form."
    : "Workday, Greenhouse, Lever, and Ashby work out of the box. Other sites ask the first time a job goes there."
}

allSitesBtn.addEventListener("click", async () => {
  await chrome.permissions.request({ origins: ALL_SITES })
  showAccess()
})

revoke.addEventListener("click", async () => {
  const manifestHosts = chrome.runtime.getManifest().content_scripts.flatMap((c) => c.matches)
  const { origins = [] } = await chrome.permissions.getAll()
  await chrome.permissions.remove({ origins: origins.filter((o) => !manifestHosts.includes(o)) })
  showAccess()
})

showAccess()
