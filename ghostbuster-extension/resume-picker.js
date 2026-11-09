/**
 * Shared by filler.js (application forms) and gmail.js (email): a small pop-up listing the résumés
 * saved in GhostBuster buckets. The user picks one and the caller attaches it. Files come from the
 * app (SYNC_RESUMES) and live in chrome.storage.local, so nothing is fetched from the page.
 */
;(() => {
  if (window.__gbResumePicker) return

  const LOGO_SVG = `<svg class="logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="rgba(184,255,87,0.28)" stroke="#b8ff57" stroke-width="3"/>
    <path d="M 26.5 52 L 47 63 L 67.5 52 L 67.5 80.5 L 26.5 80.5 Z" fill="#8fd636"/>
    <path d="M 42 61.5 C 33.5 60 28.5 52.5 29.5 43.5 C 30.5 35 37 28.5 46 27.5 C 56.5 26.5 66 31 68.5 40 C 70.5 47.5 66 54.5 58 57.5 C 52 59.5 46 61 42 61.5 Z" stroke="#b8ff57" stroke-width="3" stroke-linejoin="round" fill="#ffffff"/>
    <path d="M 26.5 63 V 80.5 H 67.5 V 63 Z" fill="#b8ff57"/>
    <path d="M 26.5 52 L 47 63 L 67.5 52" stroke="#b8ff57" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="45.5" cy="36" r="2.2" fill="#0a0f09"/><circle cx="55" cy="37.5" r="2.2" fill="#0a0f09"/>
    <path d="M 48 42.5 H 57" stroke="#0a0f09" stroke-width="2.1" stroke-linecap="round"/>
  </svg>`

  function getResumes() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "GET_RESUMES" }, (resp) => {
          if (chrome.runtime.lastError) return resolve([])
          resolve(resp?.files || [])
        })
      } catch {
        resolve([]) // extension reloaded under this page
      }
    })
  }

  // Decoded by hand: page CSPs often block fetch() of data: URLs.
  function toFile(resume) {
    const [meta, b64] = String(resume.dataUrl || "").split(",")
    const bin = atob(b64 || "")
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const type = resume.mimeType || (meta.match(/data:([^;]+)/) || [])[1] || "application/octet-stream"
    return new File([bytes], resume.fileName || "Resume.pdf", { type })
  }

  let host = null

  function close() {
    host?.remove()
    host = null
  }

  /**
   * Show the chooser next to `anchor`.
   * onPick(resume) attaches it; onDismiss() is called when the user closes it without picking.
   */
  function show({ anchor, resumes, title = "Attach a résumé", onPick, onDismiss }) {
    close()
    host = document.createElement("div")
    host.dataset.gbResumePicker = "1"
    const rect = anchor?.getBoundingClientRect?.() || { left: window.innerWidth - 340, bottom: 80, top: 80 }
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 320))
    const below = rect.bottom + 8 + 260 < window.innerHeight
    host.style.cssText = `position:fixed;left:${left}px;${below ? `top:${rect.bottom + 8}px` : `bottom:${window.innerHeight - rect.top + 8}px`};z-index:2147483647;`
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .box { width:300px; padding:12px; border-radius:12px; background:#0a0f09; color:#e5e7eb;
          border:1px solid rgba(184,255,87,.35); box-shadow:0 10px 30px rgba(0,0,0,.35); font-size:13px; }
        .head { display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:600; color:#fff; }
        .logo { width:20px; height:20px; flex-shrink:0; }
        .x { margin-left:auto; background:none; border:none; color:#9ca3af; font-size:16px; cursor:pointer; padding:0 2px; }
        .opt { display:block; width:100%; text-align:left; padding:8px 10px; margin-top:6px; border-radius:8px;
          border:1px solid #1f2937; background:#111827; color:#fff; cursor:pointer; font-size:13px; }
        .opt:hover { border-color:#b8ff57; }
        .opt small { display:block; color:#9ca3af; font-size:11px; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .empty { color:#9ca3af; font-size:12px; line-height:1.4; }
      </style>
      <div class="box" role="dialog" aria-label="${title}">
        <div class="head">${LOGO_SVG}<span></span><button class="x" type="button" aria-label="Close">×</button></div>
        <div class="list"></div>
      </div>`
    shadow.querySelector(".head span").textContent = title
    const list = shadow.querySelector(".list")
    if (!resumes.length) {
      list.innerHTML = `<div class="empty">No résumé files yet. Upload one to a bucket on GhostBuster's Résumé page, then open GhostBuster once so the extension gets it.</div>`
    }
    for (const r of resumes) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "opt"
      btn.textContent = r.bucketName || "Résumé"
      const small = document.createElement("small")
      small.textContent = r.fileName || ""
      btn.appendChild(small)
      btn.addEventListener("click", () => {
        close()
        onPick?.(r)
      })
      list.appendChild(btn)
    }
    shadow.querySelector(".x").addEventListener("click", () => {
      close()
      onDismiss?.()
    })
    document.documentElement.appendChild(host)
  }

  window.__gbResumePicker = { getResumes, toFile, show, close, isOpen: () => Boolean(host) }
})()
