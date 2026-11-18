import { useCallback, useId, useState, type ReactNode } from 'react'
import { LANGUAGE_NAMES, LOCALES, type Locale } from '../data/localization'
import { t } from './i18n'
import { api, STATIC_PREVIEW } from './shop'

/** The GitHub Pages preview has no backend, so the translation proxy is unreachable there. */
export const AUTO_TRANSLATE_SUPPORTED = !STATIC_PREVIEW

/** One line of text, or a list of lines/paragraphs translated item by item so the structure survives. */
export type TextValue = string | string[]
export const isBlank = (value?: TextValue) => (Array.isArray(value) ? !value.some(item => item.trim()) : !value?.trim())

/** A text field that exists once per language. */
export interface TranslatableField {
  read: (locale: Locale) => TextValue | undefined
  /**
   * Stores a translation with the same shape as the source (string → string, list → same-length list).
   * Without `overwrite` it MUST re-check emptiness against the latest state, since results arrive asynchronously.
   */
  fill: (locale: Locale, value: TextValue, overwrite: boolean) => void
}
export type Translate = (source: Locale, field: TranslatableField) => void
interface TranslateResponse { texts: string[] }

/**
 * Translates one field from `source` into the other languages. Empty languages are filled; when every
 * language already has text, the owner confirms before all of them are replaced.
 */
export function useAutoTranslate() {
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState(0)
  const translate: Translate = useCallback((source, field) => {
    if (!AUTO_TRANSLATE_SUPPORTED) return setStatus(t('La traduzione automatica non è disponibile nell’anteprima.'))
    const value = field.read(source)
    if (!value || isBlank(value)) return setStatus(t('Scrivi prima il testo da tradurre.'))
    const others = LOCALES.filter(locale => locale !== source)
    const empty = others.filter(locale => isBlank(field.read(locale)))
    const overwrite = !empty.length
    if (overwrite && !window.confirm(t('Tutte le lingue hanno già un testo. Sostituirle con una nuova traduzione?'))) return
    const targets = overwrite ? others : empty
    setStatus(t('Traduzione in corso…'))
    setPending(count => count + 1)
    const items = Array.isArray(value) ? value : [value]
    const results = targets.map(async target => {
      const { texts } = await api<TranslateResponse>('/admin/translate', 'POST', { source, target, texts: items })
      if (texts.length !== items.length) throw new Error('Translation count mismatch')
      field.fill(target, Array.isArray(value) ? texts : texts[0], overwrite)
    })
    void Promise.allSettled(results).then(settled => {
      setPending(count => count - 1)
      const languages = (ok: boolean) => targets.filter((_, i) => (settled[i].status === 'fulfilled') === ok).map(locale => LANGUAGE_NAMES[locale]).join(', ')
      const done = languages(true)
      const failed = languages(false)
      setStatus([done && t('Tradotto in: {languages}', { languages: done }), failed && t('Traduzione non riuscita per: {languages}', { languages: failed })].filter(Boolean).join(' · '))
    })
  }, [])
  return { status, busy: pending > 0, translate }
}

/** Compact outlined button placed next to a field's label; 44px touch target. */
export function TranslateButton({ onClick, busy = false, disabled = false }: { onClick: () => void; busy?: boolean; disabled?: boolean }) {
  if (!AUTO_TRANSLATE_SUPPORTED) return null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-medium uppercase tracking-[0.08em] text-ink transition-colors hover:border-ink disabled:cursor-default disabled:opacity-55"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h9M8.5 3v2M6 5c.6 3.4 2.9 6.2 6 7.5M11 5c-.7 3.9-3.4 7-7 8.5M13 21l4-9 4 9M14.4 18h5.2" />
      </svg>
      {t('Traduci')}
    </button>
  )
}

export function AutoTranslateHint({ status }: { status: string }) {
  return <>
    <p className="text-small text-muted">{AUTO_TRANSLATE_SUPPORTED ? t('«Traduci» compila le lingue vuote partendo dalla lingua selezionata; se sono tutte compilate chiede prima di sostituirle.') : t('La traduzione automatica non è disponibile nell’anteprima.')}</p>
    <p role="status" aria-live="polite" className="text-small">{status}</p>
  </>
}

/** Label row with an optional "Traduci" button beside it; the control receives the generated id. */
export function Field({ label, onTranslate, busy, className = '', children }: { label: ReactNode; onTranslate?: () => void; busy?: boolean; className?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return <div className={`shop-label ${className}`}>
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0">{label}</label>
      {onTranslate && <TranslateButton onClick={onTranslate} busy={busy} />}
    </div>
    {children(id)}
  </div>
}
