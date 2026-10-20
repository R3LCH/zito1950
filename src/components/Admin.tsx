import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AVAILABILITIES, DEFAULT_EMAIL_TEMPLATES, FULFILLMENT_LABELS, FULFILLMENT_STATUSES, GENDERS, PERFUME_AVAILABILITIES, type Availability, type CertificateHolder, type EmailTemplate, type EmailTemplates, type FulfillmentStatus, type Gender, type Img, type Model, type OrderItemView, type PerfumeAvailability, type Profumo, type PublicOrder, type Variant, type TextTranslation } from '../data/types'
import { renderCustomerEmail } from '../lib/orderEmail'
import { api, euro, getSession, STATIC_PREVIEW, useShop, type Catalog } from '../lib/shop'
import { officina, profumo as originalPerfume, storia, territorio } from '../data/content'
import { asset } from '../lib/asset'
import { t, LanguageSelector, useLocale } from '../lib/i18n'
import { LOCALES, LANGUAGE_NAMES, LANGUAGE_TAGS, missingTranslationFields, type Locale } from '../data/localization'
import { AUTO_TRANSLATE_SUPPORTED, isBlank, useAutoTranslate, type TextValue, type TranslatableField, type TranslateKeyHandler } from '../lib/autoTranslate'

// The translate route returns the source's shape, so a list field always receives a list and a line a string.
const textPatch = (key: keyof TextTranslation, value: TextValue): TextTranslation => ({ [key]: value })

