import { useState } from 'react'
import { LANGUAGE_NAMES, LOCALES, translateSource, type Locale } from '../data/localization'
import { EDITABLE_PATHS, editableTexts, type SiteTexts } from '../data/siteTexts'
import { AutoTranslateHint, Field, isBlank, useAutoTranslate, type TranslatableField } from '../lib/autoTranslate'
import { t } from '../lib/i18n'
import { STATIC_PREVIEW } from '../lib/shop'

const SECTION_LABELS: Record<string, string> = {
  site: 'Intestazione, apertura e piè di pagina',
  orologi: 'Orologi',
  storia: 'La nostra storia',
  profumiSection: 'Profumi',
  officina: 'Assistenza ZITO1950®',
  territorio: 'Scopri il territorio',
  perche: 'Perché ZITO1950®',
  contatti: 'Dove siamo',
}
const ENTRIES = editableTexts()
const SECTIONS = Object.keys(SECTION_LABELS).map(key => ({ key, entries: ENTRIES.filter(entry => entry.path.split('.')[0] === key) }))
// Long copy gets a textarea; titles, labels and buttons a single line.
const LONG = /\.(intro|introMore|text|paragraphs\.\d+|lead|closing|hint|caption)$/

/** Admin → Testi del sito: every section's copy, per language, with "Traduci" from the shown language. */
export default function SiteTextsEditor({ texts, busy, onSave }: { texts: SiteTexts; busy: boolean; onSave: (texts: SiteTexts) => void }) {
  // Edits to fields the copy no longer has (e.g. replaced section texts) are dropped, so saving never sends a path the server rejects.
  const [draft, setDraft] = useState<SiteTexts>(() => Object.fromEntries(Object.entries(structuredClone(texts)).filter(([path]) => EDITABLE_PATHS.has(path))))
  const [language, setLanguage] = useState<Locale>('it')
  const [open, setOpen] = useState('storia')
  const { status, busy: translating, translate } = useAutoTranslate()
  // A blank field shows the bundled copy as placeholder: the site keeps showing it.
  const value = (path: string, locale: Locale) => draft[path]?.[locale] ?? ''
  const set = (path: string, locale: Locale, next: string) => setDraft(current => ({ ...current, [path]: { ...current[path], [locale]: next } }))
  const field = (path: string, source: string): TranslatableField => ({
    // Untouched languages translate from what the site shows, so "Traduci" works without retyping the text.
    read: locale => value(path, locale) || (locale === 'it' ? source : ''),
    fill: (locale, next, overwrite) => typeof next === 'string' && setDraft(current => (overwrite || isBlank(current[path]?.[locale]) ? { ...current, [path]: { ...current[path], [locale]: next } } : current)),
  })
  const edited = (path: string) => Object.values(draft[path] ?? {}).some(item => item?.trim())

  return (
    <form
      className="max-w-3xl space-y-8"
      onSubmit={event => {
        event.preventDefault()
        onSave(draft)
      }}
    >
      <div>
        <h2 className="text-h2">{t('Testi del sito')}</h2>
        <p className="mt-3 text-ink-2">{t('Modifica i testi di ogni sezione. Un campo vuoto mostra il testo originale, indicato in grigio. Nomi dei prodotti, prezzi, contatti e descrizioni delle foto si modificano nelle rispettive schede.')}</p>
      </div>
      <section className="sticky top-0 z-10 -mx-[var(--gutter)] space-y-3 border-y border-line bg-bg px-[var(--gutter)] py-4 md:mx-0 md:px-0">
        <p className="eyebrow">{t('Lingua dei contenuti')}</p>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label={t('Lingua dei contenuti')}>
          {LOCALES.map(code => (
            <button type="button" key={code} aria-pressed={language === code} onClick={() => setLanguage(code)} className={`min-h-11 shrink-0 border border-line px-3 text-small ${language === code ? 'bg-ink text-bg' : ''}`}>
              {LANGUAGE_NAMES[code]}
            </button>
          ))}
        </div>
        <AutoTranslateHint status={status} />
      </section>
      {SECTIONS.map(section => (
        <details key={section.key} open={open === section.key} className="border-b border-line" onToggle={event => event.currentTarget.open && setOpen(section.key)}>
          <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3 font-serif text-h3">
            <span>{t(SECTION_LABELS[section.key])}</span>
            {section.entries.some(entry => edited(entry.path)) && <span className="shrink-0 font-sans text-xs uppercase tracking-[0.08em] text-muted">{t('Modificato')}</span>}
          </summary>
          <div className="space-y-6 pb-8 pt-2">
            {section.entries.map(entry => {
              const shown = translateSource(entry.value, language)
              const long = LONG.test(entry.path) || entry.value.length > 90
              return (
                <Field key={entry.path} label={<span className="text-muted">{t('Testo')} · <span className="text-ink">{shown.length > 60 ? `${shown.slice(0, 60)}…` : shown}</span></span>} busy={translating} onTranslate={() => translate(language, field(entry.path, entry.value))}>
                  {id => <>
                    {long ? (
                      <textarea id={id} className="shop-input min-h-28" placeholder={shown} value={value(entry.path, language)} onChange={event => set(entry.path, language, event.target.value)} />
                    ) : (
                      <input id={id} className="shop-input" placeholder={shown} value={value(entry.path, language)} onChange={event => set(entry.path, language, event.target.value)} />
                    )}
                    {value(entry.path, language) && (
                      <button type="button" className="min-h-11 self-start text-small underline" onClick={() => set(entry.path, language, '')}>
                        {t('Ripristina il testo originale')}
                      </button>
                    )}
                  </>}
                </Field>
              )
            })}
          </div>
        </details>
      ))}
      <div className="sticky bottom-0 -mx-[var(--gutter)] border-t border-line bg-bg px-[var(--gutter)] py-4 md:mx-0 md:px-0">
        <button type="submit" className="btn w-full sm:w-auto" disabled={busy || STATIC_PREVIEW}>
          {busy ? t('Salvataggio…') : t('Salva i testi')}
        </button>
      </div>
    </form>
  )
}
