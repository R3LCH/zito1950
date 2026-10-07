import { useEffect, useRef, useState } from 'react'
import { LanguageSelector, useContent } from '../lib/i18n'
import { asset } from '../lib/asset'

const MENU_ID = 'menu-mobile'

export default function Header() {
  const { site } = useContent()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Hairline after the page leaves the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Active section: the one crossing the middle band of the viewport.
  useEffect(() => {
    const sections = site.nav
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0 || !('IntersectionObserver' in window)) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`)
          else setActive((cur) => (cur === `#${entry.target.id}` ? null : cur))
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    sections.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Mobile menu: scroll lock, Escape, focus trap, focus restore.
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const prevOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('a')?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current || !buttonRef.current) return
      const languageSelect = document.querySelector<HTMLElement>('header select[data-language-selector]')
      const focusables = [...(languageSelect ? [languageSelect] : []), buttonRef.current, ...panelRef.current.querySelectorAll<HTMLElement>('a')]
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (!focusables.includes(document.activeElement as HTMLElement)) {
        e.preventDefault()
        first.focus()
      }
    }
    // Close if the viewport grows to the desktop layout.
    const mq = window.matchMedia('(min-width: 768px)')
    const onMq = () => mq.matches && setOpen(false)

    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    return () => {
      root.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
    }
  }, [open])

  return (
    <>
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-bg focus:px-4 focus:py-3 focus:text-small focus:font-medium"
      >
        {site.labels.skipToContent}
      </a>

      <header
        className={`sticky top-0 z-50 bg-bg transition-[border-color] duration-300 ease-out-quint border-b ${
          scrolled || open ? 'border-line' : 'border-transparent'
        }`}
      >
        <div className="container-site flex h-[var(--header-h)] items-center justify-between gap-2 md:gap-6">
          <a href="#home" className="-ml-1 flex min-h-11 items-center px-1" onClick={() => setOpen(false)}>
            <img src={asset('logo.svg')} alt={site.labels.home} width={341} height={100} className="h-6 w-auto sm:h-7 md:h-8" />
          </a>

          <nav aria-label={site.labels.mainNav} className="hidden md:block">
            <ul className="flex items-center gap-8 lg:gap-10">
              {site.nav.map((item) => {
                const isActive = active === item.href
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-current={isActive ? 'location' : undefined}
                      className={`relative inline-flex min-h-11 items-center text-small font-medium tracking-[0.04em] transition-colors duration-200 after:absolute after:inset-x-0 after:bottom-2 after:h-px after:origin-left after:bg-ink after:transition-transform after:duration-500 after:ease-out-quint ${
                        isActive ? 'text-ink after:scale-x-100' : 'text-ink-2 hover:text-ink after:scale-x-0'
                      }`}
                    >
                      {item.label}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
          <LanguageSelector compact />

          <button
            ref={buttonRef}
            type="button"
            className="-mr-3 inline-flex min-h-11 min-w-11 items-center justify-center gap-3 px-3 text-small font-medium uppercase tracking-[0.12em] md:hidden"
            aria-expanded={open}
            aria-controls={MENU_ID}
            onClick={() => setOpen((v) => !v)}
          >
            <span>{open ? site.labels.close : site.labels.menu}</span>
            <span aria-hidden="true" className="relative block h-3 w-5">
              <span
                className={`absolute left-0 top-0.5 h-px w-5 bg-ink transition-transform duration-300 ease-out-quint ${
                  open ? 'translate-y-1 rotate-45' : ''
                }`}
              />
              <span
                className={`absolute bottom-0.5 left-0 h-px w-5 bg-ink transition-transform duration-300 ease-out-quint ${
                  open ? '-translate-y-1 -rotate-45' : ''
                }`}
              />
            </span>
          </button>
        </div>

        <div
          ref={panelRef}
          id={MENU_ID}
          hidden={!open}
          className="fixed inset-x-0 bottom-0 top-[var(--header-h)] overflow-y-auto bg-bg md:hidden"
        >
          <nav aria-label={site.labels.mainNav} className="container-site flex min-h-full flex-col py-10">
            <ul className="flex flex-col">
              {site.nav.map((item) => (
                <li key={item.href} className="border-b border-line">
                  <a
                    href={item.href}
                    aria-current={active === item.href ? 'location' : undefined}
                    className="flex min-h-16 items-center justify-between py-4 font-serif text-[2.25rem] leading-tight"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                    {active === item.href && <span aria-hidden="true" className="h-px w-8 bg-ink" />}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-auto pt-10 text-small text-muted">{site.tagline}</p>
          </nav>
        </div>
      </header>
    </>
  )
}
