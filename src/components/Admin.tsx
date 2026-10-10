import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AVAILABILITIES, type Availability, type CertificateHolder, type Img, type Model, type Profumo, type Variant, type TextTranslation } from '../data/types'
import { api, euro, getSession, STATIC_PREVIEW, useShop, type Catalog } from '../lib/shop'
import { profumo as originalPerfume } from '../data/content'
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
// Admin copy for each public availability state: tile title and one-line effect on the site.
const AVAILABILITY_COPY: Record<Availability, { label: string; hint: string }> = {
  buy: { label: 'Acquistabile', hint: 'Mostra il pulsante Acquista e il prezzo.' },
  'no-buy': { label: 'Solo vetrina', hint: 'Visibile, senza pulsante di acquisto.' },
  'out-of-stock': { label: 'Esaurito', hint: 'Visibile con l’etichetta Esaurito.' },
  hidden: { label: 'Nascosto', hint: 'Non compare sul sito.' },
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
  const [selected, setSelected] = useState('')
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
      <div className="flex flex-wrap gap-3">
        <select
          aria-label={t("Foto dalla libreria")}
          className="shop-input min-w-0 flex-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">{t("Seleziona dalla libreria")}</option>
          {library.map((im) => (
            <option key={im.src} value={im.src}>
              {photoLabel(im)}
            </option>
          ))}
        </select>
        <button
          className="btn"
          type="button"
          disabled={!selected}
          onClick={() => {
            const photo = library.find((im) => im.src === selected)
            if (photo) onChange(current => [...current, { ...photo }])
            setSelected('')
          }}
        >
          {t("Aggiungi foto")}
        </button>
      </div>
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
}: {
  value: number
  onChange: (cents: number) => void
  label?: string
}) {
  const [raw, setRaw] = useState((value / 100).toFixed(2))
  return (
    <label className="shop-label">
      {t(label)}
      <input
        className="shop-input"
        type="number"
        min="0.01"
        max="1000000"
        step="0.01"
        required
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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <fieldset className="min-w-0">
            <legend className="mb-3 text-small font-medium">{t("Disponibilità")}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {AVAILABILITIES.map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-3 border border-line p-4 has-[:checked]:border-ink has-[:checked]:bg-well has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
                >
                  <input
                    type="radio"
                    name="availability"
                    value={value}
                    className="mt-1 accent-ink focus-visible:outline-none"
                    checked={(draft.availability ?? 'no-buy') === value}
                    onChange={() => setDraft(d => ({ ...d, availability: value }))}
                  />
                  <span className="min-w-0">
                    <span className="block text-small font-medium">{t(AVAILABILITY_COPY[value].label)}</span>
                    <span className="mt-1 block text-xs text-muted">{t(AVAILABILITY_COPY[value].hint)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
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
function PerfumeEditor({
  product,
  library,
  busy,
  onSave,
  onDelete,
  onUpload,
}: {
  product: Profumo | null
  library: Img[]
  busy: boolean
  onSave: (product: Profumo) => void
  onDelete: () => void
  onUpload: UploadPhotos
}) {
  const [draft, setDraft] = useState<Profumo>(() =>
    structuredClone(product ?? { ...originalPerfume, priceCents: 12000 }),
  )
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
        onSave(draft)
      }}
    >
      <h2 className="text-h2">{product ? t('Il profumo') : t('Aggiungi il profumo')}</h2>
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
          <PriceInput value={draft.priceCents ?? 12000} onChange={(priceCents) => setDraft({ ...draft, priceCents })} />
          <label className="shop-label">
            {t("Codice")}
            <input
              className="shop-input"
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
            />
          </label>
        </div>
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
          {product && (
            <button className="underline text-small" type="button" disabled={STATIC_PREVIEW} onClick={onDelete}>
              {t("Elimina profumo")}
            </button>
          )}
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
  items: { name: string; quantity: number; priceCents: number }[]
  receipt: {
    captureId: string
    email?: string
    shipping?: { name?: { full_name: string }; address?: Record<string, string> }
    payer: { firstName: string; lastName: string; email: string } | null
  } | null
  certificate: CertificateHolder | null
  certificateCode: string | null
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
  const [tab, setTab] = useState<'products' | 'perfume' | 'photos' | 'orders'>('products')
  const [orders, setOrders] = useState<Order[]>([])
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
        ...(catalog.perfume?.images ?? []),
        ...catalog.models.flatMap((m) => [...m.images, ...(m.variants ?? []).flatMap((v) => v.images)]),
      ].map((im) => [im.src, im]),
    ).values(),
  ]
  const model = newProduct ?? catalog.models.find((m) => m.id === selected)
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
      entries: heroGroup([catalog.hero, ...catalog.siteImages, ...(catalog.perfume?.images ?? [])].map((image) => ({ image, label: photoLabel(image) }))),
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
  use(catalog.hero)
  catalog.siteImages.forEach((slot) => use(catalog.imageOverrides[slot.src] ?? slot, t('Foto del sito')))
  catalog.models.forEach((m) => {
    m.images.forEach((image) => use(image, m.name))
    m.variants?.forEach((v) => v.images.forEach((image) => use(image, `${m.name} · ${v.label}`)))
  })
  catalog.perfume?.images.forEach((image) => use(image, t('Profumo')))
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
          <p className="eyebrow">ZITO 1950 · {STATIC_PREVIEW ? t('Anteprima UI') : t('Area riservata')}</p>
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
                ['perfume', t('Profumo')],
                ['photos', t('Fotografie')],
                ['orders', t('Ordini')],
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
                }, 'Catalogo aggiornato.')
              }
            >
              {t("Ricarica catalogo")}
            </button>
          </nav>
          {tab === 'perfume' && (
            <PerfumeEditor
              key={editorRevision}
              product={catalog.perfume}
              library={library}
              busy={busy}
              onUpload={uploadPhotos}
              onSave={(product) =>
                void perform(async () =>
                  setCatalog(await api<Catalog>('/admin/perfume', 'PUT', { product, revision: catalog.revision })), 'Profumo salvato e pubblicato.')
              }
              onDelete={() => {
                if (window.confirm(t('Eliminare il profumo dal sito?')))
                  void perform(async () =>
                    setCatalog(
                      await api<Catalog>('/admin/perfume', 'PUT', { product: null, revision: catalog.revision }),
                    ), 'Profumo eliminato.')
              }}
            />
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
                  <div className="border-t border-line pt-8">
                    <h2 className="text-h2">{t("La collezione")}</h2>
                    <p className="mt-4 text-ink-2">
                      {t("Seleziona un orologio per modificare descrizioni, prezzi, varianti e fotografie. Per ogni prodotto puoi scegliere la disponibilità e segnalare un’edizione limitata.")}
                    </p>
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
                {!shownInUse.length && <p className="text-small">{t("Nessuna foto trovata.")}</p>}
                <ul className="divide-y divide-line border-y border-line">
                  {shownInUse.map(({ image, places }) => (
                    <li key={image.src}>
                      <label className="grid cursor-pointer grid-cols-[auto_64px_minmax(0,1fr)] items-center gap-4 py-3">
                        <input
                          type="checkbox"
                          className="accent-ink"
                          checked={pending.includes(image.src)}
                          onChange={() => toggleSource(image.src)}
                        />
                        <img src={asset(image.src)} alt="" loading="lazy" className="h-16 w-16 bg-well object-contain" />
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
                {pending.length > 0 && (
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!pending.every((src) => replacements[src])) return
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
                    <h3 className="text-h3">{t("Sostituisci selezionate ({count})", { count: pending.length })}</h3>
                    <ul className="space-y-3">
                      {pending.map((source) => {
                        const current = inUse.get(source)!.image
                        const next = replacements[source]
                        return (
                          <li key={source} className="grid grid-cols-[64px_auto_64px_minmax(0,1fr)] items-center gap-3">
                            <img src={asset(source)} alt="" className="h-16 w-16 bg-well object-contain" />
                            <span aria-hidden="true">→</span>
                            {next ? (
                              <img src={asset(next.src)} alt="" className="h-16 w-16 bg-well object-contain" />
                            ) : (
                              <span className="h-16 w-16 border border-dashed border-line" />
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
                    <div className="flex flex-wrap items-center gap-5">
                      <button type="submit" className="btn" disabled={busy || STATIC_PREVIEW || !pending.every((src) => replacements[src])}>
                        {t("Sostituisci foto")}
                      </button>
                      <button type="button" className="underline text-small" onClick={clearSelection}>
                        {t("Annulla selezione")}
                      </button>
                    </div>
                  </form>
                )}
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
              <h2 className="text-h2">{t("Ordini recenti")}</h2>
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
                    <ul className="mt-3 text-small">
                      {order.items.map((item, index) => (
                        <li key={index}>
                          {item.quantity} × {item.name} · {euro(item.priceCents)}
                        </li>
                      ))}
                    </ul>
                    {order.receipt && (
                      <div className="mt-4 text-small">
                        <p>{t("Pagamento:") + ' '}{order.receipt.captureId}</p>
                        <p>{order.receipt.email}</p>
                        <p>{order.receipt.shipping?.name?.full_name}</p>
                        <p>{Object.values(order.receipt.shipping?.address ?? {}).join(', ')}</p>
                      </div>
                    )}
                    {(() => {
                      const holder = order.certificate ?? order.receipt?.payer ?? null
                      return (
                        <section className="mt-5 border border-line p-5" aria-labelledby={`certificate-${order.id}`}>
                          <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <h4 id={`certificate-${order.id}`} className="text-small font-medium">{t("Certificato")}</h4>
                            <span className="text-xs text-muted">
                              {order.certificate ? t('Personalizzato dal cliente') : holder ? t('Dati PayPal') : t('In attesa del pagamento')}
                            </span>
                          </div>
                          {holder && (
                            <div className="mt-3 text-small">
                              <p>{holder.firstName} {holder.lastName}</p>
                              <p className="break-all">{holder.email}</p>
                            </div>
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
                        </section>
                      )
                    })()}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}
