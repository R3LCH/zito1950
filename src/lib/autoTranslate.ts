import { useCallback, useState, type KeyboardEvent } from 'react'
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
   * MUST re-check emptiness against the latest state, since results arrive asynchronously.
   */
  fill: (locale: Locale, value: TextValue) => void
}
export type TranslateKeyHandler = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, source: Locale, field: TranslatableField) => void
interface TranslateResponse { texts: string[] }

/** Enter in inputs; Ctrl/Cmd+Enter in textareas, where plain Enter keeps adding lines. */
function isTranslateKey(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (!AUTO_TRANSLATE_SUPPORTED || event.key !== 'Enter' || event.nativeEvent.isComposing || event.shiftKey || event.altKey) return false
  return !(event.currentTarget instanceof HTMLTextAreaElement) || event.ctrlKey || event.metaKey
}

export function useAutoTranslate() {
  const [status, setStatus] = useState('')
  const handle: TranslateKeyHandler = useCallback((event, source, field) => {
    if (!isTranslateKey(event)) return
    // The key now means "translate", never "submit the form".
    event.preventDefault()
    const value = field.read(source)
    if (!value || isBlank(value)) return setStatus(t('Scrivi prima il testo da tradurre.'))
    const targets = LOCALES.filter(locale => locale !== source && isBlank(field.read(locale)))
    if (!targets.length) return setStatus(t('Nessun campo vuoto da tradurre in altre lingue.'))
    setStatus(t('Traduzione in corso…'))
    const items = Array.isArray(value) ? value : [value]
    const results = targets.map(async target => {
      const { texts } = await api<TranslateResponse>('/admin/translate', 'POST', { source, target, texts: items })
      if (texts.length !== items.length) throw new Error('Translation count mismatch')
      field.fill(target, Array.isArray(value) ? texts : texts[0])
    })
    void Promise.allSettled(results).then(settled => {
      const languages = (ok: boolean) => targets.filter((_, i) => (settled[i].status === 'fulfilled') === ok).map(locale => LANGUAGE_NAMES[locale]).join(', ')
      const done = languages(true)
      const failed = languages(false)
      setStatus([done && t('Tradotto in: {languages}', { languages: done }), failed && t('Traduzione non riuscita per: {languages}', { languages: failed })].filter(Boolean).join(' · '))
    })
  }, [])
  return { status, handle }
}
