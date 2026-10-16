/**
 * Fills job application forms (Workday, Greenhouse, Lever, Ashby) from the GhostBuster autofill profile.
 *
 * Rules this script never breaks:
 *  - It never clicks Next, Submit, or any button. The user reviews and submits every application.
 *  - It never overwrites a value that is already in a field.
 *  - Written answers are never invented: required text questions it can't answer from the
 *    profile are reported back so GhostBuster can ping the user.
 */
;(() => {
  if (window.__gbFillerLoaded) return
  window.__gbFillerLoaded = true

  // Order matters: the first matching rule wins.
  const RULES = [
    // Yes/no and self-ID questions first: their long labels mention words like "country" or "name".
    { key: "needsSponsorship", re: /sponsor/, anyLength: true },
    {
      key: "workAuthorized",
      anyLength: true,
      re: /authori[sz]ed to work|eligible to work|work authori[sz]ation|right to work|legally (authorized|permitted|able)/,
    },
    { key: "gender", re: /\bgender\b/, anyLength: true },
    { key: "ethnicity", re: /\brace\b|ethnic|hispanic|latin/, anyLength: true },
    { key: "veteran", re: /veteran/, anyLength: true },
    { key: "disability", re: /disabilit/, anyLength: true },
    { key: "preferredName", re: /preferred (first )?name|nick ?name/ },
    { key: "firstName", re: /\b(first|given)\s*name\b/ },
    { key: "lastName", re: /\b(last|family)\s*name\b|\bsurname\b/ },
    { key: "fullName", re: /\bfull name\b|\blegal name\b|^\s*name\s*$|\byour name\b/, exclude: /pronounc|signature/ },
    { key: "email", re: /e-?mail/ },
    { key: "phone", re: /\bphone\b|\bmobile\b|\bcell\b/, exclude: /type|code|extension|\bext\b/ },
    { key: "linkedin", re: /linked\s?in/ },
    { key: "github", re: /git\s?hub/ },
    { key: "website", re: /website|portfolio|personal (site|url)|other (url|link|website)/ },
    { key: "location", re: /^\s*location\b|current location|where are you (located|based)/ },
    { key: "addressLine1", re: /address( line)? ?1\b|\bstreet\b|^\s*address\b/, exclude: /e-?mail|line ?2/ },
    { key: "city", re: /\bcity\b/ },
    { key: "state", re: /\bstate\b|\bprovince\b/, exclude: /statement|united states/ },
    { key: "postalCode", re: /\bzip\b|postal/ },
    { key: "country", re: /\bcountry\b/, exclude: /code/ },
    { key: "school", re: /\bschool\b|universit|college|institution/ },
    { key: "degree", re: /\bdegree\b/ },
    { key: "major", re: /\bmajor\b|field of study|discipline|concentration/ },
    { key: "graduationDate", re: /graduat|grad date/ },
    { key: "gpa", re: /\bgpa\b|grade point/ },
    { key: "currentCompany", re: /current (company|employer)|most recent (company|employer)|^\s*(company|org)\b/ },
    { key: "currentTitle", re: /current (job )?(title|role|position)|^\s*job title/ },
  ]

  const QUESTION_RE = /\?|\bwhy\b|describe|tell us|explain|share|cover letter|additional information|anything else/
  const LONG_LABEL = 90

  const state = {
    job: null,
    profile: null,
    resumeFile: null,
    touched: new WeakSet(),
    filledCount: 0,
    questions: new Map(), // label -> element
    review: new Map(), // label -> element
    seenQuestions: new Set(),
    reviewed: false,
    submitted: false,
    lastReport: "",
    status: "", // shown while following the job to its form
  }

  // —— Label + value helpers ——

  function clean(s) {
    return String(s || "")
      .replace(/[*✱]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  function textOf(node) {
    return node ? node.textContent || "" : ""
  }

  // First non-empty source wins (label[for] and aria-label usually repeat each other).
  function labelInfo(el) {
    const sources = [
      () => (el.id ? textOf(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) : ""),
      () =>
        (el.getAttribute("aria-labelledby") || "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => textOf(document.getElementById(id)))
          .join(" "),
      () => el.getAttribute("aria-label") || "",
      () => {
        const wrapping = el.closest("label")
        return textOf(wrapping?.querySelector(".application-label") || wrapping)
      },
      () => {
        // Nearest ancestor (a few levels up) that holds a label for this field.
        let node = el.parentElement
        for (let i = 0; node && i < 5; i++, node = node.parentElement) {
          const l = node.querySelector(".application-label, legend, label, [class*='label' i]")
          if (l && textOf(l).trim()) return textOf(l)
        }
        return ""
      },
      () => el.placeholder || "",
    ]
    let raw = ""
    for (const source of sources) {
      raw = source()
      if (raw.trim()) break
    }
    return {
      text: clean(raw),
      required: el.required || el.getAttribute("aria-required") === "true" || /[*✱]/.test(raw),
    }
  }

  function hintText(el) {
    return [el.name, el.getAttribute("data-automation-id"), el.id]
      .filter(Boolean)
      .join(" ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_\-[\]]+/g, " ")
      .toLowerCase()
  }

  function ruleFor(label, hint) {
    // Long labels are usually open questions; only eligibility / self-ID rules apply to them.
    const candidates = []
    if (label) candidates.push({ text: label.toLowerCase(), long: label.length > LONG_LABEL })
    if (hint) candidates.push({ text: hint, long: false })
    for (const { text, long } of candidates) {
      const rule = RULES.find(
        (r) => (!long || r.anyLength) && r.re.test(text) && !(r.exclude && r.exclude.test(text))
      )
      if (rule) return rule.key
    }
    return null
  }

  function valueFor(key, p) {
    if (!p) return ""
    switch (key) {
      case "fullName":
        return [p.firstName, p.lastName].filter(Boolean).join(" ")
      case "preferredName":
        return p.preferredName || p.firstName || ""
      case "location":
        return [p.city, p.state].filter(Boolean).join(", ") || p.country || ""
      default:
        return p[key] || ""
    }
  }

  function isVisible(el) {
    return el.offsetParent !== null || el.getClientRects().length > 0
  }

  function norm(s) {
    return clean(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  }

  function isPlaceholderOption(opt) {
    if (!opt) return true
    const t = norm(opt.textContent)
    return !opt.value || !t || /^(select|choose|please select|--)/.test(t)
  }

  function optionMatches(optionText, value) {
    const o = norm(optionText)
    const v = norm(value)
    if (!o || !v) return false
    if (v === "yes" || v === "no") return o === v || o.startsWith(`${v} `)
    return o === v || o.includes(v) || (o.length > 3 && v.includes(o))
  }

  // React / Workday ignore plain `.value =`; go through the native setter and fire the events they listen for.
  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
    el.dispatchEvent(new Event("blur"))
  }

  function fillElement(el, value) {
    if (el instanceof HTMLSelectElement) {
      const opt = [...el.options].find((o) => !isPlaceholderOption(o) && optionMatches(o.textContent, value))
      if (!opt) return false
      setNativeValue(el, opt.value)
      return true
    }
    setNativeValue(el, value)
    return true
  }

  function hasValue(el) {
    if (el instanceof HTMLSelectElement) return !isPlaceholderOption(el.selectedOptions[0])
    return String(el.value || "").trim() !== ""
  }

  // —— Résumé upload ——

  // Decoded by hand: page CSPs often block fetch() of data: URLs.
  function dataUrlToBytes(dataUrl) {
    const binary = atob(String(dataUrl).split(",")[1] || "")
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  function attachResume(el) {
    if (!state.resumeFile?.dataUrl || el.files?.length) return false
    const file = new File([dataUrlToBytes(state.resumeFile.dataUrl)], state.resumeFile.name || "resume.pdf", {
      type: state.resumeFile.type || "application/pdf",
    })
    const dt = new DataTransfer()
    dt.items.add(file)
    el.files = dt.files
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    return true
  }

  function isResumeInput(el) {
    const text = `${labelInfo(el).text.toLowerCase()} ${hintText(el)}`
    if (/cover letter/.test(text) && !/resume|résumé|\bcv\b/.test(text)) return false
    return /resume|résumé|\bcv\b|file upload/.test(text)
  }

  // —— Radio groups (yes/no, EEO) ——

  function radioGroups() {
    const groups = new Map()
    for (const r of document.querySelectorAll('input[type="radio"]')) {
      if (!isVisible(r) && !isVisible(r.parentElement || r)) continue
      const key = r.name || r.closest('[role="radiogroup"], fieldset')?.id || ""
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(r)
    }
    return [...groups.values()]
  }

  function groupLabel(radios) {
    let raw = ""
    const container = radios[0].closest('fieldset, [role="radiogroup"]')
    if (container) {
      const by = container.getAttribute("aria-labelledby")
      raw =
        textOf(container.querySelector("legend")) ||
        (by ? textOf(document.getElementById(by)) : "") ||
        container.getAttribute("aria-label") ||
        ""
    }
    if (!raw.trim()) {
      const field = radios[0].closest(".application-question, .field, [class*='question' i]")
      raw = textOf(field?.querySelector(".application-label, legend, [class*='label' i]"))
    }
    return { text: clean(raw), required: /[*✱]/.test(raw) }
  }

  // —— One pass over the page ——

  function fillPass() {
    for (const el of document.querySelectorAll("input, textarea, select")) {
      try {
        fillOne(el)
      } catch (e) {
        console.warn("GhostBuster Autofill skipped a field:", e)
      }
    }
    try {
      fillRadios()
      flagWorkdayDropdowns()
    } catch (e) {
      console.warn("GhostBuster Autofill:", e)
    }

    // Drop entries whose fields left the page (Workday step changes).
    for (const map of [state.questions, state.review]) {
      for (const [label, el] of map) if (!el.isConnected) map.delete(label)
    }

    if ([...state.questions.keys()].some((q) => !state.seenQuestions.has(q))) {
      state.reviewed = false
    }
    for (const q of state.questions.keys()) state.seenQuestions.add(q)

    render()
    report()
  }

  function fillOne(el) {
    if (el.disabled || el.readOnly) return
    if (state.touched.has(el)) {
      // Autocompletes (e.g. Lever's location) clear typed text until an option is picked.
      if (el.type !== "file" && isVisible(el) && !hasValue(el)) {
        const info = labelInfo(el)
        if (info.required && info.text) state.review.set(info.text, el)
      }
      return
    }
    const type = (el.getAttribute("type") || "").toLowerCase()
    if (["hidden", "submit", "button", "reset", "image", "search", "password", "radio", "checkbox"].includes(type)) return

    if (type === "file") {
      if (!isResumeInput(el)) return
      if (attachResume(el)) {
        state.touched.add(el)
        state.filledCount++
      } else if (!el.files?.length) {
        state.review.set("Attach your résumé (add it in the extension options to attach it automatically)", el)
      }
      return
    }

    if (!isVisible(el) || el.getAttribute("aria-hidden") === "true" || el.tabIndex < 0) return
    const info = labelInfo(el)
    // Unlabeled inputs are widget internals (e.g. react-select's hidden required input); nothing to match.
    if (!info.text && !hintText(el).trim()) return
    const label = info.text || el.placeholder || "Untitled question"

    if (el.getAttribute("role") === "combobox") {
      const control = el.closest("[class*='control' i]")
      const chosen = control?.querySelector("[class*='single-value' i], [class*='multi-value' i]")
      if (info.required && !chosen && !el.value) state.review.set(label, el)
      else state.review.delete(label)
      return
    }

    if (hasValue(el)) {
      state.questions.delete(label)
      state.review.delete(label)
      return
    }

    const key = el instanceof HTMLTextAreaElement ? null : ruleFor(info.text, hintText(el))
    const value = key ? valueFor(key, state.profile) : ""
    if (value && fillElement(el, value)) {
      state.touched.add(el)
      state.filledCount++
      state.questions.delete(label)
      state.review.delete(label)
      return
    }

    if (key || el instanceof HTMLSelectElement) {
      if (info.required) state.review.set(label, el)
    } else if (info.required) {
      state.questions.set(label, el)
    } else if (el instanceof HTMLTextAreaElement && QUESTION_RE.test(label.toLowerCase())) {
      state.review.set(`Optional: ${label}`, el)
    }
  }

  function fillRadios() {
    for (const radios of radioGroups()) {
      const { text: label, required } = groupLabel(radios)
      if (!label) continue
      if (radios.some((r) => r.checked)) {
        state.review.delete(label)
        continue
      }
      const key = ruleFor(label, "")
      const value = key ? valueFor(key, state.profile) : ""
      const pick =
        value && radios.find((r) => optionMatches(labelInfo(r).text, value) || optionMatches(r.value, value))
      if (pick && !state.touched.has(pick)) {
        pick.click()
        state.touched.add(pick)
        state.filledCount++
        state.review.delete(label)
      } else if (required || radios.some((r) => r.required)) {
        state.review.set(label, radios[0])
      }
    }
  }

  // Workday's custom dropdowns are buttons; leave the choice to the user.
  function flagWorkdayDropdowns() {
    for (const btn of document.querySelectorAll('button[aria-haspopup="listbox"]')) {
      if (!isVisible(btn)) continue
      const info = labelInfo(btn)
      if (!info.text) continue
      if (/^select one$/i.test(clean(btn.textContent)) && info.required) state.review.set(info.text, btn)
      else state.review.delete(info.text)
    }
  }

  function report() {
    if (!state.job) return
    const payload = {
      filledCount: state.filledCount,
      questions: [...state.questions.keys()],
      reviewItems: [...state.review.keys()],
      reviewed: state.reviewed,
      submitted: state.submitted,
      pageUrl: window.location.href,
    }
    const key = JSON.stringify(payload)
    if (key === state.lastReport) return
    state.lastReport = key
    chrome.runtime.sendMessage({ type: "FILL_REPORT", report: payload })
  }

  // —— Review panel ——

  let host = null
  let collapsed = false

  function render() {
    if (!host) {
      host = document.createElement("div")
      host.id = "ghostbuster-autofill"
      host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647"
      host.attachShadow({ mode: "open" })
      document.body.appendChild(host)
    }
    const root = host.shadowRoot
    const q = [...state.questions.keys()]
    const r = [...state.review.keys()]
    const list = (items, kind) =>
      items.map((t, i) => `<li><button class="link" data-kind="${kind}" data-i="${i}">${escapeHtml(t)}</button></li>`).join("")

    root.innerHTML = `
      <style>
        .card{width:320px;max-height:70vh;overflow:auto;background:#10140f;color:#e9f0e4;border:1px solid #3c4a33;
          border-radius:12px;padding:14px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35)}
        .head{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:14px}
        p{margin:8px 0}
        h4{margin:12px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#b8ff57}
        h4.warn{color:#ffcf5c}
        ul{margin:0;padding-left:18px}
        li{margin:3px 0}
        .link{all:unset;cursor:pointer;text-decoration:underline;color:inherit}
        .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
        .btn{all:unset;cursor:pointer;padding:6px 10px;border-radius:8px;border:1px solid #3c4a33;font-size:12px}
        .primary{background:#b8ff57;color:#0a0f09;border-color:#b8ff57;font-weight:700}
        .icon{all:unset;cursor:pointer;padding:0 4px;font-size:16px}
        .pill{all:unset;cursor:pointer;background:#b8ff57;color:#0a0f09;font:700 13px system-ui,sans-serif;
          padding:9px 14px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.3)}
      </style>
      ${
        collapsed
          ? `<button class="pill" data-act="expand">GhostBuster${state.status ? ` · ${escapeHtml(state.status)}` : q.length ? ` · ${q.length} to answer` : ""}</button>`
          : `<div class="card">
        <div class="head"><span>GhostBuster Autofill</span><button class="icon" data-act="collapse" title="Minimize">–</button></div>
        ${
          state.profile && !state.job && !state.filledCount
            ? `<p>This looks like a job application. Click <strong>Fill this page</strong> to fill it from your GhostBuster profile. GhostBuster never submits for you.</p>`
            : state.profile
            ? `<p>Filled ${state.filledCount} field${state.filledCount === 1 ? "" : "s"}. Review every answer before you submit. GhostBuster never submits for you.</p>`
            : `<p>Open GhostBuster once while signed in so the extension has your autofill profile.</p>`
        }
        ${q.length ? `<h4 class="warn">Needs your answer (${q.length})</h4><ul>${list(q, "q")}</ul>` : ""}
        ${r.length ? `<h4>Check before submitting (${r.length})</h4><ul>${list(r, "r")}</ul>` : ""}
        ${state.submitted ? `<p>Marked as submitted in GhostBuster.</p>` : state.reviewed ? `<p>Marked as reviewed in GhostBuster.</p>` : ""}
        <div class="row">
          ${state.profile ? `<button class="btn primary" data-act="fill">Fill this page</button>` : ""}
          ${
            state.job
              ? `<button class="btn" data-act="reviewed">I reviewed it</button><button class="btn" data-act="submitted">I submitted it</button>`
              : ""
          }
        </div>
      </div>`
      }`

    root.querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", () => {
        const act = b.dataset.act
        if (act === "collapse" || act === "expand") {
          collapsed = act === "collapse"
          render()
        } else if (act === "fill") {
          fillPass()
        } else if (act === "reviewed" || act === "submitted") {
          state.reviewed = true
          if (act === "submitted") state.submitted = true
          render()
          report()
        }
      })
    )
    root.querySelectorAll("[data-kind]").forEach((b) =>
      b.addEventListener("click", () => {
        const map = b.dataset.kind === "q" ? state.questions : state.review
        const el = [...map.values()][Number(b.dataset.i)]
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
        el?.focus?.()
      })
    )
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
  }

  // Needs two signals, so a newsletter email box on a careers page doesn't count.
  function looksLikeApplicationForm() {
    if (document.querySelector('[data-automation-id*="legalName"]')) return true
    const inputs = [...document.querySelectorAll("input")].filter((el) => el.type === "file" || isVisible(el))
    const keys = new Set()
    for (const el of inputs) {
      if (el.type === "file") keys.add("file")
      else if (el.type === "password") keys.add("password")
      else {
        const key = ruleFor(labelInfo(el).text, hintText(el))
        if (["email", "firstName", "lastName", "fullName", "phone"].includes(key)) {
          keys.add(key === "lastName" || key === "fullName" ? "firstName" : key)
        }
      }
    }
    return keys.size >= 2
  }

  // —— Following the job to its form ——

  // Exact button texts only, so nav links and "Submit" are never clicked.
  const APPLY_RE =
    /^(apply|apply now|apply here|apply online|apply for (this|the) (job|position|role)|apply to (this|the) (job|position|role)|apply on (the )?company (site|website)|start (your |an )?application|begin application|application|apply manually|i'?m interested)$/i
  const NEVER_RE = /easy apply|submit|with linkedin|with indeed|with resume|last application|sign ?in|log ?in/i
  const ATS_HOST_RE =
    /myworkdayjobs\.com|myworkdaysite\.com|greenhouse\.io|lever\.co|ashbyhq\.com|icims\.com|smartrecruiters\.com|jobvite\.com|workable\.com|taleo\.net|successfactors\.|bamboohr\.com|recruitee\.com|breezy\.hr|jazzhr\.com|applytojob\.com/i

  const clickedApply = new Set()
  let applySearches = 0

  function controlText(el) {
    return clean(el.textContent || el.value || el.getAttribute("aria-label") || "")
  }

  function findApplyControl() {
    const candidates = [...document.querySelectorAll('a, button, [role="button"], input[type="button"]')].filter((el) => {
      if (!isVisible(el) || (host && host.contains(el))) return false
      const t = controlText(el)
      return t.length <= 40 && APPLY_RE.test(t) && !NEVER_RE.test(t) && !clickedApply.has(`${location.href}|${t}`)
    })
    return (
      candidates.find((el) => /apply manually/i.test(controlText(el))) ||
      candidates.find((el) => el.href && ATS_HOST_RE.test(el.href)) ||
      candidates[0] ||
      null
    )
  }

  // A careers page that embeds the form in an ATS iframe: the filler runs inside that frame instead.
  function hasEmbeddedApplication() {
    return [...document.querySelectorAll("iframe")].some((f) => ATS_HOST_RE.test(f.src || ""))
  }

  function looksLikeSignIn() {
    return Boolean(document.querySelector('input[type="password"]'))
  }

  function setStatus(text) {
    state.status = text
    collapsed = true
    render()
  }

  async function followToForm() {
    if (window !== window.top || hasEmbeddedApplication()) return
    const control = findApplyControl()
    if (!control) {
      applySearches++
      if (applySearches >= 4) setStatus("Click Apply. GhostBuster will keep filling.")
      return
    }
    const resp = await chrome.runtime.sendMessage({ type: "APPLY_HOP" }).catch(() => null)
    if (!resp?.ok) {
      setStatus("Click Apply. GhostBuster will keep filling.")
      return
    }
    clickedApply.add(`${location.href}|${controlText(control)}`)
    setStatus("Opening the application…")
    control.click()
  }

  // —— Startup ——

  let manualFillRequested = false

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "FILL_NOW") return
    if (state.profile) {
      collapsed = false
      fillPass()
    } else {
      manualFillRequested = true
    }
  })

  chrome.runtime.sendMessage({ type: "GET_JOB" }, (resp) => {
    if (chrome.runtime.lastError || !resp) return
    state.job = resp.job
    state.profile = resp.profile
    state.resumeFile = resp.resumeFile

    if (manualFillRequested && state.profile) fillPass()

    // Auto-fill only tabs GhostBuster opened; elsewhere, offer a button.
    let timer = null
    const maybeRun = () => {
      if (!looksLikeApplicationForm()) {
        if (state.job) followToForm()
        return
      }
      if (state.job) {
        if (state.status) {
          state.status = ""
          collapsed = false
        }
        if (looksLikeSignIn()) state.review.set("Sign in or create your account, then GhostBuster keeps filling", document.querySelector('input[type="password"]'))
        else state.review.delete("Sign in or create your account, then GhostBuster keeps filling")
        fillPass()
      } else if (!host) {
        // Opened outside GhostBuster: offer to fill (or say what's missing), but don't fill until the user clicks.
        collapsed = false
        render()
      }
    }
    // Give single-page careers sites a moment to render before looking for Apply.
    setTimeout(maybeRun, 1200)
    new MutationObserver((mutations) => {
      if (host && mutations.every((m) => host.contains(m.target))) return
      clearTimeout(timer)
      timer = setTimeout(maybeRun, 700)
    }).observe(document.body, { childList: true, subtree: true })
  })
})()