// Italian lives in the base fields; every other language lives in `translations` / `altTranslations`.
const altOf = (image: Img, locale: Locale) => (locale === 'it' ? image.alt : image.altTranslations?.[locale])
const withAlt = (image: Img, locale: Locale, alt: string): Img => (locale === 'it' ? { ...image, alt } : { ...image, altTranslations: { ...image.altTranslations, [locale]: alt } })
/** Admin label for a photo: uploaded file name, then description, then path. */
const photoLabel = (image: Img) => image.name?.trim() || image.alt.trim() || image.src
/** Public section showing each original site photo, keyed by its original src. Hero and perfume slots are labelled from the live catalog instead. */
const SITE_SECTIONS: Record<string, string> = Object.fromEntries([
  [storia.image.src, 'Storia'],
  ...storia.chapters.flatMap((c) => (c.image ? [[c.image.src, 'Storia']] : [])),
  [officina.image.src, 'Officina'],
  [territorio.image.src, 'Scopri il territorio'],
])
/** Lowercase ASCII id from a name, unique among `taken`. */
function slugId(name: string, taken: string[]) {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'profumo'
  let candidate = base
  for (let n = 2; taken.includes(candidate); n++) candidate = `${base}-${n}`
  return candidate
}
/** A new perfume: the seed's section labels, everything else blank. */
const blankPerfume = (): Profumo => ({
  id: '',
  eyebrow: originalPerfume.eyebrow,
  labels: originalPerfume.labels,
  code: '',
  name: '',
  price: '',
  priceCents: 12000,
  availability: 'no-buy',
  quote: { text: '' },
  paragraphs: [],
  specs: [],
  ingredients: [],
  images: [],
})
/** Uploads files to the library and resolves to the new photos (empty when the upload failed). */
type UploadPhotos = (files: File[]) => Promise<Img[]>
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp'
const modelText = (d: Model, locale: Locale): TextTranslation => (locale === 'it' ? { description: d.description, specs: d.specs, quoteText: d.quote?.text } : d.translations?.[locale] ?? {})
function withModelText(d: Model, locale: Locale, patch: TextTranslation): Model {
  if (locale !== 'it') return { ...d, translations: { ...d.translations, [locale]: { ...d.translations?.[locale], ...patch } } }
  return { ...d, ...(patch.description !== undefined ? { description: patch.description } : {}), ...(patch.specs !== undefined ? { specs: patch.specs } : {}), ...(patch.quoteText !== undefined ? { quote: { ...d.quote, text: patch.quoteText } } : {}) }
}
const variantText = (v: Variant, locale: Locale): TextTranslation => (locale === 'it' ? { label: v.label, specs: v.specs } : v.translations?.[locale] ?? {})
const withVariantText = (v: Variant, locale: Locale, patch: Pick<TextTranslation, 'label' | 'specs'>): Variant => (locale === 'it' ? { ...v, ...patch } : { ...v, translations: { ...v.translations, [locale]: { ...v.translations?.[locale], ...patch } } })
const perfumeText = (d: Profumo, locale: Locale): TextTranslation => (locale === 'it' ? { paragraphs: d.paragraphs, specs: d.specs, quoteText: d.quote.text } : d.translations?.[locale] ?? {})
function withPerfumeText(d: Profumo, locale: Locale, patch: TextTranslation): Profumo {
  if (locale !== 'it') return { ...d, translations: { ...d.translations, [locale]: { ...d.translations?.[locale], ...patch } } }
  return { ...d, ...(patch.paragraphs !== undefined ? { paragraphs: patch.paragraphs } : {}), ...(patch.specs !== undefined ? { specs: patch.specs } : {}), ...(patch.quoteText !== undefined ? { quote: { ...d.quote, text: patch.quoteText } } : {}) }
}
// Admin copy for each public availability state: tile title and one-line effect on the site. Watches use every state except coming-soon.
const AVAILABILITY_COPY: Record<PerfumeAvailability, { label: string; hint: string }> = {
  buy: { label: 'Acquistabile', hint: 'Mostra il pulsante Acquista e il prezzo.' },
  'no-buy': { label: 'Solo vetrina', hint: 'Visibile, senza pulsante di acquisto.' },
  'coming-soon': { label: 'Prossimamente', hint: 'Visibile come Prossimamente, senza codice, prezzo né pulsanti.' },
  'out-of-stock': { label: 'Esaurito', hint: 'Visibile con l’etichetta Esaurito.' },
  hidden: { label: 'Nascosto', hint: 'Non compare sul sito.' },
}
/** «Disponibilità» tile radio group shared by the watch and perfume editors; `children` render below the tiles. */
function AvailabilityTiles<T extends PerfumeAvailability>({ values, value, onChange, children }: { values: readonly T[]; value: T; onChange: (value: T) => void; children?: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-small font-medium">{t("Disponibilità")}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {values.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-3 border border-line p-4 has-[:checked]:border-ink has-[:checked]:bg-well has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
          >
            <input
              type="radio"
              name="availability"
              value={option}
              className="mt-1 accent-ink focus-visible:outline-none"
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span className="min-w-0">
              <span className="block text-small font-medium">{t(AVAILABILITY_COPY[option].label)}</span>
              <span className="mt-1 block text-xs text-muted">{t(AVAILABILITY_COPY[option].hint)}</span>
            </span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  )
}
// Admin copy for each watch line: tile title and which storefront filter shows it.
const GENDER_COPY: Record<Gender, { label: string; hint: string }> = {
  uomo: { label: 'Uomo', hint: 'Compare nel filtro Uomo.' },
  donna: { label: 'Donna', hint: 'Compare nel filtro Donna.' },
  unisex: { label: 'Unisex', hint: 'Compare in entrambi i filtri.' },
}
/** «Linea» tile radio group of the watch editor; shared by every content language. */
function GenderTiles({ value, onChange }: { value: Gender; onChange: (value: Gender) => void }) {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-small font-medium">{t("Linea")}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {GENDERS.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-3 border border-line p-4 has-[:checked]:border-ink has-[:checked]:bg-well has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
          >
            <input
              type="radio"
              name={name}
              value={option}
              className="mt-1 accent-ink focus-visible:outline-none"
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span className="min-w-0">
              <span className="block text-small font-medium">{t(GENDER_COPY[option].label)}</span>
              <span className="mt-1 block text-xs text-muted">{t(GENDER_COPY[option].hint)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function AutoTranslateHint({ status }: { status: string }) {
  return <>
    <p className="text-small text-muted">{AUTO_TRANSLATE_SUPPORTED ? t('Invio traduce il testo nei campi vuoti delle altre lingue; nei campi a più righe usa Ctrl+Invio (⌘+Invio su Mac).') : t('La traduzione automatica non è disponibile nell’anteprima.')}</p>
    <p role="status" aria-live="polite" className="text-small">{status}</p>
  </>
}
function TextLanguages({ language, onChange, product, translationStatus }: { language: Locale; onChange: (language: Locale) => void; product: Model | Profumo; translationStatus: string }) {
  return <section className="space-y-3 border-y border-line py-5">
    <p className="eyebrow">{t('Lingua dei contenuti')}</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('Lingua dei contenuti')}>
      {LOCALES.map(code => <button type="button" key={code} aria-pressed={language === code} className={`border border-line px-3 py-2 text-small ${language === code ? 'bg-ink text-bg' : ''}`} onClick={() => onChange(code)}>{LANGUAGE_NAMES[code]}{code !== 'it' && missingTranslationFields(product, code).length > 0 ? ' · !' : ''}</button>)}
    </div>
    <p className="text-small text-muted">{t('Nomi prodotto, codici, prezzi e fotografie sono condivisi. I testi si salvano insieme per tutte le lingue. Le traduzioni mancanti usano il testo italiano.')}</p>
    {language !== 'it' && missingTranslationFields(product, language).length > 0 && <p role="status" className="text-small">{t('Traduzioni mancanti:')} {missingTranslationFields(product, language).map(field => t(field)).join(', ')}</p>}
    <AutoTranslateHint status={translationStatus} />
  </section>
}
function PhotoEditor({
  images,
  onChange,
  onTranslateKey,
  onUpload,
  library,
  language = 'it',
}: {
  images: Img[]
  /** Receives an updater so asynchronous translations apply to the latest photos. */
  onChange: (update: (images: Img[]) => Img[]) => void
  onTranslateKey: TranslateKeyHandler
  onUpload: UploadPhotos
  library: Img[]
  language?: Locale
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div className="space-y-4">
      <p className="eyebrow">{t("Fotografie")}</p>
      <ul className="space-y-3">
        {images.map((im, index) => (
          <li key={`${im.src}-${index}`} className="grid grid-cols-[64px_1fr] gap-3 border-b border-line pb-3">
            <img src={asset(im.src)} alt="" className="h-16 w-16 object-contain" />
            <div className="min-w-0">
              {im.name && <p className="mb-1 break-words text-xs text-muted">{im.name}</p>}
              <label className="text-small">
                {t("Descrizione foto")}
                <input
                  className="shop-input w-full"
                  value={altOf(im, language) ?? ''}
                  onChange={(e) => onChange(current => current.map((item, i) => (i === index ? withAlt(item, language, e.target.value) : item)))}
                  onKeyDown={(e) => onTranslateKey(e, language, {
                    read: locale => altOf(im, locale),
                    // Match by position and file: the photo may have been moved or removed while translating.
                    fill: (locale, value) => typeof value === 'string' && onChange(current => current.map((item, i) => (i === index && item.src === im.src && isBlank(altOf(item, locale)) ? withAlt(item, locale, value) : item))),
                  })}
                />
              </label>
              <div className="mt-2 flex gap-4 text-small">
                <button
                  type="button"
                  className="underline"
                  disabled={index === 0}
                  onClick={() => onChange(current => {
                    const reordered = [...current]
                    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
                    return reordered
                  })}
                >
                  {t("Sposta prima")}
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => onChange(current => current.filter((_, i) => i !== index))}
                >
                  {t("Rimuovi foto")}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div>
        <button className="btn" type="button" onClick={() => setPickerOpen(true)}>
          {t("Aggiungi foto")}
        </button>
      </div>
      <PhotoPicker
        open={pickerOpen}
        library={library}
        busy={false}
        onUpload={onUpload}
        onPick={(photo) => onChange(current => [...current, { ...photo }])}
        onClose={() => setPickerOpen(false)}
      />
      <label className="shop-label">
        {t("Carica nuove foto")}
        <input
          type="file"
          multiple
          className="shop-input"
          accept={PHOTO_TYPES}
          disabled={STATIC_PREVIEW}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) void onUpload(files).then((uploaded) => uploaded.length > 0 && onChange(current => [...current, ...uploaded]))
          }}
        />
      </label>
    </div>
  )
}
/** Modal grid of every known photo with name search; an uploaded file is picked as soon as it lands. */
function PhotoPicker({
  open,
  library,
  busy,
  onPick,
  onUpload,
  onClose,
}: {
  open: boolean
  library: Img[]
  busy: boolean
  onPick: (image: Img) => void
  onUpload: UploadPhotos
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [query, setQuery] = useState('')
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [open])
  const pick = (image: Img) => {
    onPick(image)
    onClose()
  }
  const needle = query.trim().toLowerCase()
  const shown = needle ? library.filter((im) => `${photoLabel(im)} ${im.src}`.toLowerCase().includes(needle)) : library
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Clicks on the ::backdrop target the dialog element itself.
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-auto max-h-[85dvh] w-[min(56rem,calc(100vw-2rem))] max-w-none border border-line bg-bg p-0 text-ink backdrop:bg-ink/30"
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-3">
            <h2 id={titleId} className="font-serif text-h3">{t("Scegli la nuova foto")}</h2>
            <button type="button" onClick={onClose} className="min-h-11 px-1 text-small underline decoration-line underline-offset-4 hover:decoration-current">
              {t("Chiudi")}
            </button>
          </div>
          <div className="grid gap-4 border-b border-line px-6 py-4 sm:grid-cols-2">
            <label className="shop-label">
              {t("Cerca per nome")}
              <input type="search" className="shop-input" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="shop-label">
              {t("Carica nuove foto")}
              <input
                type="file"
                className="shop-input"
                accept={PHOTO_TYPES}
                disabled={busy || STATIC_PREVIEW}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  if (files.length) void onUpload(files).then((uploaded) => uploaded[0] && pick(uploaded[0]))
                }}
              />
            </label>
          </div>
          <div className="overflow-y-auto overscroll-contain px-6 py-6">
            {!shown.length && <p className="text-small">{t("Nessuna foto trovata.")}</p>}
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((im) => (
                <li key={im.src}>
                  <button
                    type="button"
                    className="block w-full border border-transparent p-1 text-left hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    onClick={() => pick(im)}
                  >
                    <img src={asset(im.src)} alt="" loading="lazy" className="aspect-square w-full bg-well object-contain" />
                    <span className="mt-2 block break-words text-xs">{photoLabel(im)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </dialog>
  )
}
function PriceInput({
  value,
  onChange,
  label = 'Prezzo EUR',
  optional = false,
}: {
  value: number
  onChange: (cents: number) => void
  label?: string
  /** Allows an empty field (0 cents), e.g. a perfume announced before its price is set. */
  optional?: boolean
}) {
  const [raw, setRaw] = useState(optional && value <= 0 ? '' : (value / 100).toFixed(2))
  return (
    <label className="shop-label">
      {t(label)}
      <input
        className="shop-input"
        type="number"
        min={optional ? '0' : '0.01'}
        max="1000000"
        step="0.01"
        required={!optional}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value)
          onChange(Math.round(Number(e.target.value) * 100))
        }}
      />
    </label>
  )
}
function ProductEditor({
  model,
  models,
  library,
  busy,
  onSave,
  onDelete,
  onUpload,
}: {
  model: Model
  /** Whole catalog, hidden included, for the similar-models picker. */
  models: Model[]
  library: Img[]
  busy: boolean
  onSave: (model: Model) => void
  onDelete: () => void
  onUpload: UploadPhotos
}) {
  const [draft, setDraft] = useState<Model>(() => structuredClone(model))
  const [language, setLanguage] = useState<Locale>('it')
  const { status: translationStatus, handle: onTranslateKey } = useAutoTranslate()
  const text = modelText(draft, language)
  const setText = (patch: TextTranslation) => setDraft(d => withModelText(d, language, patch))
  // Functional updates throughout: translations land asynchronously and must not overwrite newer edits.
  const setVariant = (index: number, patch: Partial<Variant>) =>
    setDraft(d => ({ ...d, variants: d.variants?.map((v, i) => (i === index ? { ...v, ...patch } : v)) }))
  const setVariantText = (id: string, patch: Pick<TextTranslation, 'label' | 'specs'>) =>
    setDraft(d => ({ ...d, variants: d.variants?.map(item => (item.id === id ? withVariantText(item, language, patch) : item)) }))
  const modelField = (key: 'description' | 'specs' | 'quoteText'): TranslatableField => ({
    read: locale => modelText(draft, locale)[key],
    fill: (locale, value) => setDraft(d => (isBlank(modelText(d, locale)[key]) ? withModelText(d, locale, textPatch(key, value)) : d)),
  })
  const variantField = (variant: Variant, key: 'label' | 'specs'): TranslatableField => ({
    read: locale => variantText(variant, locale)[key],
    fill: (locale, value) => setDraft(d => ({ ...d, variants: d.variants?.map(item => (item.id === variant.id && isBlank(variantText(item, locale)[key]) ? withVariantText(item, locale, textPatch(key, value)) : item)) })),
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
      }}
      className="min-w-0 space-y-7"
    >
      <fieldset disabled={busy} className="min-w-0 space-y-7">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="shop-label">
            {t("Nome")}
            <input
              className="shop-input"
              required
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <PriceInput value={draft.priceCents ?? 1} onChange={(priceCents) => setDraft({ ...draft, priceCents })} />
          <label className="shop-label">
            {t("Codici (separati da virgola)")}
            <input
              className="shop-input"
              defaultValue={draft.codes.join(', ')}
              onBlur={(e) =>
                setDraft({
                  ...draft,
                  codes: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        </div>
        <GenderTiles value={draft.gender ?? 'unisex'} onChange={(gender) => setDraft(d => ({ ...d, gender }))} />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <AvailabilityTiles values={AVAILABILITIES} value={draft.availability ?? 'no-buy'} onChange={(availability: Availability) => setDraft(d => ({ ...d, availability }))} />
          <fieldset className="min-w-0 space-y-4">
            <legend className="mb-3 text-small font-medium">{t("Edizione limitata")}</legend>
            <label className="flex items-center gap-3 text-small">
              <input
                type="checkbox"
                className="accent-ink"
                checked={!!draft.limitedEdition}
                onChange={(e) => setDraft(d => ({ ...d, limitedEdition: e.target.checked }))}
              />
              {t("Edizione limitata")}
            </label>
            <label className="shop-label">
              {t("Pezzi rimanenti")}
              <input
                className="shop-input disabled:text-muted"
                type="number"
                min="0"
                max="9999"
                step="1"
                inputMode="numeric"
                placeholder={t("non mostrare")}
                disabled={!draft.limitedEdition}
                aria-describedby={`pieces-hint-${draft.id}`}
                value={draft.piecesRemaining ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  const piecesRemaining = raw === '' ? null : Math.min(9999, Math.max(0, Math.trunc(Number(raw))))
                  setDraft(d => ({ ...d, piecesRemaining }))
                }}
              />
            </label>
            <p id={`pieces-hint-${draft.id}`} className="text-xs text-muted">
              {t("Mostrato sulla scheda del modello. Lascia vuoto per non mostrarlo.")} {t("Con 0 pezzi il modello appare Esaurito e non è acquistabile.")}
            </p>
          </fieldset>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <fieldset className="min-w-0 space-y-3">
            <legend className="mb-3 text-small font-medium">{t("Novità")}</legend>
            <label className="flex items-center gap-3 text-small">
              <input
                type="checkbox"
                className="accent-ink"
                checked={!!draft.isNew}
                onChange={(e) => setDraft(d => ({ ...d, isNew: e.target.checked }))}
              />
              {t("Nuovo")}
            </label>
            <p className="text-xs text-muted">{t("Mostra l’etichetta Nuovo e mette il modello in cima al catalogo.")}</p>
          </fieldset>
          <fieldset className="min-w-0 space-y-3">
            <legend className="mb-3 text-small font-medium">{t("Modelli simili")}</legend>
            <p className="text-xs text-muted">{t("Compaiono per primi in “Scopri anche”, in quest’ordine; gli altri seguono per somiglianza.")}</p>
            {(draft.similar ?? []).length > 0 && (
              <ol className="border-t border-line">
                {(draft.similar ?? []).map((sid, i, list) => {
                  const other = models.find((m) => m.id === sid)
                  const move = (to: number) =>
                    setDraft(d => {
                      const next = [...(d.similar ?? [])]
                      next.splice(to, 0, ...next.splice(i, 1))
                      return { ...d, similar: next }
                    })
                  return (
                    <li key={sid} className="flex items-center gap-2 border-b border-line py-2 text-small">
                      <span className="w-6 tabular-nums text-muted">{i + 1}.</span>
                      <span className="min-w-0 flex-1 truncate">{other?.name ?? sid}</span>
                      <button type="button" className="min-h-11 min-w-11 underline disabled:no-underline" disabled={i === 0} aria-label={t("Sposta su: {name}", { name: other?.name ?? sid })} onClick={() => move(i - 1)}>↑</button>
                      <button type="button" className="min-h-11 min-w-11 underline disabled:no-underline" disabled={i === list.length - 1} aria-label={t("Sposta giù: {name}", { name: other?.name ?? sid })} onClick={() => move(i + 1)}>↓</button>
                      <button type="button" className="min-h-11 px-2 underline" aria-label={t("Rimuovi {name}", { name: other?.name ?? sid })} onClick={() => setDraft(d => ({ ...d, similar: d.similar?.filter((s) => s !== sid) }))}>{t("Rimuovi")}</button>
                    </li>
                  )
                })}
              </ol>
            )}
            <label className="shop-label">
              {t("Aggiungi modello simile")}
              <select
                className="shop-input"
                value=""
                onChange={(e) => {
                  const value = e.target.value
                  if (value) setDraft(d => ({ ...d, similar: [...(d.similar ?? []), value] }))
                }}
              >
                <option value="">{t("Scegli un modello…")}</option>
                {models
                  .filter((m) => m.id !== draft.id && !(draft.similar ?? []).includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
              </select>
            </label>
          </fieldset>
        </div>
        <TextLanguages language={language} onChange={setLanguage} product={draft} translationStatus={translationStatus} />
        <label className="shop-label">
          {t("Descrizione")}
          <textarea
            className="shop-input min-h-32"
            value={text.description ?? ''}
            onChange={(e) => setText({ description: e.target.value })}
            onKeyDown={(e) => onTranslateKey(e, language, modelField('description'))}
          />
        </label>
        <label className="shop-label">
          {t("Caratteristiche (una per riga)")}
          <textarea
            className="shop-input min-h-32"
            value={text.specs?.join('\n') ?? ''}
            onChange={(e) => setText({ specs: e.target.value.split('\n') })}
            onKeyDown={(e) => onTranslateKey(e, language, modelField('specs'))}
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="shop-label">
            {t("Citazione")}
            <input
              className="shop-input"
              value={text.quoteText ?? ''}
              onChange={(e) => setText({ quoteText: e.target.value })}
              onKeyDown={(e) => onTranslateKey(e, language, modelField('quoteText'))}
            />
          </label>
          <label className="shop-label">
            {t("Autore")}
            <input
              className="shop-input"
              value={draft.quote?.author ?? ''}
              onChange={(e) => setDraft({ ...draft, quote: { text: draft.quote?.text ?? '', author: e.target.value } })}
            />
          </label>
        </div>
        <PhotoEditor language={language} images={draft.images} library={library} onUpload={onUpload} onTranslateKey={onTranslateKey} onChange={(update) => setDraft(d => ({ ...d, images: update(d.images) }))} />
        <div className="space-y-6 border-t border-line pt-6">
          <h3 className="text-h3">{t("Varianti / colori")}</h3>
          {draft.variants?.map((v, index) => (
            <section key={v.id} className="space-y-4 border border-line p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="shop-label">
                  {t("Nome variante")}
                  <input
                    className="shop-input"
                    required={language === 'it'}
                    value={language === 'it' ? v.label : v.translations?.[language]?.label ?? ''}
                    onChange={(e) => setVariantText(v.id, { label: e.target.value })}
                    onKeyDown={(e) => onTranslateKey(e, language, variantField(v, 'label'))}
                  />
                </label>
                <PriceInput value={v.priceCents ?? 1} onChange={(priceCents) => setVariant(index, { priceCents })} />
                <label className="shop-label">
                  {t("Codici variante")}
                  <input
                    className="shop-input"
                    defaultValue={v.codes.join(', ')}
                    onBlur={(e) =>
                      setVariant(index, {
                        codes: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="shop-label">
                  {t("Colore")}
                  <input
                    className="shop-input w-full"
                    type="color"
                    value={v.swatch[0]}
                    onChange={(e) => setVariant(index, { swatch: [e.target.value, ...v.swatch.slice(1)] })}
                  />
                </label>
              </div>
              <label className="shop-label">
                {t("Caratteristiche variante (una per riga; vuoto usa quelle del prodotto)")}
                <textarea
                  className="shop-input"
                  value={(language === 'it' ? v.specs : v.translations?.[language]?.specs)?.join('\n') ?? ''}
                  onChange={(e) => setVariantText(v.id, { specs: language === 'it' && !e.target.value ? undefined : e.target.value.split('\n') })}
                  onKeyDown={(e) => onTranslateKey(e, language, variantField(v, 'specs'))}
                />
              </label>
              <PhotoEditor language={language} images={v.images} library={library} onUpload={onUpload} onTranslateKey={onTranslateKey} onChange={(update) => setDraft(d => ({ ...d, variants: d.variants?.map(item => (item.id === v.id ? { ...item, images: update(item.images) } : item)) }))} />
              <button
                type="button"
                className="underline text-small"
                onClick={() => setDraft({ ...draft, variants: draft.variants?.filter((_, i) => i !== index) })}
              >
                {t("Elimina variante")}
              </button>
            </section>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() =>
              setDraft({
                ...draft,
                variants: [
                  ...(draft.variants ?? []),
                  {
                    id: crypto.randomUUID(),
                    label: 'Nuova variante',
                    price: draft.price,
                    priceCents: draft.priceCents,
                    codes: [],
                    swatch: ['#141414'],
                    images: [],
                  },
                ],
              })
            }
          >
            {t("Aggiungi variante")}
          </button>
        </div>
        <div className="flex flex-wrap gap-5 border-t border-line pt-6">
          <button type="submit" className="btn" disabled={STATIC_PREVIEW}>
            {busy ? t('Salvataggio…') : t('Salva prodotto')}
          </button>
          <button type="button" className="underline text-small" disabled={STATIC_PREVIEW} onClick={onDelete}>
            {t("Elimina prodotto")}
          </button>
        </div>
      </fieldset>
    </form>
  )
}
/** Homepage watch picks, owner order, at most four; same picking style as the similar-models editor. */
function FeaturedEditor({
  featured,
  models,
  busy,
  onSave,
}: {
  featured: string[]
  /** Whole catalog, hidden included. */
  models: Model[]
  busy: boolean
  onSave: (ids: string[]) => void
}) {
  const [ids, setIds] = useState(() => featured.filter((id) => models.some((m) => m.id === id)))
  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(ids)
      }}
    >
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        <legend className="mb-3 text-h2">{t("In evidenza in home")}</legend>
        <p className="text-xs text-muted">{t("Fino a 4 orologi mostrati in home prima di aprire il catalogo, in quest’ordine. Se la lista è vuota compaiono i primi 4 del catalogo. Gli orologi nascosti non vengono mostrati.")}</p>
        {ids.length > 0 && (
          <ol className="border-t border-line">
            {ids.map((fid, i) => {
              const other = models.find((m) => m.id === fid)
              const name = other?.name ?? fid
              const move = (to: number) =>
                setIds(current => {
                  const next = [...current]
                  next.splice(to, 0, ...next.splice(i, 1))
                  return next
                })
              return (
                <li key={fid} className="flex items-center gap-2 border-b border-line py-2 text-small">
                  <span className="w-6 tabular-nums text-muted">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">
                    {name}
                    {other?.availability === 'hidden' && <span className="text-xs text-muted"> · {t("Nascosto")}</span>}
                  </span>
                  <button type="button" className="min-h-11 min-w-11 underline disabled:no-underline" disabled={i === 0} aria-label={t("Sposta su: {name}", { name })} onClick={() => move(i - 1)}>↑</button>
                  <button type="button" className="min-h-11 min-w-11 underline disabled:no-underline" disabled={i === ids.length - 1} aria-label={t("Sposta giù: {name}", { name })} onClick={() => move(i + 1)}>↓</button>
                  <button type="button" className="min-h-11 px-2 underline" aria-label={t("Rimuovi {name}", { name })} onClick={() => setIds(current => current.filter((s) => s !== fid))}>{t("Rimuovi")}</button>
                </li>
              )
            })}
          </ol>
        )}
        {ids.length < 4 && (
          <label className="shop-label">
            {t("Aggiungi orologio in evidenza")}
            <select
              className="shop-input"
              value=""
              onChange={(e) => {
                const value = e.target.value
                if (value) setIds(current => [...current, value])
              }}
            >
              <option value="">{t("Scegli un modello…")}</option>
              {models
                .filter((m) => !ids.includes(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
            </select>
          </label>
        )}
        <button type="submit" className="btn" disabled={STATIC_PREVIEW}>
          {t("Salva in evidenza")}
        </button>
      </fieldset>
    </form>
  )
}
function PerfumeEditor({
  product,
  isNew,
  library,
  busy,
  onSave,
  onDelete,
  onUpload,
}: {
  product: Profumo
  /** A draft not yet on the site: deleting only discards it. */
  isNew: boolean
  library: Img[]
  busy: boolean
  onSave: (product: Profumo) => void
  onDelete: () => void
  onUpload: UploadPhotos
}) {
  // Perfumes saved before availability existed read as showcase only.
  const [draft, setDraft] = useState<Profumo>(() => {
    const copy = structuredClone(product)
    return { ...copy, availability: copy.availability ?? 'no-buy' }
  })
  // Selling needs a real price; the server rejects the same case.
  const priceMissing = draft.availability === 'buy' && !((draft.priceCents ?? 0) > 0)
  const [language, setLanguage] = useState<Locale>('it')
  const { status: translationStatus, handle: onTranslateKey } = useAutoTranslate()
  const text = perfumeText(draft, language)
  const setText = (patch: TextTranslation) => setDraft(d => withPerfumeText(d, language, patch))
  const perfumeField = (key: 'paragraphs' | 'specs' | 'quoteText'): TranslatableField => ({
    read: locale => perfumeText(draft, locale)[key],
    fill: (locale, value) => setDraft(d => (isBlank(perfumeText(d, locale)[key]) ? withPerfumeText(d, locale, textPatch(key, value)) : d)),
  })
  return (
    <form
      className="max-w-3xl space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (priceMissing) return
        onSave(draft)
      }}
    >
      <h2 className="text-h2">{isNew ? t('Aggiungi il profumo') : t('Il profumo')}</h2>
      <fieldset disabled={busy} className="min-w-0 space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="shop-label">
            {t("Nome")}
            <input
              className="shop-input"
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <PriceInput optional value={draft.priceCents ?? 0} onChange={(priceCents) => setDraft(d => ({ ...d, priceCents }))} />
          <label className="shop-label">
            {t("Linea")}
            <input
              className="shop-input"
              maxLength={120}
              placeholder="Pepe Nero"
              value={draft.line ?? ''}
              onChange={(event) => setDraft({ ...draft, line: event.target.value })}
            />
          </label>
          <label className="shop-label">
            {t("Codice")}
            <input
              className="shop-input"
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
            />
          </label>
        </div>
        <AvailabilityTiles values={PERFUME_AVAILABILITIES} value={draft.availability ?? 'no-buy'} onChange={(availability) => setDraft(d => ({ ...d, availability }))}>
          {priceMissing && (
            <p role="alert" className="mt-3 text-small font-medium">
              {t("Prezzo richiesto per vendere il profumo.")}
            </p>
          )}
        </AvailabilityTiles>
        <TextLanguages language={language} onChange={setLanguage} product={draft} translationStatus={translationStatus} />
        <label className="shop-label">
          {t("Descrizione (paragrafi separati da una riga vuota)")}
          <textarea
            className="shop-input min-h-48"
            value={text.paragraphs?.join('\n\n') ?? ''}
            onChange={(event) => setText({ paragraphs: event.target.value.split('\n\n') })}
            onKeyDown={(event) => onTranslateKey(event, language, perfumeField('paragraphs'))}
          />
        </label>
        <label className="shop-label">
          {t("Caratteristiche (una per riga)")}
          <textarea
            className="shop-input"
            value={text.specs?.join('\n') ?? ''}
            onChange={(event) => setText({ specs: event.target.value.split('\n') })}
            onKeyDown={(event) => onTranslateKey(event, language, perfumeField('specs'))}
          />
        </label>
        <label className="shop-label">
          {t("Ingredienti (uno per riga)")}
          <textarea
            className="shop-input"
            value={draft.ingredients.join('\n')}
            onChange={(event) => setDraft({ ...draft, ingredients: event.target.value.split('\n') })}
          />
        </label>
        <label className="shop-label">
          {t("Citazione")}
          <input
            className="shop-input"
            value={text.quoteText ?? ''}
            onChange={(event) => setText({ quoteText: event.target.value })}
            onKeyDown={(event) => onTranslateKey(event, language, perfumeField('quoteText'))}
          />
        </label>
        <label className="shop-label">
          {t("Autore")}
          <input
            className="shop-input"
            value={draft.quote.author ?? ''}
            onChange={(event) => setDraft({ ...draft, quote: { ...draft.quote, author: event.target.value } })}
          />
        </label>
        <PhotoEditor language={language} images={draft.images} library={library} onUpload={onUpload} onTranslateKey={onTranslateKey} onChange={(update) => setDraft(d => ({ ...d, images: update(d.images) }))} />
        <div className="flex gap-5">
          <button className="btn" type="submit" disabled={STATIC_PREVIEW}>
            {t("Salva profumo")}
          </button>
          <button className="underline text-small" type="button" disabled={STATIC_PREVIEW} onClick={onDelete}>
            {t("Elimina profumo")}
          </button>
        </div>
      </fieldset>
    </form>
  )
}
interface Order {
  id: string
  paypal_id: string
  status: string
  total: number
  created: number
  items: (OrderItemView & { engravingAccepted?: boolean })[]
  receipt: {
    captureId: string
    email?: string
    shipping?: { name?: { full_name: string }; address?: Record<string, string> }
  } | null
  /** Legacy order-level holder; new orders carry the certificate per item. */
  certificate: CertificateHolder | null
  certificateCode: string | null
  /** Readiness set by the owner; null until the payment is COMPLETED. */
  fulfillment: FulfillmentStatus | null
  history: { status: FulfillmentStatus; at: number }[]
  publicToken: string | null
  customerEmail: string | null
  emails: { kind: 'owner' | 'customer'; status: FulfillmentStatus; to: string; state: 'sent' | 'skipped' | 'failed'; error: string | null; at: number }[]
}
interface MailConfig {
  configured: boolean
  from: string
  owner: string
}
const EMAIL_STATE_LABELS: Record<Order['emails'][number]['state'], string> = { sent: 'inviata', skipped: 'non inviata', failed: 'non riuscita' }
/** Site origin used by the email preview for absolute asset URLs, without trailing slash. */
const previewOrigin = () => `${location.origin}${import.meta.env.BASE_URL}`.replace(/\/+$/, '')
/** Demo order for the email preview, built from the first catalog watch. */
function sampleOrder(models: Model[], status: FulfillmentStatus): PublicOrder {
  const model = models[0]
  const priceCents = model?.priceCents ?? 0
  const reached = FULFILLMENT_STATUSES.slice(0, FULFILLMENT_STATUSES.indexOf(status) + 1)
  const now = Date.now()
  return {
    reference: 'ANTEPRIMA-0001',
    created: now - reached.length * 86_400_000,
    total: priceCents,
    status,
    history: reached.map((s, index) => ({ status: s, at: now - (reached.length - 1 - index) * 86_400_000 })),
    items: [{
      kind: 'model',
      name: model?.name ?? 'ZITO 1950®',
      codes: model?.codes ?? [],
      quantity: 1,
      priceCents,
      image: model?.images[0] ?? null,
      certificate: { firstName: 'Mario', lastName: 'Rossi', email: 'mario.rossi@example.com' },
      engraving: 'Per sempre',
    }],
  }
}
/** Admin -> Email: customer email per readiness status, with a live sandboxed preview. */
function EmailTemplatesEditor({
  templates,
  mail,
  models,
  busy,
  onChange,
  onSave,
}: {
  templates: EmailTemplates
  mail: MailConfig | null
  models: Model[]
  busy: boolean
  onChange: (templates: EmailTemplates) => void
  onSave: () => void
}) {
  const [previewStatus, setPreviewStatus] = useState<FulfillmentStatus>('ricevuto')
  const update = (status: FulfillmentStatus, patch: Partial<EmailTemplate>) => onChange({ ...templates, [status]: { ...templates[status], ...patch } })
  const origin = previewOrigin()
  const preview = renderCustomerEmail(templates[previewStatus], sampleOrder(models, previewStatus), {
    origin,
    customerName: 'Mario',
    orderUrl: `${origin}/ordine/anteprima`,
  })
  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-h2">{t("Email ai clienti")}</h2>
        <div className="mt-3 text-small">
          {STATIC_PREVIEW ? (
            <p className="text-muted">{t("Anteprima UI: vengono mostrati i testi predefiniti e il salvataggio è disattivato.")}</p>
          ) : mail ? (
            <>
              <p>{mail.configured ? t('Invio email configurato') : t('SMTP non configurato: le email vengono registrate ma non inviate.')}</p>
              <p className="mt-1 break-all text-muted">{t("Mittente:")} {mail.from} · {t("Email del titolare:")} {mail.owner}</p>
            </>
          ) : (
            <p className="text-muted">—</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form
          className="min-w-0 space-y-8"
          onSubmit={(e) => {
            e.preventDefault()
            onSave()
          }}
        >
          <p className="text-small text-muted">
            {t("Puoi usare i segnaposto {nome} (nome del cliente), {ordine} (riferimento dell’ordine) e {stato} (stato dell’ordine). Nel messaggio una riga vuota separa i paragrafi.")}
          </p>
          {FULFILLMENT_STATUSES.map((status) => {
            const template = templates[status]
            return (
              <fieldset key={status} disabled={busy} className="min-w-0 space-y-4 border-t border-line pt-5" onFocus={() => setPreviewStatus(status)}>
                <legend className="eyebrow pr-3">{t(FULFILLMENT_LABELS[status])}</legend>
                <label className="flex items-center gap-3 text-small">
                  <input type="checkbox" className="accent-ink" checked={template.enabled} onChange={(e) => update(status, { enabled: e.target.checked })} />
                  {t("Attiva")}
                </label>
                <label className="shop-label">
                  {t("Oggetto")}
                  <input className="shop-input" maxLength={200} value={template.subject} onChange={(e) => update(status, { subject: e.target.value })} />
                </label>
                <label className="shop-label">
                  {t("Titolo")}
                  <input className="shop-input" maxLength={200} value={template.heading} onChange={(e) => update(status, { heading: e.target.value })} />
                </label>
                <label className="shop-label">
                  {t("Messaggio")}
                  <textarea className="shop-input min-h-32" maxLength={4000} value={template.message} onChange={(e) => update(status, { message: e.target.value })} />
                </label>
                <p className="text-xs text-muted">{t("Segnaposto:")} {'{nome} {ordine} {stato}'}</p>
                <button type="button" className="underline text-small" onClick={() => update(status, DEFAULT_EMAIL_TEMPLATES[status])}>
                  {t("Ripristina testo predefinito")}
                </button>
              </fieldset>
            )
          })}
          <button type="submit" className="btn" disabled={busy || STATIC_PREVIEW}>
            {t("Salva modelli email")}
          </button>
        </form>
        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <label className="shop-label">
            {t("Anteprima per")}
            <select className="shop-input" value={previewStatus} onChange={(e) => setPreviewStatus(e.target.value as FulfillmentStatus)}>
              {FULFILLMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{t(FULFILLMENT_LABELS[status])}</option>
              ))}
            </select>
          </label>
          <p className="mt-4 break-words text-small">
            <span className="text-muted">{t("Oggetto:")}</span> {preview.subject}
          </p>
          {!templates[previewStatus].enabled && <p className="mt-2 text-small text-muted">{t("Questa email è disattivata e non viene inviata.")}</p>}
          <iframe title={t("Anteprima dell’email")} srcDoc={preview.html} sandbox="" className="mt-4 h-[720px] w-full border border-line bg-white" />
        </div>
      </div>
    </section>
  )
}
export default function Admin() {
  const { locale } = useLocale()
  const { catalog, setCatalog, reload } = useShop()
  const [authenticated, setAuthenticated] = useState(STATIC_PREVIEW)
  const [checking, setChecking] = useState(!STATIC_PREVIEW)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [newProduct, setNewProduct] = useState<Model | null>(null)
  const [selectedPerfume, setSelectedPerfume] = useState<string | null>(null)
  const [newPerfume, setNewPerfume] = useState<Profumo | null>(null)
  const [tab, setTab] = useState<'products' | 'perfume' | 'photos' | 'orders' | 'email'>('products')
  const [orders, setOrders] = useState<Order[]>([])
  // Defaults until the server copy loads; the static preview keeps them, so its preview still renders.
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplates>(DEFAULT_EMAIL_TEMPLATES)
  const [mailConfig, setMailConfig] = useState<MailConfig | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoAlt, setPhotoAlt] = useState('')
  const [heroSrc, setHeroSrc] = useState('')
  const [heroAlt, setHeroAlt] = useState('')
  const [heroTranslations, setHeroTranslations] = useState<Img['altTranslations']>({})
  const [photoQuery, setPhotoQuery] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [replacements, setReplacements] = useState<Record<string, Img>>({})
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  // Uploads only add library photos, so open editors keep their drafts; any other catalog change remounts them.
  const uploadRevision = useRef<number | null>(null)
  const [editorRevision, setEditorRevision] = useState(catalog.revision)
  const { status: heroTranslationStatus, handle: onHeroTranslateKey } = useAutoTranslate()
  const heroAltField: TranslatableField = {
    read: language => (language === 'it' ? heroAlt : heroTranslations?.[language]),
    // Alt text is a single line, so the translation is always a string.
    fill: (language, value) => typeof value === 'string' && (language === 'it'
      ? setHeroAlt(current => (current.trim() ? current : value))
      : setHeroTranslations(current => (isBlank(current?.[language]) ? { ...current, [language]: value } : current))),
  }
  useEffect(() => {
    if (STATIC_PREVIEW) return
    void getSession()
      .then((session) => setAuthenticated(session.admin))
      .catch((error) => setStatus(error.message))
      .finally(() => setChecking(false))
  }, [])
  useEffect(() => {
    setHeroSrc(catalog.hero.src)
    setHeroAlt(catalog.hero.alt)
    setHeroTranslations(catalog.hero.altTranslations ?? {})
  }, [catalog.hero])
  useEffect(() => {
    if (catalog.revision !== uploadRevision.current) setEditorRevision(catalog.revision)
  }, [catalog.revision])
  const library = [
    ...new Map(
      [
        ...catalog.photos,
        ...catalog.siteImages,
        ...catalog.perfumes.flatMap((p) => p.images),
        ...catalog.models.flatMap((m) => [...m.images, ...(m.variants ?? []).flatMap((v) => v.images)]),
      ].map((im) => [im.src, im]),
    ).values(),
  ]
  const model = newProduct ?? catalog.models.find((m) => m.id === selected)
  const perfume = newPerfume ?? catalog.perfumes.find((p) => p.id === selectedPerfume)
  // Hero picker groups: every model and variant photo first, then site photos, then uploads; each src listed once.
  const heroSeen = new Set<string>()
  const heroGroup = (entries: { image: Img; label: string }[]) =>
    entries.filter(({ image }) => !heroSeen.has(image.src) && heroSeen.add(image.src))
  const heroGroups = [
    {
      label: 'Modelli',
      entries: heroGroup(catalog.models.flatMap((m) => [
        ...m.images.map((image) => ({ image, label: `${m.name} · ${photoLabel(image)}` })),
        ...(m.variants ?? []).flatMap((v) => v.images.map((image) => ({ image, label: `${m.name} · ${v.label} · ${photoLabel(image)}` }))),
      ])),
    },
    {
      label: 'Foto del sito',
      entries: heroGroup([
        catalog.hero,
        ...catalog.siteImages,
        ...catalog.perfumes.flatMap((p) => p.images),
      ].map((image) => ({ image, label: photoLabel(image) }))),
    },
    { label: 'Libreria', entries: heroGroup(catalog.photos.map((image) => ({ image, label: photoLabel(image) }))) },
  ]
  const pickHero = (image: Img | undefined, src: string) => {
    setHeroSrc(src)
    setHeroAlt(image?.alt ?? '')
    setHeroTranslations(image?.altTranslations ?? {})
  }
  async function perform(action: () => Promise<void>, message: string) {
    if (STATIC_PREVIEW) { setStatus('Anteprima UI: operazioni server e pubblicazione disattivate.'); return }
    if (busy) return
    setBusy(true)
    setStatus('Operazione in corso…')
    try {
      await action()
      setStatus(message)
    } catch (error) {
      setStatus((error as Error).message)
      if (!(await getSession().catch(() => null))?.admin) setAuthenticated(false)
    } finally {
      setBusy(false)
    }
  }
  async function uploadPhotos(files: File[], alt = ''): Promise<Img[]> {
    let images: Img[] = []
    await perform(async () => {
      const form = new FormData()
      for (const file of files) form.append('photo', file)
      form.append('alt', alt)
      form.append('revision', String(catalog.revision))
      const result = await api<{ catalog: Catalog; images: Img[] }>('/admin/photos', 'POST', form)
      uploadRevision.current = result.catalog.revision
      setCatalog(result.catalog)
      images = result.images
    }, 'Foto caricate.')
    return images
  }
  // Every photo the site shows, once per file, with where it appears; the hero is tagged rather than listed as a place.
  const inUse = new Map<string, { image: Img; places: string[] }>()
  const use = (image: Img, place?: string) => {
    const entry = inUse.get(image.src) ?? inUse.set(image.src, { image, places: [] }).get(image.src)!
    if (place && !entry.places.includes(place)) entry.places.push(place)
  }
  use(catalog.hero, t('Foto principale'))
  // Hero and perfume slots get their places from the live hero and perfumes below, not from the seed.
  catalog.siteImages.forEach((slot) => use(catalog.imageOverrides[slot.src] ?? slot, SITE_SECTIONS[slot.src] && t(SITE_SECTIONS[slot.src])))
  catalog.models.forEach((m) => {
    m.images.forEach((image) => use(image, m.name))
    m.variants?.forEach((v) => v.images.forEach((image) => use(image, `${m.name} · ${v.label}`)))
  })
  catalog.perfumes.forEach((p) => p.images.forEach((image) => use(image, p.name)))
  const photoNeedle = photoQuery.trim().toLowerCase()
  const shownInUse = [...inUse.values()].filter(({ image, places }) =>
    !photoNeedle || [photoLabel(image), image.src, ...places].join(' ').toLowerCase().includes(photoNeedle))
  // A selection can outlive its photo when another save removes it; only live sources are offered.
  const pending = selectedSources.filter((src) => inUse.has(src))
  const toggleSource = (src: string) =>
    setSelectedSources((current) => (current.includes(src) ? current.filter((s) => s !== src) : [...current, src]))
  const clearSelection = () => {
    setSelectedSources([])
    setReplacements({})
  }
  async function login(event: FormEvent) {
    event.preventDefault()
    await perform(async () => {
      await api('/admin/login', 'POST', { password })
      setPassword('')
      setAuthenticated(true)
      await reload()
    }, 'Accesso effettuato.')
  }
  return (
    <main className="container-site py-10 md:py-16">
      {STATIC_PREVIEW && <aside className="mb-8 border border-line p-5 text-small">
        <strong className="font-medium">{t("Anteprima pubblica dell’interfaccia · GitHub Pages")}</strong>
        <p className="mt-2">{t("Puoi esplorare i pannelli e modificare i campi per provare il layout. Salvataggio, eliminazione, caricamenti, accesso e pagamenti sono disattivati. Le modifiche ai campi vengono perse quando cambi prodotto o ricarichi la pagina. Nessun dato privato o ordine reale è caricato.")}</p>
      </aside>}
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <p className="eyebrow">ZITO 1950® · {STATIC_PREVIEW ? t('Anteprima UI') : t('Area riservata')}</p>
          <h1 className="mt-3 text-display">{t("Amministrazione")}</h1>
        </div>
        <div className="flex gap-5">
          <LanguageSelector />
          <a href={import.meta.env.BASE_URL} className="link-arrow">
            <span>{t("Visita il sito")}</span>
          </a>
          {authenticated && !STATIC_PREVIEW && (
            <button
              type="button"
              className="underline text-small"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await api('/admin/logout', 'POST', {})
                  setAuthenticated(false)
                }, 'Sessione chiusa.')
              }
            >
              {t("Esci")}
            </button>
          )}
        </div>
      </header>
      <p role="status" aria-live="polite" className="my-6 text-small">
        {checking ? t('Verifica della sessione…') : t(status)}
      </p>
      {!checking && !authenticated && (
        <form className="max-w-md space-y-6 py-10" onSubmit={(event) => void login(event)}>
          <h2 className="text-h2">{t("Accesso amministratore")}</h2>
          <p className="text-small text-muted">
            {t("Sessione protetta, scadenza dopo un’ora. Nessuna registrazione pubblica.")}
          </p>
          <label className="shop-label">
            {t("Password")}
            <input
              className="shop-input"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? t('Accesso…') : t('Accedi')}
          </button>
        </form>
      )}
      {authenticated && (
        <>
          <nav aria-label={t("Amministrazione")} className="mb-10 flex flex-wrap gap-6 border-b border-line pb-5">
            {(
              [
                ['products', t('Prodotti')],
                ['perfume', t('Profumi')],
                ['photos', t('Fotografie')],
                ['orders', t('Ordini')],
                ['email', t('Email')],
              ] as const
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                disabled={busy}
                aria-current={tab === key ? 'page' : undefined}
                className={`text-small ${tab === key ? 'underline underline-offset-8' : 'text-muted'}`}
                onClick={() => {
                  setTab(key)
                  if (key === 'orders' && !STATIC_PREVIEW)
                    void perform(async () => setOrders(await api<Order[]>('/admin/orders')), 'Ordini aggiornati.')
                  if (key === 'email' && !STATIC_PREVIEW)
                    void perform(async () => {
                      const [templates, mail] = await Promise.all([
                        api<EmailTemplates>('/admin/email-templates'),
                        api<MailConfig>('/admin/mail'),
                      ])
                      setEmailTemplates(templates)
                      setMailConfig(mail)
                    }, 'Modelli email caricati.')
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="ml-auto underline text-small"
              disabled={busy || STATIC_PREVIEW}
              onClick={() =>
                void perform(async () => {
                  setCatalog(await api<Catalog>('/catalog'))
                  setSelected(null)
                  setNewProduct(null)
                  setSelectedPerfume(null)
                  setNewPerfume(null)
                }, 'Catalogo aggiornato.')
              }
            >
              {t("Ricarica catalogo")}
            </button>
          </nav>
          {tab === 'perfume' && (
            <div className="grid grid-cols-1 gap-10 md:grid-cols-[250px_minmax(0,1fr)]">
              <aside>
                <button
                  type="button"
                  className="btn mb-5 w-full"
                  disabled={busy}
                  onClick={() => {
                    setSelectedPerfume(null)
                    setNewPerfume(blankPerfume())
                  }}
                >
                  {t("Aggiungi profumo")}
                </button>
                <ul className="max-h-[70vh] overflow-y-auto">
                  {catalog.perfumes.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`w-full border-b border-line py-4 text-left ${selectedPerfume === p.id ? 'font-medium' : ''}`}
                        disabled={busy}
                        onClick={() => {
                          if (perfume && !window.confirm(t('Aprire un altro profumo? Le modifiche non salvate saranno perse.')))
                            return
                          setSelectedPerfume(p.id)
                          setNewPerfume(null)
                        }}
                      >
                        <span className="block font-serif text-xl">{p.name}</span>
                        <span className="text-xs text-muted">
                          {t(AVAILABILITY_COPY[p.availability ?? 'no-buy'].label)}
                          {p.line && ` · ${p.line}`}
                          {p.code && ` · ${p.code}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
              <section>
                {perfume ? (
                  <PerfumeEditor
                    key={`${perfume.id}-${editorRevision}`}
                    product={perfume}
                    isNew={!!newPerfume}
                    library={library}
                    busy={busy}
                    onUpload={uploadPhotos}
                    onSave={(draft) =>
                      void perform(async () => {
                        // A new perfume takes a stable id from its first name; later renames keep it.
                        const product = newPerfume ? { ...draft, id: slugId(draft.name, catalog.perfumes.map((p) => p.id)) } : draft
                        setCatalog(await api<Catalog>(`/admin/perfumes/${product.id}`, 'PUT', { product, revision: catalog.revision }))
                        setNewPerfume(null)
                        setSelectedPerfume(product.id)
                      }, 'Profumo salvato e pubblicato.')
                    }
                    onDelete={() => {
                      if (newPerfume) {
                        setNewPerfume(null)
                        return
                      }
                      if (window.confirm(t('Eliminare {name} dal sito?', { name: perfume.name })))
                        void perform(async () => {
                          setCatalog(await api<Catalog>(`/admin/perfumes/${perfume.id}`, 'DELETE', { revision: catalog.revision }))
                          setSelectedPerfume(null)
                        }, 'Profumo eliminato.')
                    }}
                  />
                ) : (
                  <div className="border-t border-line pt-8">
                    <h2 className="text-h2">{t("I profumi")}</h2>
                    <p className="mt-4 text-ink-2">
                      {catalog.perfumes.length
                        ? t("Seleziona un profumo per modificarne descrizione, prezzo e fotografie, oppure aggiungine uno nuovo.")
                        : t("Nessun profumo sul sito. Aggiungine uno per mostrare la sezione Profumi.")}
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
          {tab === 'products' && (
            <div className="grid grid-cols-1 gap-10 md:grid-cols-[250px_minmax(0,1fr)]">
              <aside>
                <button
                  type="button"
                  className="btn mb-5 w-full"
                  disabled={busy}
                  onClick={() => {
                    setSelected(null)
                    setNewProduct({
                      id: crypto.randomUUID(),
                      name: '',
                      codes: [],
                      price: '',
                      priceCents: 100,
                      availability: 'no-buy',
                      gender: 'unisex',
                      limitedEdition: false,
                      piecesRemaining: null,
                      isNew: false,
                      similar: [],
                      specs: [],
                      images: [],
                    })
                  }}
                >
                  {t("Aggiungi prodotto")}
                </button>
                <ul className="max-h-[70vh] overflow-y-auto">
                  {catalog.models.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={`w-full border-b border-line py-4 text-left ${selected === m.id ? 'font-medium' : ''}`}
                        disabled={busy}
                        onClick={() => {
                          if (
                            model &&
                            !window.confirm(t('Aprire un altro prodotto? Le modifiche non salvate saranno perse.'))
                          )
                            return
                          setSelected(m.id)
                          setNewProduct(null)
                        }}
                      >
                        <span className="block font-serif text-xl">{m.name}</span>
                        <span className="text-xs text-muted">
                          {t(AVAILABILITY_COPY[m.availability ?? 'no-buy'].label)}
                          {m.isNew && ` · ${t('Nuovo')}`}
                          {m.limitedEdition && ` · ${t('Edizione limitata')}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
              <section>
                {model ? (
                  <ProductEditor
                    key={`${model.id}-${editorRevision}`}
                    model={model}
                    models={catalog.models}
                    library={library}
                    busy={busy}
                    onUpload={uploadPhotos}
                    onSave={(product) =>
                      void perform(async () => {
                        setCatalog(
                          await api<Catalog>(`/admin/products/${product.id}`, 'PUT', {
                            product,
                            revision: catalog.revision,
                          }),
                        )
                        setNewProduct(null)
                        setSelected(product.id)
                      }, 'Prodotto salvato e pubblicato.')
                    }
                    onDelete={() => {
                      if (newProduct) {
                        setNewProduct(null)
                        return
                      }
                      if (window.confirm(t('Eliminare {name} dal catalogo?', { name: model.name })))
                        void perform(async () => {
                          setCatalog(
                            await api<Catalog>(`/admin/products/${model.id}`, 'DELETE', { revision: catalog.revision }),
                          )
                          setSelected(null)
                        }, 'Prodotto eliminato.')
                    }}
                  />
                ) : (
                  <div className="space-y-12 border-t border-line pt-8">
                    <div>
                      <h2 className="text-h2">{t("La collezione")}</h2>
                      <p className="mt-4 text-ink-2">
                        {t("Seleziona un orologio per modificare descrizioni, prezzi, varianti e fotografie. Per ogni prodotto puoi scegliere la disponibilità e segnalare un’edizione limitata.")}
                      </p>
                    </div>
                    <FeaturedEditor
                      key={editorRevision}
                      featured={catalog.featured}
                      models={catalog.models}
                      busy={busy}
                      onSave={(ids) =>
                        void perform(async () =>
                          setCatalog(await api<Catalog>('/admin/featured', 'PUT', { ids, revision: catalog.revision })), 'Orologi in evidenza salvati e pubblicati.')
                      }
                    />
                  </div>
                )}
              </section>
            </div>
          )}
          {tab === 'photos' && (
            <div className="space-y-12">
              <form
                className="max-w-2xl space-y-5"
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  if (!photos.length) return
                  void uploadPhotos(photos, photoAlt).then((images) => {
                    if (!images.length) return
                    form.reset()
                    setPhotos([])
                    setPhotoAlt('')
                  })
                }}
              >
                <h2 className="text-h2">{t("Carica fotografie")}</h2>
                <p className="text-small text-muted">
                  {t("JPG, PNG e WebP, massimo 12 MB. Le foto vengono ridimensionate, private dei metadati e convertite in WebP.")}
                </p>
                <label className="shop-label">
                  {t("File")}
                  <input
                    type="file"
                    multiple
                    className="shop-input"
                    accept={PHOTO_TYPES}
                    required
                    disabled={busy}
                    onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
                  />
                </label>
                <label className="shop-label">
                  {t("Descrizione accessibile")}
                  <input
                    className="shop-input"
                    maxLength={500}
                    value={photoAlt}
                    onChange={(e) => setPhotoAlt(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn" disabled={busy || !photos.length || STATIC_PREVIEW}>
                  {t("Carica foto")}
                </button>
              </form>
              <form
                className="max-w-2xl space-y-5 border-t border-line pt-8"
                onSubmit={(e) => {
                  e.preventDefault()
                  void perform(async () =>
                    setCatalog(
                      await api<Catalog>('/admin/hero', 'PUT', {
                        image: { src: heroSrc, alt: heroAlt, altTranslations: heroTranslations },
                        revision: catalog.revision,
                      }),
                    ), 'Foto principale aggiornata.')
                }}
              >
                <h2 className="text-h2">{t("Foto principale")}</h2>
                <img src={asset(heroSrc)} alt={heroAlt} className="max-h-64 w-full object-contain" />
                <label className="shop-label">
                  {t("Fotografia")}
                  <select className="shop-input" value={heroSrc} onChange={(e) => {
                    const src = e.target.value
                    pickHero(heroGroups.flatMap((group) => group.entries).find(({ image }) => image.src === src)?.image, src)
                  }}>
                    {heroGroups.filter((group) => group.entries.length).map((group) => (
                      <optgroup key={group.label} label={t(group.label)}>
                        {group.entries.map(({ image, label }) => (
                          <option key={image.src} value={image.src}>
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="shop-label">
                  {t("Descrizione")}
                  <input className="shop-input" required value={heroAlt} onChange={(e) => setHeroAlt(e.target.value)} onKeyDown={(e) => onHeroTranslateKey(e, 'it', heroAltField)} />
                </label>
                {LOCALES.filter(language => language !== 'it').map(language => <label key={language} className="shop-label">
                  {LANGUAGE_NAMES[language]} · {t('Descrizione foto')}
                  <input className="shop-input" maxLength={500} value={heroTranslations?.[language] ?? ''} onChange={event => setHeroTranslations(current => ({ ...current, [language]: event.target.value }))} onKeyDown={event => onHeroTranslateKey(event, language, heroAltField)} />
                </label>)}
                <AutoTranslateHint status={heroTranslationStatus} />
                <button type="submit" className="btn" disabled={busy || STATIC_PREVIEW}>
                  {t("Salva foto principale")}
                </button>
              </form>
              <section className="space-y-5 border-t border-line pt-8">
                <h2 className="text-h2">{t("Fotografie del sito")}</h2>
                <p className="text-small text-muted">{t("Seleziona una o più foto, scegli per ciascuna la nuova foto e salva.")}</p>
                <label className="shop-label max-w-md">
                  {t("Cerca per nome")}
                  <input type="search" className="shop-input" value={photoQuery} onChange={(e) => setPhotoQuery(e.target.value)} />
                </label>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="min-w-0">
                    <h3 id="site-photos-from" className="text-h3">{t("Da sostituire")}</h3>
                    {/* Scroll container keeps the long in-use list from pushing the page; focusable for keyboard scrolling. */}
                    <div role="region" aria-labelledby="site-photos-from" tabIndex={0} className="mt-3 max-h-[60vh] overflow-y-auto border border-line px-3">
                      {!shownInUse.length && <p className="py-3 text-small">{t("Nessuna foto trovata.")}</p>}
                      <ul className="divide-y divide-line">
                        {shownInUse.map(({ image, places }) => (
                          <li key={image.src}>
                            <label className="grid cursor-pointer grid-cols-[auto_56px_minmax(0,1fr)] items-center gap-3 py-2">
                              <input
                                type="checkbox"
                                className="accent-ink"
                                checked={pending.includes(image.src)}
                                onChange={() => toggleSource(image.src)}
                              />
                              <img src={asset(image.src)} alt="" loading="lazy" className="h-14 w-14 bg-well object-contain" />
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="break-words text-small font-medium">{photoLabel(image)}</span>
                                  {image.src === catalog.hero.src && (
                                    <span className="border border-ink bg-ink px-2 py-0.5 text-xs font-medium uppercase tracking-[0.08em] text-bg">{t("Principale")}</span>
                                  )}
                                </span>
                                {places.length > 0 && <span className="mt-1 block break-words text-xs text-muted">{places.join(' · ')}</span>}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <form
                    className="min-w-0"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!pending.length || !pending.every((src) => replacements[src])) return
                      void perform(async () => {
                        setCatalog(
                          await api<Catalog>('/admin/images/replace', 'PUT', {
                            replacements: pending.map((source) => ({ source, image: replacements[source] })),
                            revision: catalog.revision,
                          }),
                        )
                        clearSelection()
                      }, 'Fotografie sostituite.')
                    }}
                  >
                    <h3 id="site-photos-to" className="text-h3">
                      {t("Sostituisci con")}
                      {pending.length > 0 && <span className="ml-2 text-small text-muted">({pending.length})</span>}
                    </h3>
                    <div role="region" aria-labelledby="site-photos-to" tabIndex={0} className="mt-3 max-h-[60vh] overflow-y-auto border border-line px-3">
                      {!pending.length && <p className="py-3 text-small text-muted">{t("Seleziona a sinistra le foto da sostituire.")}</p>}
                      <ul className="divide-y divide-line">
                        {pending.map((source) => {
                          const current = inUse.get(source)!.image
                          const next = replacements[source]
                          return (
                            <li key={source} className="grid grid-cols-[56px_auto_56px_minmax(0,1fr)] items-center gap-3 py-2">
                              <img src={asset(source)} alt="" className="h-14 w-14 bg-well object-contain" />
                              <span aria-hidden="true">→</span>
                              {next ? (
                                <img src={asset(next.src)} alt="" className="h-14 w-14 bg-well object-contain" />
                              ) : (
                                <span className="h-14 w-14 border border-dashed border-line" />
                              )}
                              <div className="min-w-0 text-small">
                                <p className="break-words">{photoLabel(current)} → {next ? photoLabel(next) : '—'}</p>
                                <button
                                  type="button"
                                  className="mt-1 underline"
                                  aria-label={`${t("Scegli la nuova foto")}: ${photoLabel(current)}`}
                                  onClick={() => setPickerFor(source)}
                                >
                                  {t("Scegli")}
                                </button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-5">
                      <button type="submit" className="btn" disabled={busy || STATIC_PREVIEW || !pending.length || !pending.every((src) => replacements[src])}>
                        {t("Sostituisci foto")}
                      </button>
                      {pending.length > 0 && (
                        <button type="button" className="underline text-small" onClick={clearSelection}>
                          {t("Annulla selezione")}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
                <PhotoPicker
                  open={pickerFor !== null}
                  library={library.filter((im) => im.src !== pickerFor)}
                  busy={busy}
                  onUpload={uploadPhotos}
                  onPick={(image) => pickerFor && setReplacements((current) => ({ ...current, [pickerFor]: image }))}
                  onClose={() => setPickerFor(null)}
                />
              </section>
              <section className="border-t border-line pt-8">
                <h2 className="text-h2">{t("Libreria caricamenti")}</h2>
                <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {catalog.photos.map((im) => (
                    <li key={im.src}>
                      <img src={asset(im.src)} alt={im.alt} loading="lazy" className="h-48 w-full bg-well object-contain" />
                      <p className="mt-3 flex flex-wrap items-center gap-2 break-words text-small">
                        {photoLabel(im)}
                        {im.src === catalog.hero.src && (
                          <span className="border border-ink bg-ink px-2 py-0.5 text-xs font-medium uppercase tracking-[0.08em] text-bg">{t("Principale")}</span>
                        )}
                      </p>
                      <button
                        type="button"
                        className="mt-3 underline text-small"
                        disabled={busy || STATIC_PREVIEW}
                        onClick={() => {
                          if (window.confirm(t('Rimuovere la foto dalla libreria?')))
                            void perform(async () =>
                              setCatalog(
                                await api<Catalog>(
                                  `/admin/photos/${im.src.split('/')[1].replace('.webp', '')}`,
                                  'DELETE',
                                  { revision: catalog.revision },
                                ),
                              ), 'Foto rimossa dalla libreria.')
                        }}
                      >
                        {t("Elimina foto")}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
          {tab === 'orders' && (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-h2">{t("Ordini recenti")}</h2>
                <button
                  type="button"
                  className="underline text-small"
                  disabled={busy || STATIC_PREVIEW}
                  onClick={() => void perform(async () => setOrders(await api<Order[]>('/admin/orders')), 'Ordini aggiornati.')}
                >
                  {t("Ricarica ordini")}
                </button>
              </div>
              <p className="mt-3 text-small text-muted">
                {t("Spedisci solo ordini COMPLETED. Gli ordini in attesa non confermano un pagamento.")}
              </p>
              {!orders.length && <p className="mt-8">{STATIC_PREVIEW ? t('Gli ordini reali richiedono il backend; nessun ordine è caricato nell’anteprima.') : t('Nessun ordine.')}</p>}
              <ul className="mt-8 space-y-8">
                {orders.map((order) => (
                  <li key={order.id} className="border-t border-line pt-5">
                    <div className="flex flex-wrap justify-between gap-4">
                      <h3 className="text-h3">
                        {euro(order.total)} · {order.status}
                      </h3>
                      <span className="text-small">{new Date(order.created).toLocaleString(LANGUAGE_TAGS[locale])}</span>
                    </div>
                    <p className="mt-2 break-all text-small">
                      {t('Riferimento:')} {order.id} · PayPal: {order.paypal_id ?? t('in preparazione')}
                    </p>
                    {order.publicToken && (
                      <a href={`${import.meta.env.BASE_URL}ordine/${order.publicToken}`} target="_blank" rel="noopener" className="link-arrow mt-2 text-small">
                        <span>{t("Apri pagina ordine")}</span>
                      </a>
                    )}
                    <ul className="mt-4 space-y-4 text-small">
                      {order.items.map((item, index) => (
                        <li key={index} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3">
                          {item.image ? <img src={asset(item.image.src)} alt="" className="h-14 w-14 bg-well object-contain" /> : <span className="h-14 w-14 bg-well" />}
                          <div className="min-w-0">
                            <p>
                              {item.quantity} × {item.name} · {euro(item.priceCents)}
                            </p>
                            {!!item.codes?.length && <p className="text-muted">{t("Codici:")} {item.codes.join(', ')}</p>}
                            {item.certificate && (
                              <p className="break-words">
                                {t("Certificato:")} {item.certificate.firstName} {item.certificate.lastName} · <span className="break-all">{item.certificate.email}</span>
                              </p>
                            )}
                            {item.engraving && (
                              <p className="break-words">
                                {t("Incisione:")} «{item.engraving}» · {t("non restituibile")}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {order.customerEmail && (
                      <p className="mt-4 break-all text-small">{t("Email del cliente:")} {order.customerEmail}</p>
                    )}
                    {order.receipt && (
                      <div className="mt-4 text-small">
                        <p>{t("Pagamento:") + ' '}{order.receipt.captureId}</p>
                        <p>{order.receipt.email}</p>
                        <p>{order.receipt.shipping?.name?.full_name}</p>
                        <p>{Object.values(order.receipt.shipping?.address ?? {}).join(', ')}</p>
                      </div>
                    )}
                    <section className="mt-5 border border-line p-5" aria-labelledby={`fulfillment-${order.id}`}>
                      <h4 id={`fulfillment-${order.id}`} className="text-small font-medium">{t("Stato dell’ordine")}</h4>
                      <p className="mt-2 text-small">{order.fulfillment ? t(FULFILLMENT_LABELS[order.fulfillment]) : '—'}</p>
                      <form
                        key={`${order.id}-${order.fulfillment ?? ''}`}
                        className="mt-4 flex flex-wrap items-end gap-4"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const form = new FormData(e.currentTarget)
                          const next = String(form.get('status')) as FulfillmentStatus
                          const notify = form.get('notify') === 'on'
                          void perform(async () => {
                            const updated = await api<Order>(`/admin/orders/${order.id}/status`, 'PUT', { status: next, notify })
                            setOrders((list) => list.map((item) => (item.id === updated.id ? updated : item)))
                          }, notify ? 'Stato aggiornato. L’email al cliente è in invio: ricarica gli ordini per vederne l’esito.' : 'Stato aggiornato.')
                        }}
                      >
                        <fieldset disabled={busy || STATIC_PREVIEW || order.status !== 'COMPLETED'} className="contents">
                          <label className="shop-label min-w-0 flex-1">
                            {t("Stato")}
                            <select className="shop-input" name="status" defaultValue={order.fulfillment ?? 'ricevuto'}>
                              {FULFILLMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>{t(FULFILLMENT_LABELS[s])}</option>
                              ))}
                            </select>
                          </label>
                          <label className="flex items-center gap-3 pb-3 text-small">
                            <input type="checkbox" className="accent-ink" name="notify" defaultChecked />
                            {t("Invia email al cliente")}
                          </label>
                          <button type="submit" className="btn">
                            {t("Aggiorna stato")}
                          </button>
                        </fieldset>
                      </form>
                      {order.status !== 'COMPLETED' && (
                        <p className="mt-3 text-small text-muted">{t("Lo stato si può aggiornare solo per ordini pagati (COMPLETED).")}</p>
                      )}
                      {!!order.history?.length && (
                        <>
                          <h5 className="eyebrow mt-5">{t("Cronologia")}</h5>
                          <ol className="mt-2 space-y-1 text-small">
                            {order.history.map((entry, index) => (
                              <li key={index}>
                                {t(FULFILLMENT_LABELS[entry.status])} · {new Date(entry.at).toLocaleString(LANGUAGE_TAGS[locale])}
                              </li>
                            ))}
                          </ol>
                        </>
                      )}
                      {!!order.emails?.length && (
                        <>
                          <h5 className="eyebrow mt-5">{t("Email")}</h5>
                          <ul className="mt-2 space-y-1 text-small">
                            {order.emails.map((mail, index) => (
                              <li key={index} className="break-words">
                                {mail.kind === 'owner' ? t('titolare') : t('cliente')} · {t(FULFILLMENT_LABELS[mail.status])} · <span className="break-all">{mail.to}</span> · {t(EMAIL_STATE_LABELS[mail.state])}
                                {mail.error && <span className="text-muted"> · {mail.error}</span>} · {new Date(mail.at).toLocaleString(LANGUAGE_TAGS[locale])}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </section>
                    {order.certificate && (
                      // Legacy orders: one order-level holder, before the per-item certificate.
                      <section className="mt-5 border border-line p-5" aria-labelledby={`certificate-${order.id}`}>
                        <h4 id={`certificate-${order.id}`} className="text-small font-medium">{t("Certificato")}</h4>
                        <div className="mt-3 text-small">
                          <p>{order.certificate.firstName} {order.certificate.lastName}</p>
                          <p className="break-all">{order.certificate.email}</p>
                        </div>
                      </section>
                    )}
                    <form
                      key={`${order.id}-${order.certificateCode ?? ''}`}
                      className="mt-4 flex flex-wrap items-end gap-4"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const code = String(new FormData(e.currentTarget).get('code') ?? '')
                        void perform(async () => {
                          const updated = await api<Order>(`/admin/orders/${order.id}/certificate`, 'PUT', { code })
                          setOrders((list) => list.map((item) => (item.id === updated.id ? updated : item)))
                        }, 'Codice certificato salvato.')
                      }}
                    >
                      <label className="shop-label min-w-0 flex-1">
                        {t("Codice certificato")}
                        <input className="shop-input" name="code" maxLength={80} defaultValue={order.certificateCode ?? ''} />
                      </label>
                      <button type="submit" className="btn" disabled={busy || STATIC_PREVIEW}>
                        {t("Salva codice")}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tab === 'email' && (
            <EmailTemplatesEditor
              templates={emailTemplates}
              mail={mailConfig}
              models={catalog.models}
              busy={busy}
              onChange={setEmailTemplates}
              onSave={() =>
                void perform(async () => setEmailTemplates(await api<EmailTemplates>('/admin/email-templates', 'PUT', emailTemplates)), 'Modelli email salvati.')
              }
            />
          )}
        </>
      )}
    </main>
  )
}
