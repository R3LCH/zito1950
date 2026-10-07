import { gsap } from 'gsap'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger, ScrollSmoother)

let smoother: ScrollSmoother | null = null

/** True when GSAP ScrollSmoother drives the page (desktop pointer, motion allowed). */
export function smoothActive(): boolean {
  return smoother !== null
}

/** Freezes page scrolling while a modal layer (menu, dialog) is open. */
export function lockScroll(on: boolean): void {
  if (smoother) smoother.paused(on)
  else document.documentElement.style.overflow = on ? 'hidden' : ''
}

/**
 * Smooth scrolling with ScrollSmoother on mouse/trackpad devices; native scrolling on touch screens
 * and when reduced motion is requested. In-page anchor links land below the fixed header either way.
 * Returns a cleanup function.
 */
export function initSmooth(): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (finePointer && !reduced) {
    smoother = ScrollSmoother.create({ wrapper: '#smooth-wrapper', content: '#smooth-content', smooth: 1.1, effects: false })
  }

  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    const link = (e.target as Element | null)?.closest?.('a[href^="#"]')
    const id = link?.getAttribute('href')?.slice(1)
    const target = id ? document.getElementById(id) : null
    if (!target) return
    e.preventDefault()
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72
    if (smoother) smoother.scrollTo(target, true, `top ${headerH}px`)
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
    if (target.tabIndex >= 0 || target.hasAttribute('tabindex')) target.focus({ preventScroll: true })
  }
  document.addEventListener('click', onClick)

  return () => {
    document.removeEventListener('click', onClick)
    smoother?.kill()
    smoother = null
  }
}
