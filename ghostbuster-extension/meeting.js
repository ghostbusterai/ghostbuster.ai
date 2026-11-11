/**
 * Runs on Google Meet, Zoom (web client), and Microsoft Teams (web). When you join a call, offers to
 * take notes with Ghostwriter. "Start notes" opens GhostBuster's Ghostwriter page with the meeting's
 * name filled in; recording starts there with one click (browsers only let a page capture audio
 * after you click on it). Asks once per meeting, never records anything by itself, and can be
 * turned off with "Don't ask again".
 */
;(() => {
  if (window.__gbMeeting) return
  window.__gbMeeting = true

  const PLATFORMS = [
    {
      name: "Google Meet",
      host: /(^|\.)meet\.google\.com$/,
      // A meeting code path (abc-defg-hij) plus the red "Leave call" button means you're in the call.
      inCall: () =>
        /^\/[a-z]{3,}-[a-z]{3,}-[a-z]{3,}/i.test(location.pathname) &&
        Boolean(document.querySelector('[aria-label*="Leave call" i], [aria-label*="leave the call" i]')),
      title: () => {
        const t = document.title.replace(/^Meet\s*[-–:]\s*/i, "").trim()
        return t && !/^google meet$/i.test(t) ? t : ""
      },
      key: () => location.pathname.split("/")[1],
    },
    {
      name: "Zoom",
      host: /(^|\.)zoom\.us$/,
      inCall: () =>
        /\/wc\//.test(location.pathname) &&
        Boolean(document.querySelector('.footer__leave-btn, button[aria-label*="Leave" i], button[aria-label*="End" i]')),
      title: () => {
        const t = (document.querySelector(".meeting-info-container__title, .meeting-title")?.textContent || "").trim()
        return t || document.title.replace(/\s*[-|]\s*Zoom.*$/i, "").trim()
      },
      key: () => (location.pathname.match(/\/wc\/(?:join\/)?(\d+)/) || [])[1] || location.pathname,
    },
    {
      name: "Microsoft Teams",
      host: /(^|\.)teams\.(microsoft|live)\.com$/,
      inCall: () =>
        Boolean(
          document.querySelector(
            '#hangup-button, [data-tid="hangup-main-btn"], [data-tid="call-hangup"], button[aria-label^="Leave" i], button[aria-label*="Hang up" i]'
          )
        ),
      title: () => document.title.replace(/\s*\|\s*Microsoft Teams.*$/i, "").replace(/^\(\d+\)\s*/, "").trim(),
      key: () => location.pathname + location.hash.split("?")[0],
    },
  ]

  const platform = PLATFORMS.find((p) => p.host.test(location.hostname))
  if (!platform) return

  const LOGO_SVG = `<svg class="logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="rgba(184,255,87,0.28)" stroke="#b8ff57" stroke-width="3"/>
    <path d="M 26.5 52 L 47 63 L 67.5 52 L 67.5 80.5 L 26.5 80.5 Z" fill="#8fd636"/>
    <path d="M 42 61.5 C 33.5 60 28.5 52.5 29.5 43.5 C 30.5 35 37 28.5 46 27.5 C 56.5 26.5 66 31 68.5 40 C 70.5 47.5 66 54.5 58 57.5 C 52 59.5 46 61 42 61.5 Z" stroke="#b8ff57" stroke-width="3" stroke-linejoin="round" fill="#ffffff"/>
    <path d="M 26.5 63 V 80.5 H 67.5 V 63 Z" fill="#b8ff57"/>
    <path d="M 26.5 52 L 47 63 L 67.5 52" stroke="#b8ff57" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="45.5" cy="36" r="2.2" fill="#0a0f09"/><circle cx="55" cy="37.5" r="2.2" fill="#0a0f09"/>
    <path d="M 48 42.5 H 57" stroke="#0a0f09" stroke-width="2.1" stroke-linecap="round"/>
  </svg>`

  const alive = () => Boolean(chrome.runtime?.id)
  const asked = new Set() // meeting keys already offered in this tab
  let host = null
  let hideTimer = null

  function close() {
    clearTimeout(hideTimer)
    host?.remove()
    host = null
  }

  function show(meetingTitle) {
    close()
    host = document.createElement("div")
    host.dataset.gbMeeting = "1"
    host.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;"
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .box { width:300px; padding:14px; border-radius:12px; background:#0a0f09; color:#e5e7eb;
          border:1px solid rgba(184,255,87,.35); box-shadow:0 10px 30px rgba(0,0,0,.35); font-size:13px; }
        .head { display:flex; align-items:center; gap:8px; font-weight:600; color:#fff; font-size:14px; }
        .logo { width:22px; height:22px; flex-shrink:0; }
        .x { margin-left:auto; background:none; border:none; color:#9ca3af; font-size:16px; cursor:pointer; padding:0 2px; }
        .sub { color:#9ca3af; margin:6px 0 12px; line-height:1.4; }
        .sub b { color:#e5e7eb; font-weight:600; }
        .row { display:flex; gap:8px; }
        button.primary { flex:1; padding:8px 10px; border-radius:8px; border:none; background:#b8ff57; color:#0a0f09;
          font-weight:700; cursor:pointer; font-size:13px; }
        button.secondary { padding:8px 10px; border-radius:8px; border:1px solid #1f2937; background:#111827; color:#e5e7eb;
          cursor:pointer; font-size:13px; }
        .never { display:block; margin-top:10px; background:none; border:none; padding:0; color:#6b7280;
          font-size:11px; cursor:pointer; text-decoration:underline; }
      </style>
      <div class="box" role="dialog" aria-label="Take notes with Ghostwriter">
        <div class="head">${LOGO_SVG}<span>Take notes with Ghostwriter?</span>
          <button class="x" type="button" aria-label="Close">×</button></div>
        <div class="sub"></div>
        <div class="row">
          <button class="primary" type="button">Start notes</button>
          <button class="secondary" type="button">Not now</button>
        </div>
        <button class="never" type="button">Don't ask again on ${platform.name}</button>
      </div>`
    const sub = shadow.querySelector(".sub")
    sub.append("GhostBuster will open Ghostwriter for ")
    const b = document.createElement("b")
    b.textContent = meetingTitle || `this ${platform.name} call`
    sub.append(b, ". Click Start there to record live notes and get an AI summary.")

    shadow.querySelector(".primary").addEventListener("click", () => {
      close()
      if (!alive()) return
      chrome.runtime.sendMessage({
        type: "START_GHOSTWRITER",
        meeting: { title: meetingTitle, platform: platform.name, url: location.href },
      })
    })
    shadow.querySelector(".secondary").addEventListener("click", close)
    shadow.querySelector(".x").addEventListener("click", close)
    shadow.querySelector(".never").addEventListener("click", () => {
      close()
      if (alive()) chrome.storage.local.set({ [`gwPromptOff:${platform.name}`]: true })
    })
    document.documentElement.appendChild(host)
    hideTimer = setTimeout(close, 60000) // don't linger over the call
  }

  async function check() {
    if (!alive()) return clearInterval(timer) // extension reloaded; a fresh copy takes over
    if (host || !platform.inCall()) return
    const key = platform.key()
    if (!key || asked.has(key)) return
    asked.add(key)
    const off = await chrome.storage.local.get(`gwPromptOff:${platform.name}`).catch(() => ({}))
    if (off[`gwPromptOff:${platform.name}`]) return
    // Give the meeting a moment to settle (title loads after the call UI).
    setTimeout(() => alive() && show(platform.title()), 1500)
  }

  // Meeting apps are single-page apps that rebuild their UI constantly; a light poll is cheaper and
  // more reliable than watching every DOM mutation.
  const timer = setInterval(check, 2000)
  check()
})()
