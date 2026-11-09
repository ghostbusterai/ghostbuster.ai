/**
 * Runs on Gmail. When the email you're writing mentions a résumé or CV, offers your GhostBuster résumés
 * and attaches the one you pick to that email. It only looks at drafts you're typing; it never reads your
 * inbox and never sends anything.
 *
 * Gmail's markup isn't documented, so attaching tries the ways Gmail accepts files: dropping them on the
 * message body (what dragging a file in does), then its hidden file input.
 */
;(() => {
  if (window.__gbGmail) return
  window.__gbGmail = true

  const MENTION = /\b(r[eé]sum[eé]s?|cv|curriculum vitae)\b/i
  const handled = new WeakSet() // compose bodies where the user attached or closed the offer

  function composeBody(target) {
    const el = target?.closest?.('[contenteditable="true"]')
    if (!el) return null
    // Gmail's message body is a textbox; skip the subject line and other inputs.
    if (el.getAttribute("role") !== "textbox" && !el.getAttribute("g_editable")) return null
    return el
  }

  function composeRoot(body) {
    return body.closest('[role="dialog"], form, .M9, .AD, table') || body.parentElement
  }

  function attach(body, file) {
    const dt = new DataTransfer()
    dt.items.add(file)
    // 1. Drop onto the body, the same as dragging the file in. Gmail cancels drops it handles.
    let dropped = false
    for (const type of ["dragenter", "dragover", "drop"]) {
      const ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })
      body.dispatchEvent(ev)
      if (type === "drop") dropped = ev.defaultPrevented
    }
    if (dropped) return
    // 2. Otherwise Gmail's own file input, when the compose window has one.
    const input = composeRoot(body)?.querySelector('input[type="file"]')
    if (input) {
      try {
        input.files = dt.files
        input.dispatchEvent(new Event("change", { bubbles: true }))
      } catch {
        /* read-only in some builds */
      }
    }
  }

  let checkTimer = null
  document.addEventListener(
    "input",
    (e) => {
      const body = composeBody(e.target)
      if (!body || handled.has(body)) return
      clearTimeout(checkTimer)
      // Wait for a pause in typing so the pop-up doesn't jump around mid-word.
      checkTimer = setTimeout(() => offer(body), 600)
    },
    true
  )

  async function offer(body) {
    if (!chrome.runtime?.id) return // extension reloaded; a fresh copy takes over
    if (handled.has(body) || window.__gbResumePicker.isOpen()) return
    if (!MENTION.test(body.innerText || "")) return
    const resumes = await window.__gbResumePicker.getResumes()
    window.__gbResumePicker.show({
      anchor: body,
      resumes,
      title: "Attach a résumé to this email?",
      onPick: (r) => {
        handled.add(body)
        attach(body, window.__gbResumePicker.toFile(r))
      },
      onDismiss: () => handled.add(body),
    })
  }
})()
