import dictionaries from './translations.json' with { type: 'json' }
import type { Img, Model, Profumo, TextTranslation, Variant } from './types.ts'

export const LOCALES = ['it', 'ru', 'en', 'uk', 'de', 'pl'] as const
export type Locale = (typeof LOCALES)[number]
export type TranslationLocale = Exclude<Locale, 'it'>
export const TRANSLATION_LOCALES: TranslationLocale[] = ['ru', 'en', 'uk', 'de', 'pl']
export const LANGUAGE_NAMES: Record<Locale, string> = {
  it: 'Italiano', ru: 'Русский', en: 'English', uk: 'Українська', de: 'Deutsch', pl: 'Polski',
}
export const LANGUAGE_TAGS: Record<Locale, string> = {
  it: 'it-IT', ru: 'ru-RU', en: 'en-GB', uk: 'uk-UA', de: 'de-DE', pl: 'pl-PL',
}
const messages: Record<string, Record<string, string>> = dictionaries
export function translateSource(source: string, locale: Locale): string {
  return locale === 'it' ? source : messages[locale]?.[source] ?? source
}
export function localizeContent<T>(value: T, locale: Locale): T {
  if (locale === 'it') return value
  if (typeof value === 'string') return translateSource(value, locale) as T
  if (Array.isArray(value)) return value.map(item => localizeContent(item, locale)) as T
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, ['name', 'id', 'src', 'code', 'codes', 'price', 'ingredients', 'address', 'city', 'company'].includes(key) ? item : localizeContent(item, locale)])) as T
}
export function seedImageTranslations(image: Img): Img {
  if (image.altTranslations) return image
  const altTranslations: Partial<Record<TranslationLocale, string>> = {}
  for (const language of TRANSLATION_LOCALES) {
    if (Object.hasOwn(messages[language], image.alt)) altTranslations[language] = messages[language][image.alt]
  }
  return { ...image, altTranslations }
}
function seedTextTranslations(product: Model | Variant | Profumo) {
  const translations: Partial<Record<TranslationLocale, TextTranslation>> = {}
  for (const language of TRANSLATION_LOCALES) {
    const text: TextTranslation = {}
    if ('description' in product && product.description && Object.hasOwn(messages[language], product.description)) text.description = translateSource(product.description, language)
    if (product.specs?.every(value => Object.hasOwn(messages[language], value))) text.specs = product.specs.map(value => translateSource(value, language))
    if ('quote' in product && product.quote?.text && Object.hasOwn(messages[language], product.quote.text)) text.quoteText = translateSource(product.quote.text, language)
    if ('paragraphs' in product && product.paragraphs.every(value => Object.hasOwn(messages[language], value))) text.paragraphs = product.paragraphs.map(value => translateSource(value, language))
    if ('label' in product && Object.hasOwn(messages[language], product.label)) text.label = translateSource(product.label, language)
    translations[language] = text
  }
  return translations
}
export function seedModelTranslations(model: Model): Model {
  return {
    ...model,
    translations: model.translations ?? seedTextTranslations(model),
    images: model.images.map(seedImageTranslations),
    variants: model.variants?.map(variant => ({ ...variant, translations: variant.translations ?? seedTextTranslations(variant), images: variant.images.map(seedImageTranslations) })),
  }
}
export function seedPerfumeTranslations(perfume: Profumo): Profumo {
  return { ...perfume, translations: perfume.translations ?? seedTextTranslations(perfume), images: perfume.images.map(seedImageTranslations) }
}
export function localizeImage(image: Img, locale: Locale): Img {
  return locale === 'it' ? image : { ...image, alt: image.altTranslations?.[locale]?.trim() || image.alt }
}
export function localizeModel(model: Model, locale: Locale): Model {
  if (locale === 'it') return model
  const text = model.translations?.[locale]
  return {
    ...model,
    description: text?.description?.trim() || model.description,
    specs: text?.specs?.some(value => value.trim()) ? text.specs.filter(value => value.trim()) : model.specs,
    quote: model.quote ? { ...model.quote, text: text?.quoteText?.trim() || model.quote.text } : text?.quoteText?.trim() ? { text: text.quoteText } : undefined,
    images: model.images.map(image => localizeImage(image, locale)),
    variants: model.variants?.map(variant => {
      const text = variant.translations?.[locale]
      return { ...variant, label: text?.label?.trim() || variant.label, specs: text?.specs?.some(value => value.trim()) ? text.specs.filter(value => value.trim()) : variant.specs, images: variant.images.map(image => localizeImage(image, locale)) }
    }),
  }
}
export function localizePerfume(perfume: Profumo, locale: Locale): Profumo {
  const text = locale === 'it' ? undefined : perfume.translations?.[locale]
  return { ...perfume, eyebrow: translateSource(perfume.eyebrow, locale), specs: text?.specs?.some(value => value.trim()) ? text.specs.filter(value => value.trim()) : perfume.specs, paragraphs: text?.paragraphs?.some(value => value.trim()) ? text.paragraphs.filter(value => value.trim()) : perfume.paragraphs, quote: { ...perfume.quote, text: text?.quoteText?.trim() || perfume.quote.text }, images: perfume.images.map(image => localizeImage(image, locale)), labels: localizeContent(perfume.labels, locale) }
}
export function missingTranslationFields(product: Model | Variant | Profumo, language: TranslationLocale): string[] {
  const text = product.translations?.[language]
  const missing: string[] = []
  if ('description' in product && product.description?.trim() && !text?.description?.trim()) missing.push('Descrizione')
  if (product.specs?.some(value => value.trim()) && !text?.specs?.some(value => value.trim())) missing.push('Caratteristiche')
  if ('quote' in product && product.quote?.text.trim() && !text?.quoteText?.trim()) missing.push('Citazione')
  if ('paragraphs' in product && product.paragraphs.some(value => value.trim()) && !text?.paragraphs?.some(value => value.trim())) missing.push('Descrizione')
  if ('label' in product && product.label.trim() && !text?.label?.trim()) missing.push('Nome variante')
  if (product.images.some(image => image.alt.trim() && !image.altTranslations?.[language]?.trim())) missing.push('Descrizione foto')
  if ('variants' in product && product.variants?.some(variant => missingTranslationFields(variant, language).length)) missing.push('Varianti / colori')
  return missing
}
