import { useEffect, useState, type FormEvent } from 'react'
import type { Img, Model, Profumo, Variant, TextTranslation } from '../data/types'
import { api, euro, getSession, STATIC_PREVIEW, useShop, type Catalog } from '../lib/shop'
import { profumo as originalPerfume } from '../data/content'
import { asset } from '../lib/asset'
import { t, LanguageSelector, useLocale } from '../lib/i18n'
import { LOCALES, LANGUAGE_NAMES, LANGUAGE_TAGS, missingTranslationFields, type Locale } from '../data/localization'

function TextLanguages({ language, onChange, product }: { language: Locale; onChange: (language: Locale) => void; product: Model | Profumo }) {
  return <section className="space-y-3 border-y border-line py-5">
    <p className="eyebrow">{t('Lingua dei contenuti')}</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('Lingua dei contenuti')}>
      {LOCALES.map(code => <button type="button" key={code} aria-pressed={language === code} className={`border border-line px-3 py-2 text-small ${language === code ? 'bg-ink text-bg' : ''}`} onClick={() => onChange(code)}>{LANGUAGE_NAMES[code]}{code !== 'it' && missingTranslationFields(product, code).length > 0 ? ' · !' : ''}</button>)}
    </div>
    <p className="text-small text-muted">{t('Nomi prodotto, codici, prezzi e fotografie sono condivisi. I testi si salvano insieme per tutte le lingue. Le traduzioni mancanti usano il testo italiano.')}</p>
    {language !== 'it' && missingTranslationFields(product, language).length > 0 && <p role="status" className="text-small">{t('Traduzioni mancanti:')} {missingTranslationFields(product, language).map(field => t(field)).join(', ')}</p>}
  </section>
}
function PhotoEditor({
  images,
  onChange,
  library,
  language = 'it',
}: {
  images: Img[]
  onChange: (images: Img[]) => void
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
            <div>
              <label className="text-small">
                {t("Descrizione foto")}
                <input
                  className="shop-input w-full"
                  value={language === 'it' ? im.alt : im.altTranslations?.[language] ?? ''}
                  onChange={(e) =>
                    onChange(images.map((item, i) => i === index ? language === 'it' ? { ...item, alt: e.target.value } : { ...item, altTranslations: { ...item.altTranslations, [language]: e.target.value } } : item))
                  }
                />
              </label>
              <div className="mt-2 flex gap-4 text-small">
                <button
                  type="button"
                  className="underline"
                  disabled={index === 0}
                  onClick={() => {
                    const reordered = [...images]
                    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
                    onChange(reordered)
                  }}
                >
                  {t("Sposta prima")}
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
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
              {im.alt || im.src}
            </option>
          ))}
        </select>
        <button
          className="btn"
          type="button"
          disabled={!selected}
          onClick={() => {
            const photo = library.find((im) => im.src === selected)
            if (photo) onChange([...images, { ...photo }])
            setSelected('')
          }}
        >
          {t("Aggiungi foto")}
        </button>
      </div>
    </div>
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
  library,
  busy,
  onSave,
  onDelete,
}: {
  model: Model
  library: Img[]
  busy: boolean
  onSave: (model: Model) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState<Model>(() => structuredClone(model))
  const [language, setLanguage] = useState<Locale>('it')
  const text = language === 'it' ? { description: draft.description, specs: draft.specs, quoteText: draft.quote?.text } : draft.translations?.[language] ?? {}
  const setText = (patch: TextTranslation) => setDraft(language === 'it' ? { ...draft, ...(patch.description !== undefined ? { description: patch.description } : {}), ...(patch.specs !== undefined ? { specs: patch.specs } : {}), ...(patch.quoteText !== undefined ? { quote: { ...draft.quote, text: patch.quoteText } } : {}) } : { ...draft, translations: { ...draft.translations, [language]: { ...draft.translations?.[language], ...patch } } })
  const setVariant = (index: number, patch: Partial<Variant>) =>
    setDraft({ ...draft, variants: draft.variants?.map((v, i) => (i === index ? { ...v, ...patch } : v)) })
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
          <label className="flex items-center gap-3 text-small">
            <input
              type="checkbox"
              checked={!!draft.buyEnabled}
              onChange={(e) => setDraft({ ...draft, buyEnabled: e.target.checked })}
            />{' '}
            {t("Abilita acquisto e pulsante Acquista")}
          </label>
        </div>
        <TextLanguages language={language} onChange={setLanguage} product={draft} />
        <label className="shop-label">
          {t("Descrizione")}
          <textarea
            className="shop-input min-h-32"
            value={text.description ?? ''}
            onChange={(e) => setText({ description: e.target.value })}
          />
        </label>
        <label className="shop-label">
          {t("Caratteristiche (una per riga)")}
          <textarea
            className="shop-input min-h-32"
            value={text.specs?.join('\n') ?? ''}
            onChange={(e) => setText({ specs: e.target.value.split('\n') })}
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="shop-label">
            {t("Citazione")}
            <input
              className="shop-input"
              value={text.quoteText ?? ''}
              onChange={(e) => setText({ quoteText: e.target.value })}
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
        <PhotoEditor language={language} images={draft.images} library={library} onChange={(images) => setDraft({ ...draft, images })} />
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
                    onChange={(e) => setVariant(index, language === 'it' ? { label: e.target.value } : { translations: { ...v.translations, [language]: { ...v.translations?.[language], label: e.target.value } } })}
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
                  onChange={(e) => setVariant(index, language === 'it' ? { specs: e.target.value ? e.target.value.split('\n') : undefined } : { translations: { ...v.translations, [language]: { ...v.translations?.[language], specs: e.target.value.split('\n') } } })}
                />
              </label>
              <PhotoEditor language={language} images={v.images} library={library} onChange={(images) => setVariant(index, { images })} />
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
}: {
  product: Profumo | null
  library: Img[]
  busy: boolean
  onSave: (product: Profumo) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState<Profumo>(() =>
    structuredClone(product ?? { ...originalPerfume, priceCents: 12000 }),
  )
  const [language, setLanguage] = useState<Locale>('it')
  const text = language === 'it' ? { paragraphs: draft.paragraphs, specs: draft.specs, quoteText: draft.quote.text } : draft.translations?.[language] ?? {}
  const setText = (patch: TextTranslation) => setDraft(language === 'it' ? { ...draft, ...(patch.paragraphs !== undefined ? { paragraphs: patch.paragraphs } : {}), ...(patch.specs !== undefined ? { specs: patch.specs } : {}), ...(patch.quoteText !== undefined ? { quote: { ...draft.quote, text: patch.quoteText } } : {}) } : { ...draft, translations: { ...draft.translations, [language]: { ...draft.translations?.[language], ...patch } } })
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
        <TextLanguages language={language} onChange={setLanguage} product={draft} />
        <label className="shop-label">
          {t("Descrizione (paragrafi separati da una riga vuota)")}
          <textarea
            className="shop-input min-h-48"
            value={text.paragraphs?.join('\n\n') ?? ''}
            onChange={(event) => setText({ paragraphs: event.target.value.split('\n\n') })}
          />
        </label>
        <label className="shop-label">
          {t("Caratteristiche (una per riga)")}
          <textarea
            className="shop-input"
            value={text.specs?.join('\n') ?? ''}
            onChange={(event) => setText({ specs: event.target.value.split('\n') })}
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
        <PhotoEditor language={language} images={draft.images} library={library} onChange={(images) => setDraft({ ...draft, images })} />
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
  } | null
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
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoAlt, setPhotoAlt] = useState('')
  const [heroSrc, setHeroSrc] = useState('')
  const [heroAlt, setHeroAlt] = useState('')
  const [heroTranslations, setHeroTranslations] = useState<Img['altTranslations']>({})
  const [source, setSource] = useState('')
  const [replacement, setReplacement] = useState('')
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
              key={catalog.revision}
              product={catalog.perfume}
              library={library}
              busy={busy}
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
                      buyEnabled: false,
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
                        <span className="text-xs text-muted">{m.buyEnabled ? t('Acquisto attivo') : t('Solo vetrina')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
              <section>
                {model ? (
                  <ProductEditor
                    key={`${model.id}-${catalog.revision}`}
                    model={model}
                    library={library}
                    busy={busy}
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
                      {t("Seleziona un orologio per modificare descrizioni, prezzi, varianti e fotografie. L’acquisto può essere attivato per ogni prodotto.")}
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
                  if (!photo) return
                  void perform(async () => {
                    const form = new FormData()
                    form.append('photo', photo)
                    form.append('alt', photoAlt)
                    form.append('revision', String(catalog.revision))
                    setCatalog(await api<Catalog>('/admin/photos', 'POST', form))
                    setPhoto(null)
                    setPhotoAlt('')
                  }, 'Foto caricata. Ora puoi associarla a un prodotto o al sito.')
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
                    className="shop-input"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    disabled={busy}
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="shop-label">
                  {t("Descrizione accessibile")}
                  <input
                    className="shop-input"
                    required
                    maxLength={500}
                    value={photoAlt}
                    onChange={(e) => setPhotoAlt(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn" disabled={busy || !photo || STATIC_PREVIEW}>
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
                    const image = [catalog.hero, ...library].find(image => image.src === e.target.value)
                    setHeroSrc(e.target.value)
                    setHeroAlt(image?.alt ?? '')
                    setHeroTranslations(image?.altTranslations ?? {})
                  }}>
                    {[...new Map([catalog.hero, ...library].map((im) => [im.src, im])).values()].map((im) => (
                      <option key={im.src} value={im.src}>
                        {im.alt || im.src}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="shop-label">
                  {t("Descrizione")}
                  <input className="shop-input" required value={heroAlt} onChange={(e) => setHeroAlt(e.target.value)} />
                </label>
                {LOCALES.filter(language => language !== 'it').map(language => <label key={language} className="shop-label">
                  {LANGUAGE_NAMES[language]} · {t('Descrizione foto')}
                  <input className="shop-input" maxLength={500} value={heroTranslations?.[language] ?? ''} onChange={event => setHeroTranslations({ ...heroTranslations, [language]: event.target.value })} />
                </label>)}
                <button type="submit" className="btn" disabled={busy || STATIC_PREVIEW}>
                  {t("Salva foto principale")}
                </button>
              </form>
              <form
                className="max-w-2xl space-y-5 border-t border-line pt-8"
                onSubmit={(e) => {
                  e.preventDefault()
                  const im = library.find((im) => im.src === replacement)
                  if (!im) return
                  void perform(async () =>
                    setCatalog(
                      await api<Catalog>('/admin/image', 'PUT', { source, image: im, revision: catalog.revision }),
                    ), 'Fotografia del sito sostituita.')
                }}
              >
                <h2 className="text-h2">{t("Fotografie del sito")}</h2>
                <label className="shop-label">
                  {t("Foto da sostituire")}
                  <select required className="shop-input" value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="">{t("Seleziona")}</option>
                    {catalog.siteImages
                      .filter((im) => im.src !== catalog.hero.src)
                      .map((im) => (
                        <option key={im.src} value={im.src}>
                          {im.alt}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="shop-label">
                  {t("Nuova foto")}
                  <select
                    required
                    className="shop-input"
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                  >
                    <option value="">{t("Seleziona")}</option>
                    {library.map((im) => (
                      <option key={im.src} value={im.src}>
                        {im.alt || im.src}
                      </option>
                    ))}
                  </select>
                </label>
                {source && (
                  <img
                    src={asset(catalog.imageOverrides[source]?.src ?? source)}
                    alt=""
                    className="h-40 object-contain"
                  />
                )}
                <button type="submit" className="btn" disabled={busy || STATIC_PREVIEW}>
                  {t("Sostituisci foto")}
                </button>
              </form>
              <section className="border-t border-line pt-8">
                <h2 className="text-h2">{t("Libreria caricamenti")}</h2>
                <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {catalog.photos.map((im) => (
                    <li key={im.src}>
                      <img src={asset(im.src)} alt={im.alt} className="h-48 w-full bg-well object-contain" />
                      <p className="mt-3 text-small">{im.alt}</p>
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
