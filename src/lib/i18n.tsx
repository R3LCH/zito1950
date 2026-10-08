import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { contatti, orologi, site, storia } from '../data/content'
import { LANGUAGE_NAMES, LANGUAGE_TAGS, LOCALES, localizeContent, translateSource, type Locale } from '../data/localization'

function preferredLanguage(): Locale {
  if (typeof window === 'undefined') return 'it'
  const query = new URLSearchParams(location.search).get('lang')
  if (LOCALES.includes(query as Locale)) return query as Locale
  try { const stored = localStorage.getItem('zito-language'); if (LOCALES.includes(stored as Locale)) return stored as Locale } catch { /* Keep Italian when storage is unavailable. */ }
  return 'it'
}
let activeLanguage = preferredLanguage()
export function t(source: string, values?: Record<string, string | number>): string {
  let translated = translateSource(source, activeLanguage)
  if (values) for (const [name, value] of Object.entries(values)) translated = translated.replaceAll(`{${name}}`, String(value))
  return translated
}
const currencyFormats: Partial<Record<Locale, Intl.NumberFormat>> = {}
export function formatMoney(cents: number): string {
  const formatter = currencyFormats[activeLanguage] ??= new Intl.NumberFormat(LANGUAGE_TAGS[activeLanguage], { style: 'currency', currency: 'EUR' })
  return formatter.format(cents / 100)
}
interface LocaleState { locale: Locale; setLocale: (locale: Locale) => void; content: { site: typeof site; storia: typeof storia; orologi: typeof orologi; contatti: typeof contatti } }
const LocaleContext = createContext<LocaleState | null>(null)
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLanguage] = useState<Locale>(activeLanguage)
  const content = useMemo(() => localizeContent({ site, storia, orologi, contatti }, locale), [locale])
  const setLocale = (value: Locale) => {
    activeLanguage = value
    setLanguage(value)
    try { localStorage.setItem('zito-language', value) } catch { /* State still changes without storage. */ }
    const url = new URL(location.href)
    url.searchParams.set('lang', value)
    history.replaceState(null, '', url)
  }
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = `${site.name} · ${translateSource('Orologi e tradizione di famiglia', locale)}`
    const description = translateSource(site.description, locale)
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) document.querySelector(selector)?.setAttribute('content', description)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title)
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', LANGUAGE_TAGS[locale].replace('-', '_'))
  }, [locale])
  return <LocaleContext.Provider value={{ locale, setLocale, content }}>{children}</LocaleContext.Provider>
}
export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) throw new Error('LocaleProvider required')
  return context
}
export function useContent() { return useLocale().content }
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    list.current?.focus()
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const show = () => { setFocus(LOCALES.indexOf(locale)); setOpen(true) }
  const choose = (language: Locale) => { setLocale(language); setOpen(false); button.current?.focus() }
  const onListKey = (event: KeyboardEvent) => {
    const last = LOCALES.length - 1
    const moves: Record<string, number> = { ArrowDown: Math.min(focus + 1, last), ArrowUp: Math.max(focus - 1, 0), Home: 0, End: last }
    if (event.key in moves) { event.preventDefault(); setFocus(moves[event.key]) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(LOCALES[focus]) }
    else if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); setOpen(false); button.current?.focus() }
  }
  return <div ref={root} className="relative" data-language-selector>
    <button
      ref={button}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={`${id}-list`}
      aria-label={`${t('Lingua del sito')}: ${LANGUAGE_NAMES[locale]}`}
      onClick={() => (open ? setOpen(false) : show())}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show() } }}
      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-bg px-4 text-small tracking-wide transition-colors duration-200 hover:border-ink focus-visible:border-ink"
    >
      <span>{compact ? locale.toUpperCase() : LANGUAGE_NAMES[locale]}</span>
      <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}><path d="M2 3.5l3 3 3-3" /></svg>
    </button>
    {open && <ul
      ref={list}
      id={`${id}-list`}
      role="listbox"
      tabIndex={-1}
      aria-label={t('Lingua del sito')}
      aria-activedescendant={`${id}-${LOCALES[focus]}`}
      onKeyDown={onListKey}
      className="absolute right-0 z-50 mt-2 min-w-[11rem] overflow-hidden rounded-2xl border border-line bg-bg p-1.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] outline-none"
    >
      {LOCALES.map((language, index) => <li
        key={language}
        id={`${id}-${language}`}
        role="option"
        lang={language}
        aria-selected={language === locale}
        onPointerEnter={() => setFocus(index)}
        onClick={() => choose(language)}
        className={`flex min-h-10 cursor-pointer items-center justify-between gap-4 rounded-xl px-3 text-small ${index === focus ? 'bg-well' : ''}`}
      >
        <span>{LANGUAGE_NAMES[language]}</span>
        <span className={`text-muted ${language === locale ? 'text-ink' : ''}`}>{language === locale ? '✓' : language.toUpperCase()}</span>
      </li>)}
    </ul>}
  </div>
}
