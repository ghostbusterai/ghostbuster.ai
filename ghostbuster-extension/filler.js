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

  // —— Countries and states: "USA", "US" and "United States" are the same answer ——

  const COUNTRY_ALIASES = {
    US: ["USA", "U.S.", "U.S.A.", "United States of America", "America"],
    GB: ["UK", "U.K.", "United Kingdom", "Great Britain", "Britain", "England", "Scotland", "Wales", "Northern Ireland"],
    AE: ["UAE", "United Arab Emirates"],
    KR: ["South Korea", "Korea", "Republic of Korea", "Korea, Republic of"],
    CN: ["PRC", "People's Republic of China"],
    TW: ["Taiwan, Province of China"],
    RU: ["Russian Federation"],
    VN: ["Viet Nam"],
    IR: ["Iran, Islamic Republic of"],
    CZ: ["Czech Republic"],
    TR: ["Turkey", "Türkiye"],
    NL: ["Holland", "The Netherlands"],
    IN: ["Bharat"],
  }
  const US_STATES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
    DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
    IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
    NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
    NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
    PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
    UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
    AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador",
    NS: "Nova Scotia", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan",
  }

  let countryTable = null
  function countries() {
    if (countryTable) return countryTable
    countryTable = []
    let names = null
    try {
      names = new Intl.DisplayNames(["en"], { type: "region" })
    } catch {
      /* very old browser: aliases only */
    }
    const A = 65
    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 26; j++) {
        const code = String.fromCharCode(A + i, A + j)
        let name = ""
        try {
          name = names?.of(code) || ""
        } catch {
          name = ""
        }
        if ((!name || name === code) && !COUNTRY_ALIASES[code]) continue
        countryTable.push({ code, names: [name, ...(COUNTRY_ALIASES[code] || [])].filter(Boolean) })
      }
    }
    return countryTable
  }

  function findCountry(value) {
    const v = norm(value)
    if (!v) return null
    return countries().find((c) => norm(c.code) === v || c.names.some((n) => norm(n) === v)) || null
  }

  function findState(value) {
    const v = norm(value)
    if (!v) return null
    const hit = Object.entries(US_STATES).find(([abbr, name]) => norm(abbr) === v || norm(name) === v)
    return hit ? { code: hit[0], names: [hit[1]] } : null
  }

  /** Every way an answer might be written in a dropdown, e.g. country "USA" → United States, US, USA… */
  function answerTerms(key, value) {
    const region = key === "country" ? findCountry(value) : key === "state" ? findState(value) : null
    if (!region) return { names: [value], codes: [] }
    return { names: region.names, codes: [region.code] }
  }

  /** How well a dropdown option fits the answer: 0 = no match. */
  function optionScore(optionText, key, value) {
    // "United States +1" (phone country pickers) → "united states"
    const o = norm(String(optionText || "").replace(/\(?\+\d[\d\s-]*\)?\s*$/, ""))
    if (!o) return 0
    if (key === "location") {
      const p = state.profile || {}
      const city = norm(p.city)
      if (!city || !o.startsWith(city)) return 0
      const st = findState(p.state)
      let score = 50
      if (st && (o.includes(norm(st.names[0])) || o.split(" ").includes(norm(st.code)))) score += 30
      if (p.country && answerTerms("country", p.country).names.some((n) => o.includes(norm(n)))) score += 10
      return score - o.length / 100
    }
    const { names, codes } = answerTerms(key, value)
    let best = 0
    for (const n of names.map(norm).filter(Boolean)) {
      if (o === n) best = Math.max(best, 100)
      else if (o.startsWith(`${n} `)) best = Math.max(best, 70)
      else if (n.length > 3 && o.includes(n)) best = Math.max(best, 40)
    }
    for (const c of codes.map(norm)) {
      if (o === c) best = Math.max(best, 90)
      // "US - United States", "California (CA)"
      else if (o.startsWith(`${c} `) || o.endsWith(` ${c}`)) best = Math.max(best, 60)
    }
    if (!best && !codes.length && optionMatches(optionText, value)) best = 30
    // Prefer the shortest fit: "United States" over "United States Minor Outlying Islands".
    return best ? best - o.length / 100 : 0
  }

  function bestOption(options, key, value, textOf = (o) => o.textContent) {
    let best = null
    let bestScore = 0
    for (const o of options) {
      const score = Math.max(optionScore(textOf(o), key, value), o.value ? optionScore(o.value, key, value) : 0)
      if (score > bestScore) {
        best = o
        bestScore = score
      }
    }
    return best
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

  function fillElement(el, value, key) {
    if (el instanceof HTMLSelectElement) {
      const opt = bestOption([...el.options].filter((o) => !isPlaceholderOption(o)), key, value)
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

  // Résumés from GhostBuster buckets: one is attached right away; with several, the user picks.
  const offeredPicker = new WeakSet()
  async function offerBucketResumes(el) {
    if (offeredPicker.has(el)) return
    offeredPicker.add(el)
    const resumes = await window.__gbResumePicker.getResumes()
    if (!resumes.length) return false
    const put = (r) => {
      const dt = new DataTransfer()
      dt.items.add(window.__gbResumePicker.toFile(r))
      el.files = dt.files
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
      state.filledCount++
      state.review.delete(CHOOSE_RESUME)
      render()
      report()
    }
    if (resumes.length === 1) {
      put(resumes[0])
      return true
    }
    state.review.set(CHOOSE_RESUME, el)
    render()
    // File inputs are usually hidden behind an "Attach" button; anchor to what the user sees.
    let anchor = el
    while (anchor && anchor !== document.body && !isVisible(anchor)) anchor = anchor.parentElement
    window.__gbResumePicker.show({ anchor, resumes, title: "Which résumé for this application?", onPick: put })
    return true
  }
  const CHOOSE_RESUME = "Choose which résumé to attach"

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
      if (el.getAttribute("role") === "combobox") return // its queued fill reports the outcome
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
      if (!el.files?.length && window.__gbResumePicker && !offeredPicker.has(el)) {
        state.touched.add(el)
        offerBucketResumes(el).then((offered) => {
          // No bucket files: fall back to the résumé saved in the extension's options.
          if (offered === false && attachResume(el)) state.filledCount++
        })
        return
      }
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
      if (comboChosen(el)) {
        state.review.delete(label)
        return
      }
      const key = ruleFor(info.text, hintText(el))
      const value = key ? valueFor(key, state.profile) : ""
      if (value) {
        state.touched.add(el)
        queueCombobox(el, label, key, value, info.required)
      } else if (info.required) {
        state.review.set(label, el)
      }
      return
    }

    if (hasValue(el)) {
      state.questions.delete(label)
      state.review.delete(label)
      return
    }

    const key = el instanceof HTMLTextAreaElement ? null : ruleFor(info.text, hintText(el))
    const value = key ? valueFor(key, state.profile) : ""
    if (value && fillElement(el, value, key)) {
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

  // —— Searchable dropdowns (react-select on Greenhouse, Lever, Ashby…) ——
  // Type the answer, wait for the options (some load from a server), click the best one.
  // One at a time, since an open menu would swallow another dropdown's clicks.

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const comboQueue = []
  let comboBusy = false

  function comboChosen(el) {
    const control = el.closest("[class*='control' i]") || el.parentElement
    return Boolean(control?.querySelector("[class*='single-value' i], [class*='multi-value' i]"))
  }

  function comboOptions(el) {
    const id = el.getAttribute("aria-controls") || el.getAttribute("aria-owns")
    const list = id ? document.getElementById(id) : null
    const scope = list || el.closest("[class*='container' i]") || document
    return [...scope.querySelectorAll('[role="option"]')].filter(
      (o) => isVisible(o) && o.getAttribute("aria-disabled") !== "true"
    )
  }

  // Unlike setNativeValue, no blur: that would close the menu we're about to pick from.
  function typeInto(el, text) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, text)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }

  function comboSearchText(key, value) {
    if (key === "location") return state.profile?.city || value
    if (key === "country") return findCountry(value)?.names[0] || value
    if (key === "state") return findState(value)?.names[0] || value
    return value
  }

  function comboOpen(el) {
    return el.getAttribute("aria-expanded") === "true" || comboOptions(el).length > 0
  }

  // react-select only opens once it believes it has focus, and the browser skips focus events when the
  // window isn't focused, so announce focus ourselves, then try the ways react-select opens its menu.
  async function openCombobox(el) {
    el.focus()
    el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
    const control = el.closest("[class*='control' i]") || el.parentElement
    const attempts = [
      () => el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, view: window })),
      () => control.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, view: window })),
      () => control.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true })),
      () => el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40, bubbles: true, cancelable: true })),
    ]
    for (const attempt of attempts) {
      if (comboOpen(el)) return true
      try {
        attempt()
      } catch {
        /* TouchEvent is missing on some desktop builds */
      }
      await sleep(150)
    }
    return comboOpen(el)
  }

  async function fillCombobox(el, key, value) {
    await openCombobox(el)
    // First see if the full list already has it (short Yes/No lists), then search.
    for (const text of ["", comboSearchText(key, value)]) {
      if (text) typeInto(el, text)
      for (let i = 0; i < (text ? 20 : 3); i++) {
        await sleep(150)
        const opt = bestOption(comboOptions(el), key, value)
        if (opt) {
          opt.scrollIntoView?.({ block: "nearest" })
          opt.click()
          await sleep(100)
          if (comboChosen(el) || !comboOptions(el).length) return true
        }
      }
    }
    typeInto(el, "")
    el.blur()
    return false
  }

  function queueCombobox(el, label, key, value, required) {
    comboQueue.push({ el, label, key, value, required })
    if (!comboBusy) runComboQueue()
  }

  async function runComboQueue() {
    comboBusy = true
    while (comboQueue.length) {
      const { el, label, key, value, required } = comboQueue.shift()
      if (!el.isConnected) continue
      let ok = false
      try {
        ok = comboChosen(el) || (await fillCombobox(el, key, value))
      } catch (e) {
        console.warn("GhostBuster Autofill skipped a dropdown:", e)
      }
      if (ok) {
        state.filledCount++
        state.review.delete(label)
      } else if (required) {
        state.review.set(label, el)
      }
      render()
      report()
    }
    comboBusy = false
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
