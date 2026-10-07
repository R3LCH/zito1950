import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  return <label className="inline-flex min-h-11 items-center gap-2 text-small">
    <span className="sr-only">{t('Lingua del sito')}</span>
    <select data-language-selector aria-label={t('Lingua del sito')} className={`min-h-11 border border-line bg-bg px-2 text-small ${compact ? 'w-18 sm:w-auto sm:max-w-[8rem]' : 'max-w-[9rem]'}`} value={locale} onChange={event => setLocale(event.target.value as Locale)}>
      {LOCALES.map(language => <option key={language} value={language} lang={language}>{compact ? language.toUpperCase() : LANGUAGE_NAMES[language]}</option>)}
    </select>
  </label>
}
