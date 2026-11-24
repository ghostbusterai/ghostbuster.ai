const VISIBLE = "gb-scroll-reveal--in"
const REVEAL_SELECTOR = ".gb-scroll-reveal, .gb-reveal-block"

function prefersReducedMotion() {
  if (typeof window === "undefined") return true
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function showAll(root) {
  root.querySelectorAll(REVEAL_SELECTOR).forEach((el) => el.classList.add(VISIBLE))
}

function bindRevealElements(root, observer) {
  const viewportH = window.innerHeight || document.documentElement.clientHeight
  root.querySelectorAll(`${REVEAL_SELECTOR}:not(.${VISIBLE})`).forEach((el) => {
    const rect = el.getBoundingClientRect()
    const alreadyVisible = rect.top < viewportH * 0.92 && rect.bottom > 0
    if (alreadyVisible) {
      el.classList.add(VISIBLE)
    } else {
      observer.observe(el)
    }
  })
}

/**
 * Fade/slide sections into view as the user scrolls (Limma-style blocks). Re-binds when the DOM grows (lists, async data).
 * @param {ParentNode | null} root
 * @returns {() => void} cleanup
 */
export function initScrollReveal(root) {
  if (!root) return () => {}

  if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    showAll(root)
    return () => {}
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add(VISIBLE)
        observer.unobserve(entry.target)
      }
    },
    {
      root: null,
      rootMargin: "0px 0px -5% 0px",
      threshold: 0.08,
    }
  )

  bindRevealElements(root, observer)

  let debounce = 0
  const mutationObserver = new MutationObserver(() => {
    clearTimeout(debounce)
    debounce = window.setTimeout(() => bindRevealElements(root, observer), 80)
  })
  mutationObserver.observe(root, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    mutationObserver.disconnect()
    clearTimeout(debounce)
  }
}