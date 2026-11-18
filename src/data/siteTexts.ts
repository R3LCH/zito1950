import { contatti, officina, orologi, perche, profumiSection, site, storia, territorio } from './content.ts'
import type { Locale } from './localization.ts'

/** Section copy the owner can rewrite in Admin → Testi del sito, in page order. */
export const TEXT_SECTIONS = { site, orologi, storia, profumiSection, officina, territorio, perche, contatti }
export type TextRoots = typeof TEXT_SECTIONS
/** Owner edits keyed by content path (e.g. "storia.title"); a missing language falls back as described in `withTexts`. */
export type SiteTexts = Record<string, Partial<Record<Locale, string>>>

// Data, links, file paths, brand name, image descriptions (edited with the photos) and UI microcopy stay out of the editor.
const SKIP_KEYS: Record<string, true> = { src: true, href: true, icon: true, alt: true, address: true, city: true, email: true, instagram: true, facebook: true, whatsapp: true, labels: true, name: true, description: true, mailSubject: true, viewImage: true, prevImage: true, nextImage: true, colors: true }

export interface EditableText { path: string; value: string }
/** Every editable Italian string with its path, in content order. */
export function editableTexts(roots: TextRoots = TEXT_SECTIONS): EditableText[] {
  const found: EditableText[] = []
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') found.push({ path, value })
    else if (value && typeof value === 'object')
      for (const [key, item] of Object.entries(value)) if (!SKIP_KEYS[key]) walk(item, `${path}.${key}`)
  }
  for (const [key, value] of Object.entries(roots)) walk(value, key)
  return found
}
export const EDITABLE_PATHS: ReadonlySet<string> = new Set(editableTexts().map(entry => entry.path))

function setPath<T>(value: T, [key, ...rest]: string[], next: string): T {
  if (value === null || typeof value !== 'object' || !(key in value)) return value
  const copy = (Array.isArray(value) ? [...value] : { ...value }) as Record<string, unknown>
  copy[key] = rest.length ? setPath(copy[key], rest, next) : next
  return copy as T
}

/**
 * Applies owner edits to content already localized for `locale`. A language the owner filled wins;
 * otherwise an edited Italian text replaces the bundled translation, which no longer matches it.
 */
export function withTexts<T extends Partial<TextRoots>>(content: T, texts: SiteTexts, locale: Locale): T {
  let result = content
  for (const [path, values] of Object.entries(texts)) {
    const next = values[locale]?.trim() || values.it?.trim()
    if (next && EDITABLE_PATHS.has(path)) result = setPath(result, path.split('.'), next)
  }
  return result
}
