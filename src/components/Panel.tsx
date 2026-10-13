import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useContent } from '../lib/i18n'
import { useReveal } from '../lib/useReveal'

interface PanelProps {
  id: string
  eyebrow?: string
  title: string
  intro?: ReactNode
  /** Always-visible part of the section. */
  preview?: ReactNode
  /** Hide the preview while expanded, when the body shows the same items in full. */
  previewOnlyCollapsed?: boolean
  /** Expandable part; no children = a plain card without a toggle. */
  children?: ReactNode
  /** Label of the closed toggle; defaults to "Mostra tutto". */
  moreLabel?: string
}

/** White rounded section card; the body opens with a height transition and is inert while closed. */
export default function Panel({ id, eyebrow, title, intro, preview, previewOnlyCollapsed = false, children, moreLabel }: PanelProps) {
  const { site } = useContent()
  const ref = useReveal<HTMLElement>()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // `instant` skips the animation when a link jumps into the closed body; `settled` lifts the clipping once open.
  const [instant, setInstant] = useState(false)
  const [settled, setSettled] = useState(false)
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
    const reveal = () =>
      flushSync(() => {
        setInstant(true)
        setSettled(true)
        setOpen(true)
      })
    const initial = inBody(location.hash)
    if (initial) {
      reveal()
      requestAnimationFrame(() => initial.scrollIntoView())
    }
    // Capture phase runs before the browser's own hash navigation.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]')
      if (link && inBody(link.getAttribute('href'))) reveal()
    }
    const onHash = () => {
      const el = inBody(location.hash)
      if (!el) return
      reveal()
      el.scrollIntoView()
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('hashchange', onHash)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('hashchange', onHash)
    }
  }, [expandable])

  const toggle = () => {
    // Closing from deep inside a long body brings the card's top back into view.
    if (open && (ref.current?.getBoundingClientRect().top ?? 0) < 0) ref.current?.scrollIntoView({ block: 'start' })
    setInstant(false)
    setSettled(false)
    setOpen(!open)
  }

  const button = (className: string) => (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={bodyId}
      onClick={toggle}
      className={`min-h-11 shrink-0 items-center gap-2 rounded-full border border-ink bg-bg px-5 text-small font-medium text-ink transition-colors duration-200 hover:bg-ink hover:text-bg ${className}`}
    >
      {open ? site.panel.less : moreLabel ?? site.panel.more}
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
        <path d="M3 5l4 4 4-4" />
      </svg>
    </button>
  )

  return (
    <section
      id={id}
      ref={ref}
      aria-labelledby={titleId}
      className="reveal scroll-mt-[calc(var(--header-h)+1rem)] rounded-[2rem] border border-line bg-bg px-[clamp(1.25rem,4vw,3.5rem)] py-[clamp(1.75rem,4vw,3.25rem)]"
    >
      <div className="flex items-end justify-between gap-6">
        <div className="max-w-[60ch]">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId} className={`${eyebrow ? 'mt-3 ' : ''}text-h2 text-ink`}>
            {title}
          </h2>
          {intro && <div className="mt-4 text-ink-2">{intro}</div>}
        </div>
        {expandable && button('hidden md:inline-flex')}
      </div>

      {preview && !(previewOnlyCollapsed && open) && <div className="mt-8 md:mt-10">{preview}</div>}

      {expandable && (
        <div
          id={bodyId}
          inert={!open}
          onTransitionEnd={(e) => e.target === e.currentTarget && setSettled(open)}
          className={`grid ${instant ? '' : 'transition-[grid-template-rows] duration-500 ease-out-quint'} ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div ref={bodyRef} className={`min-h-0 ${open && settled ? '' : 'overflow-hidden'}`}>
            <div className="pt-8 md:pt-10">{children}</div>
          </div>
        </div>
      )}

      {expandable && <div className={`mt-6 flex justify-center ${open ? '' : 'md:hidden'}`}>{button('inline-flex')}</div>}
    </section>
  )
}
