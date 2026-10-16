const params = new URLSearchParams(location.search)
const origin = params.get("origin") || ""
const askAll = params.get("all") === "1"

const siteBtn = document.getElementById("site")
const status = document.getElementById("status")

if (askAll || !origin) {
  document.getElementById("title").textContent = "Let GhostBuster fill applications on any site?"
  document.getElementById("body").textContent =
    "GhostBuster Autofill will be able to read and fill pages on any site, so it can follow a job from a company's careers page to its application form. It only fills tabs you open from GhostBuster or pages where you click Fill, and it never submits."
  siteBtn.hidden = true
} else {
  const body = document.getElementById("body")
  body.append("The job you opened went to ")
  const code = document.createElement("code")
  code.textContent = origin
  body.append(code, ". Allow GhostBuster Autofill to read and fill pages there? It never submits for you.")
}

async function request(origins) {
  status.textContent = ""
  try {
    const granted = await chrome.permissions.request({ origins })
    if (granted) window.close()
    else status.textContent = "Permission wasn't granted. You can allow it later from the extension menu."
  } catch (e) {
    status.textContent = e.message
  }
}

siteBtn.addEventListener("click", () => request([`${origin}/*`]))
document.getElementById("all").addEventListener("click", () => request(["https://*/*", "http://*/*"]))
document.getElementById("no").addEventListener("click", () => window.close())
