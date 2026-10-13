import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useContent } from '../lib/i18n'
import { useReveal } from '../lib/useReveal'

/** Split mode: the preview receives the section header and the closed toggle, to place both inside its own text column. */
type PanelPreview = (parts: { header: ReactNode; toggle: ReactNode }) => ReactNode

interface PanelProps {
  id: string
  eyebrow?: string
  title: string
  intro?: ReactNode
  /** Always-visible part of the section; a render function moves the header and the toggle into it. */
  preview?: ReactNode | PanelPreview
  /** Hide the preview while expanded, when the body shows the same items in full. */
  previewOnlyCollapsed?: boolean
  /** Expandable part; no children = a plain section without a toggle. */
  children?: ReactNode
  /** Label of the closed toggle; defaults to "Mostra tutto". */
  moreLabel?: string
  /** Runs right after the opened body rendered; use it to place the viewport on the new content. */
  onOpen?: () => void
}

/** Page section separated by a hairline; the optional body stays `hidden` until opened. */
export default function Panel({ id, eyebrow, title, intro, preview, previewOnlyCollapsed = false, children, moreLabel, onOpen }: PanelProps) {
  const { site } = useContent()
  const ref = useReveal<HTMLElement>()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const titleId = `${id}-title`
  const expandable = children != null

  // Links into the closed body (e.g. #edizioni-limitate) open it first, so the jump lands on the target.
  useEffect(() => {
    if (!expandable) return
    const inBody = (hash: string | null) => {
      if (!hash || hash.length < 2) return null
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      return el && bodyRef.current?.contains(el) ? el : null
    }
    // Scroll once, after the opened body and any hash-driven filters have rendered.
    const scrollTo = (el: Element) => requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
    const initial = inBody(location.hash)
    if (initial) {
      flushSync(() => setOpen(true))
      scrollTo(initial)
    }
    // Capture phase runs before the browser's own hash navigation, which would race our scroll.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]')
      const href = link?.getAttribute('href') ?? null
      const el = inBody(href)
      if (!el || !href) return
      e.preventDefault()
      flushSync(() => setOpen(true))
      if (location.hash !== href) history.pushState(history.state, '', href)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
    const onHash = () => {
      const el = inBody(location.hash)
      if (!el) return
      flushSync(() => setOpen(true))
      scrollTo(el)
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('hashchange', onHash)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('hashchange', onHash)
    }
  }, [expandable])

  const buttonRef = useRef<HTMLButtonElement>(null)
  const toggle = () => {
    if (!open) {
      // Rendering the body synchronously lets onOpen measure it before the browser paints.
      flushSync(() => setOpen(true))
      // Split mode remounts the toggle at the bottom; keep keyboard focus on it.
      if (split) buttonRef.current?.focus({ preventScroll: true })
      onOpen?.()
      return
    }
    // Closing removes the body above the button; keep the button where it was so the reader lands at the end of the collapsed section.
    const before = buttonRef.current?.getBoundingClientRect().top ?? 0
    flushSync(() => setOpen(false))
    const after = buttonRef.current?.getBoundingClientRect().top ?? 0
    window.scrollBy({ top: after - before, behavior: 'instant' })
    if (split) buttonRef.current?.focus({ preventScroll: true })
  }

  const splitPreview = typeof preview === 'function' ? preview : null
  const split = splitPreview !== null
  // In split mode the column, not the prose measure, limits the intro; the title still breaks over three lines.
  const header = (
    <div className={split ? undefined : 'max-w-[60ch]'}>
      {eyebrow && <p className={split ? 'eyebrow text-brand' : 'eyebrow'}>{eyebrow}</p>}
      <h2 id={titleId} className={`${eyebrow ? (split ? 'mt-4 ' : 'mt-3 ') : ''}text-h2 text-ink${split ? ' max-w-[14ch] text-balance' : ''}`}>
        {title}
      </h2>
      {intro && <div className={`${split ? 'mt-6' : 'mt-4'} text-ink-2`}>{intro}</div>}
    </div>
  )

  // One button: split mode mounts it in the preview while closed and at the bottom while open, so the ref always points at the live one.
  const toggleButton = (
    <button
      ref={buttonRef}
      type="button"
      aria-expanded={open}
      aria-controls={bodyId}
      onClick={toggle}
      className={
        split
          ? 'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-brand bg-bg px-6 text-small font-medium uppercase tracking-[0.12em] text-brand transition-colors duration-200 hover:bg-brand hover:text-bg'
          : 'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-ink bg-bg px-5 text-small font-medium text-ink transition-colors duration-200 hover:bg-ink hover:text-bg'
      }
    >
      {open ? site.panel.less : moreLabel ?? site.panel.more}
      {split && !open ? (
        <span aria-hidden="true">→</span>
      ) : (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <path d="M3 5l4 4 4-4" />
        </svg>
      )}
    </button>
  )

  const showPreview = preview != null && !(previewOnlyCollapsed && open)
  const previewNode = !showPreview
    ? null
    : splitPreview
      ? splitPreview({ header, toggle: expandable && !open ? toggleButton : null })
      : (preview as ReactNode)

  return (
    <section id={id} ref={ref} aria-labelledby={titleId} className="reveal border-t border-line py-[clamp(3rem,7vw,6rem)]">
      {!split && header}

      {previewNode && (split ? previewNode : <div className="mt-8 md:mt-10">{previewNode}</div>)}

      {expandable && (
        <div id={bodyId} ref={bodyRef} hidden={!open} className="panel-body pt-8 md:pt-10">
          {children}
        </div>
      )}

      {expandable && (!split || open) && <div className="mt-8 flex justify-center">{toggleButton}</div>}
    </section>
  )
}
