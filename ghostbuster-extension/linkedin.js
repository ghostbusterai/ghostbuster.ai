/**
 * Runs on linkedin.com. On a profile page (/in/<handle>/) it shows a "Save to GhostBuster" pill.
 * Clicking it opens a small card prefilled from the page the user is viewing; nothing is read or sent
 * until they press Save. With "Auto-save" on (a checkbox on that card), each profile the user opens is
 * saved after a few seconds unless they cancel. Either way only profiles they open are used — no
 * crawling, no background visits.
 *
 * LinkedIn is a single-page app with changing class names, so every field has fallbacks and the user
 * can correct anything before saving.
 */
;(() => {
  if (window.__gbLinkedIn) return
  window.__gbLinkedIn = true

  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim()

  function profileUrl() {
    const m = window.location.pathname.match(/^\/in\/([^/]+)/)
    return m ? `https://www.linkedin.com/in/${decodeURIComponent(m[1])}/` : null
  }

  function firstText(selectors, root = document) {
    for (const sel of selectors) {
      const t = text(root.querySelector(sel))
      if (t) return t
    }
    return ""
  }

  // Lines of visible text: LinkedIn puts the visible copy in span[aria-hidden="true"] and repeats it in a
  // visually hidden span for screen readers; without those spans, fall back to the rendered lines.
  function visibleLines(el) {
    let lines = [...el.querySelectorAll('span[aria-hidden="true"]')].map(text).filter(Boolean)
    if (!lines.length) lines = (el.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean)
    return lines.filter((l, i) => l !== lines[i - 1])
  }

  // Found by its anchor id, or by a heading reading "Experience" / "Education" when the ids change.
  function findSection(id, heading) {
    const byId = document.getElementById(id)?.closest("section")
    if (byId) return byId
    const re = new RegExp(`^${heading}$`, "i")
    for (const h of document.querySelectorAll("main h2, main h3, section h2")) {
      if (re.test(visibleLines(h)[0] || text(h))) return h.closest("section") || h.parentElement?.parentElement
    }
    return null
  }

  function sectionEntries(id, heading) {
    const section = findSection(id, heading)
    if (!section) return []
    const items = section.querySelectorAll('li, [data-view-name="profile-component-entity"]')
    const entries = []
    for (const li of items) {
      if (li.parentElement?.closest("li") && entries.length) continue // nested roles are read with their parent
      const texts = visibleLines(li).filter((t) => !/^(show all|see more|…see more)/i.test(t))
      if (texts.length) entries.push({ el: li, texts })
    }
    return entries
  }

  const DURATION = /\b\d+\s*(yrs?|mos?|years?|months?)\b|present|\b(19|20)\d{2}\b/i

  /** Most recent job from Experience: { role, company, current }. */
  function latestJob() {
    const first = sectionEntries("experience", "Experience")[0]
    if (!first) return null
    const t = first.texts
    // Several roles at one company: [Company, "Full-time · 3 yrs", …] then the roles nested below.
    if (t[1] && DURATION.test(t[1]) && !/·.*·/.test(t[1]) && first.el.querySelector("li")) {
      const nested = [...first.el.querySelectorAll("li")]
        .map((li) => [...li.querySelectorAll('span[aria-hidden="true"]')].map(text).filter(Boolean))
        .find((x) => x.length)
      return { company: t[0], role: nested?.[0] || "", current: /present/i.test(t.join(" ")) }
    }
    // One role: [Title, "Company · Full-time", "Jan 2023 - Present · 2 yrs", "Location"]
    return {
      role: t[0] || "",
      company: (t[1] || "").split(/\s+·\s+/)[0],
      current: /present/i.test(t.slice(1, 4).join(" ")),
    }
  }

  /** Most recent school: { school, degree }. */
  function latestSchool() {
    const first = sectionEntries("education", "Education")[0]
    if (!first) return null
    const degree = first.texts[1] && !DURATION.test(first.texts[1]) ? first.texts[1] : ""
    return { school: first.texts[0] || "", degree }
  }

  function readProfile() {
    const main = document.querySelector("main") || document
    // The tab title ("Jane Doe | LinkedIn") is the most stable place for the name; LinkedIn's newer
    // layout has no h1 and puts the name in an h2.
    const titleName = (document.title.split("|")[0] || "").replace(/^\(\d+\)\s*/, "").trim()
    const headings = [...main.querySelectorAll("h1, h2")]
    let nameEl = headings.find((h) => titleName && text(h) === titleName) || main.querySelector("h1")
    let name = (nameEl && text(nameEl)) || (/^linkedin$/i.test(titleName) ? "" : titleName)

    // Top card: the lines under the name, in on-screen order, e.g.
    // [name, "She/Her", "· 3rd", headline, location, "·", "Contact info", "Apple + 2 more", "500+", "connections", …]
    let card = nameEl?.parentElement
    for (let i = 0; card && i < 8 && (card.innerText || "").split("\n").filter(Boolean).length < 6; i++) card = card.parentElement
    const cardLines = card ? (card.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean) : []
    const NOISE = /^(·.*|she\/her|he\/him|they\/them|she\/they|he\/they|\d(st|nd|rd|th)|contact info|connections?|followers?|message|follow|following|connect|save|more|pending|\d[\d,+]*)$/i
    // Pronouns and connection degree ("She/Her · 3rd") can share one line.
    const isNoise = (l) => NOISE.test(l) || /^(she|he|they)\/(her|him|them|they)\b/i.test(l) || /·\s*\d(st|nd|rd|th)\b/i.test(l)
    const lines = cardLines.slice(Math.max(0, cardLines.indexOf(name)) + 1).filter((l) => !isNoise(l))

    let headline = firstText([".text-body-medium.break-words", "[data-generated-suggestion-target]"], main) || lines[0] || ""
    let location =
      firstText([".text-body-small.inline.t-black--light.break-words"], main) ||
      lines.find((l) => l !== headline && /,/.test(l) && !/@| at |\+ \d+ more$/i.test(l) && l.length < 80) ||
      ""
    location = location.replace(/\s*·\s*contact info.*$/i, "")
    // "Apple + 2 more" is the current-company line; it comes after "Contact info".
    const afterContact = cardLines.slice(cardLines.findIndex((l) => /^contact info$/i.test(l)) + 1)
    const companyLine =
      cardLines.find((l) => /\s\+\s\d+\s+more$/i.test(l)) ||
      (cardLines.some((l) => /^contact info$/i.test(l)) ? afterContact.find((l) => !isNoise(l) && !/followed by|mutual/i.test(l)) : "") ||
      ""
    const cardCompany = companyLine.replace(/\s\+\s\d+\s+more$/i, "").trim()

    let company = ""
    const companyBtn = main.querySelector('button[aria-label^="Current company"], a[aria-label^="Current company"]')
    if (companyBtn) {
      company = (companyBtn.getAttribute("aria-label") || "")
        .replace(/^Current company:\s*/i, "")
        .replace(/\.\s*Click.*$/i, "")
        .trim()
    }

    if (!company) company = cardCompany
    // Prefer the Experience section; fall back to "Software Engineer at Acme" in the headline.
    let role = ""
    const job = latestJob()
    if (job?.role) {
      role = job.role
      if (!company) company = job.company
    }
    const at = headline.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s*[|·•,].*)?$/i)
    if (!role) role = at ? at[1].trim() : headline.split(/\s*[|·•]\s*/)[0]
    if (!company && at) company = at[2].trim()

    const edu = latestSchool()
    return {
      name,
      company: company.slice(0, 120),
      role: role.slice(0, 120),
      location,
      headline,
      school: edu?.school || "",
      degree: edu?.degree || "",
      pastJob: job && !job.current ? `Last listed role has ended: ${job.role} at ${job.company}` : "",
    }
  }

  function notesFor(p) {
    return [
      p.headline && p.headline !== p.role ? p.headline : "",
      p.location,
      p.school ? [p.degree, p.school].filter(Boolean).join(", ") : "",
      p.pastJob,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 500)
  }


  // Same mark as the app header (GhostBuster/src/components/GhostBusterLogo.jsx), dark-theme colors.
  const LOGO_SVG = `<svg class="logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="rgba(184,255,87,0.28)" stroke="#b8ff57" stroke-width="3"/>
    <path d="M 26.5 52 L 47 63 L 67.5 52 L 67.5 80.5 L 26.5 80.5 Z" fill="#8fd636"/>
    <path d="M 42 61.5 C 33.5 60 28.5 52.5 29.5 43.5 C 30.5 35 37 28.5 46 27.5 C 56.5 26.5 66 31 68.5 40 C 70.5 47.5 66 54.5 58 57.5 C 52 59.5 46 61 42 61.5 Z" stroke="#b8ff57" stroke-width="3" stroke-linejoin="round" fill="#ffffff"/>
    <path d="M 26.5 63 V 80.5 H 67.5 V 63 Z" fill="#b8ff57"/>
    <path d="M 26.5 63 V 80.5 H 67.5 V 63" stroke="#b8ff57" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 26.5 52 L 47 63 L 67.5 52" stroke="#b8ff57" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 26.5 52 H 67.5" stroke="#b8ff57" stroke-width="3" stroke-linecap="round"/>
    <circle cx="45.5" cy="36" r="2.2" fill="#0a0f09"/>
    <circle cx="55" cy="37.5" r="2.2" fill="#0a0f09"/>
    <path d="M 48 42.5 H 57" stroke="#0a0f09" stroke-width="2.1" stroke-linecap="round"/>
  </svg>`

  // ---- UI (shadow DOM so LinkedIn's styles don't leak in) ----
  const host = document.createElement("div")
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483646;"
  const shadow = host.attachShadow({ mode: "open" })
  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .pill { display:flex; align-items:center; gap:8px; padding:10px 16px; border-radius:999px; border:none;
        background:#111827; color:#fff; font-size:13px; font-weight:600; cursor:pointer;
        box-shadow:0 6px 20px rgba(0,0,0,.25); }
      .pill:hover { background:#1f2937; }
      .card { width:300px; padding:14px; border-radius:12px; background:#111827; color:#e5e7eb;
        box-shadow:0 10px 30px rgba(0,0,0,.35); font-size:13px; }
      .card h3 { display:flex; align-items:center; gap:8px; margin:0 0 10px; font-size:14px; color:#fff; }
      .logo { width:22px; height:22px; flex-shrink:0; }
      label { display:block; font-size:11px; color:#9ca3af; margin:8px 0 3px; }
      input, textarea { width:100%; padding:7px 9px; border-radius:7px; border:1px solid #374151;
        background:#1f2937; color:#fff; font-size:13px; }
      textarea { resize:vertical; min-height:48px; }
      .row { display:flex; gap:8px; margin-top:12px; }
      button.act { flex:1; padding:8px; border-radius:8px; border:none; font-weight:600; cursor:pointer; font-size:13px; }
      .save { background:#b8ff57; color:#0a0f09; } .save:disabled { opacity:.6; cursor:default; }
      .cancel { background:#374151; color:#e5e7eb; }
      .msg { margin-top:10px; font-size:12px; color:#a7f3d0; }
      .msg.err { color:#fca5a5; }
      .check { display:flex; align-items:center; gap:7px; margin:10px 0 0; font-size:12px; color:#d1d5db; cursor:pointer; }
      .check input { width:auto; margin:0; accent-color:#b8ff57; }
      .toast { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:12px; background:#111827;
        color:#e5e7eb; font-size:13px; box-shadow:0 6px 20px rgba(0,0,0,.25); max-width:320px; }
      .toast button { background:none; border:none; color:#b8ff57; font-weight:600; cursor:pointer; font-size:13px; padding:0; }
      .hidden { display:none; }
    </style>
    <div class="toast hidden">${LOGO_SVG}<span class="toast-text"></span><button type="button" class="toast-btn"></button></div>
    <button class="pill" type="button">${LOGO_SVG}<span>Save to GhostBuster</span></button>
    <form class="card hidden">
      <h3>${LOGO_SVG}<span>Save contact to GhostBuster</span></h3>
      <label>Name</label><input name="name" required maxlength="120" />
      <label>Company</label><input name="company" maxlength="120" />
      <label>Role</label><input name="role" maxlength="120" />
      <label>Notes</label><textarea name="notes" maxlength="500"></textarea>
      <label class="check"><input type="checkbox" name="auto" /> Auto-save every profile I open</label>
      <div class="row">
        <button class="act cancel" type="button">Cancel</button>
        <button class="act save" type="submit">Save</button>
      </div>
      <div class="msg hidden"></div>
    </form>
  `
  const pill = shadow.querySelector(".pill")
  const form = shadow.querySelector("form")
  const msg = shadow.querySelector(".msg")
  const saveBtn = shadow.querySelector(".save")
  const toast = shadow.querySelector(".toast")
  const toastText = shadow.querySelector(".toast-text")
  const toastBtn = shadow.querySelector(".toast-btn")
  const AUTO_DELAY_MS = 4000

  let autoSave = false
  chrome.storage.local.get(["linkedinAutoSave"], (r) => {
    autoSave = Boolean(r?.linkedinAutoSave)
    form.elements.auto.checked = autoSave
    lastPath = null // re-run for the current page now that we know the setting
  })
  form.elements.auto.addEventListener("change", () => {
    autoSave = form.elements.auto.checked
    chrome.storage.local.set({ linkedinAutoSave: autoSave })
  })

  function contactFromPage() {
    const p = readProfile()
    return {
      name: p.name,
      company: p.company,
      role: p.role,
      notes: notesFor(p),
      linkedin: profileUrl(),
    }
  }

  function sendContact(contact, done) {
    chrome.runtime.sendMessage({ type: "SAVE_CONTACT", contact }, (resp) => {
      if (chrome.runtime.lastError || !resp?.ok) return done(false)
      chrome.storage.local.get(["linkedinSaved"], (r) => {
        const saved = r?.linkedinSaved || []
        if (!saved.includes(contact.linkedin)) {
          chrome.storage.local.set({ linkedinSaved: [...saved, contact.linkedin].slice(-2000) })
        }
      })
      done(true, resp.delivered)
    })
  }

  function showToast(textValue, buttonLabel, onButton) {
    toastText.textContent = textValue
    toastBtn.textContent = buttonLabel || ""
    toastBtn.classList.toggle("hidden", !buttonLabel)
    toastBtn.onclick = onButton || null
    pill.classList.add("hidden")
    form.classList.add("hidden")
    toast.classList.remove("hidden")
  }

  function hideToast() {
    toast.classList.add("hidden")
    if (form.classList.contains("hidden")) pill.classList.remove("hidden")
  }

  // Your own profile has edit controls; never save yourself.
  function isOwnProfile() {
    return [...document.querySelectorAll("main button, main a")].some((b) =>
      /add profile section|open to work|edit intro|enhance profile/i.test(b.textContent || b.getAttribute("aria-label") || "")
    )
  }

  let autoTimer = null
  async function autoSaveProfile(path) {
    // LinkedIn fills the page in after navigation; wait for the name.
    let contact = null
    for (let i = 0; i < 20; i++) {
      if (window.location.pathname !== path) return
      contact = contactFromPage()
      // Give the Experience section a moment too; it can render after the top card.
      if (contact.name && ((contact.company && contact.role) || i >= 6)) break
      await new Promise((r) => setTimeout(r, 500))
    }
    if (!contact?.name || isOwnProfile()) return
    const { linkedinSaved } = await chrome.storage.local.get(["linkedinSaved"])
    if ((linkedinSaved || []).includes(contact.linkedin)) {
      showToast(`${contact.name} is already in GhostBuster`)
      setTimeout(hideToast, 2500)
      return
    }
    showToast(`Adding ${contact.name} to GhostBuster…`, "Cancel", () => {
      clearTimeout(autoTimer)
      showToast("Not saved")
      setTimeout(hideToast, 1500)
    })
    clearTimeout(autoTimer)
    autoTimer = setTimeout(() => {
      if (window.location.pathname !== path) return hideToast()
      sendContact(contactFromPage(), (ok, delivered) => {
        showToast(ok ? (delivered ? `Saved ${contact.name} ✓` : `Saved ${contact.name} — added when GhostBuster opens`) : "Couldn't save. Reload the page.")
        setTimeout(hideToast, 2500)
      })
    }, AUTO_DELAY_MS)
  }

  function showMsg(t, err = false) {
    msg.textContent = t
    msg.className = `msg${err ? " err" : ""}`
  }

  function openCard() {
    const p = readProfile()
    form.elements.name.value = p.name
    form.elements.company.value = p.company
    form.elements.role.value = p.role
    form.elements.notes.value = notesFor(p)
    msg.className = "msg hidden"
    saveBtn.disabled = false
    pill.classList.add("hidden")
    form.classList.remove("hidden")
    form.elements.name.focus()
  }

  function closeCard() {
    form.classList.add("hidden")
    pill.classList.remove("hidden")
  }

  pill.addEventListener("click", openCard)
  shadow.querySelector(".cancel").addEventListener("click", closeCard)
  form.addEventListener("submit", (e) => {
    e.preventDefault()
    const linkedin = profileUrl()
    const contact = {
      name: form.elements.name.value.trim(),
      company: form.elements.company.value.trim(),
      role: form.elements.role.value.trim(),
      notes: form.elements.notes.value.trim(),
      linkedin,
    }
    if (!contact.name) return showMsg("Add a name first.", true)
    saveBtn.disabled = true
    sendContact(contact, (ok, delivered) => {
      if (!ok) {
        saveBtn.disabled = false
        return showMsg("Couldn't reach the extension. Reload this page and try again.", true)
      }
      showMsg(
        delivered
          ? "Saved to your GhostBuster contacts."
          : "Saved. It'll be added to your contacts the next time you open GhostBuster."
      )
      setTimeout(closeCard, 2200)
    })
  })

  // LinkedIn navigates without reloading; show the pill only on profile pages.
  let lastPath = null
  function sync() {
    if (window.location.pathname === lastPath) return
    lastPath = window.location.pathname
    const onProfile = Boolean(profileUrl())
    if (onProfile && !host.isConnected) document.documentElement.appendChild(host)
    if (!onProfile && host.isConnected) host.remove()
    clearTimeout(autoTimer)
    toast.classList.add("hidden")
    closeCard()
    if (onProfile && autoSave) autoSaveProfile(lastPath)
  }
  sync()
  setInterval(sync, 800)
})()
