import { useEffect, useState, type FormEvent } from 'react'
import type { Img, Model, Profumo, Variant } from '../data/types'
import { api, euro, getSession, STATIC_PREVIEW, useShop, type Catalog } from '../lib/shop'
import { profumo as originalPerfume } from '../data/content'
import { asset } from '../lib/asset'

function PhotoEditor({
  images,
  onChange,
  library,
}: {
  images: Img[]
  onChange: (images: Img[]) => void
  library: Img[]
}) {
  const [selected, setSelected] = useState('')
  return (
    <div className="space-y-4">
      <p className="eyebrow">Fotografie</p>
      <ul className="space-y-3">
        {images.map((im, index) => (
          <li key={`${im.src}-${index}`} className="grid grid-cols-[64px_1fr] gap-3 border-b border-line pb-3">
            <img src={asset(im.src)} alt="" className="h-16 w-16 object-contain" />
            <div>
              <label className="text-small">
                Descrizione foto
                <input
                  className="shop-input w-full"
                  value={im.alt}
                  onChange={(e) =>
                    onChange(images.map((item, i) => (i === index ? { ...item, alt: e.target.value } : item)))
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
                  Sposta prima
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                >
                  Rimuovi foto
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Foto dalla libreria"
          className="shop-input min-w-0 flex-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Seleziona dalla libreria</option>
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
          Aggiungi foto
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
      {label}
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
  const setVariant = (index: number, patch: Partial<Variant>) =>
    setDraft({ ...draft, variants: draft.variants?.map((v, i) => (i === index ? { ...v, ...patch } : v)) })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
      }}
      className="space-y-7"
    >
      <fieldset disabled={busy} className="space-y-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="shop-label">
            Nome
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
            Codici (separati da virgola)
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
            Abilita acquisto e pulsante Acquista
          </label>
        </div>
        <label className="shop-label">
          Descrizione
          <textarea
            className="shop-input min-h-32"
            value={draft.description ?? ''}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <label className="shop-label">
          Caratteristiche (una per riga)
          <textarea
            className="shop-input min-h-32"
            value={draft.specs.join('\n')}
            onChange={(e) => setDraft({ ...draft, specs: e.target.value.split('\n') })}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="shop-label">
            Citazione
            <input
              className="shop-input"
              value={draft.quote?.text ?? ''}
              onChange={(e) => setDraft({ ...draft, quote: { ...draft.quote, text: e.target.value } })}
            />
          </label>
          <label className="shop-label">
            Autore
            <input
              className="shop-input"
              value={draft.quote?.author ?? ''}
              onChange={(e) => setDraft({ ...draft, quote: { text: draft.quote?.text ?? '', author: e.target.value } })}
            />
          </label>
        </div>
        <PhotoEditor images={draft.images} library={library} onChange={(images) => setDraft({ ...draft, images })} />
        <div className="space-y-6 border-t border-line pt-6">
          <h3 className="text-h3">Varianti / colori</h3>
          {draft.variants?.map((v, index) => (
            <section key={v.id} className="space-y-4 border border-line p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="shop-label">
                  Nome variante
                  <input
                    className="shop-input"
                    required
                    value={v.label}
                    onChange={(e) => setVariant(index, { label: e.target.value })}
                  />
                </label>
                <PriceInput value={v.priceCents ?? 1} onChange={(priceCents) => setVariant(index, { priceCents })} />
                <label className="shop-label">
                  Codici variante
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
                  Colore
                  <input
                    className="shop-input w-full"
                    type="color"
                    value={v.swatch[0]}
                    onChange={(e) => setVariant(index, { swatch: [e.target.value, ...v.swatch.slice(1)] })}
                  />
                </label>
              </div>
              <label className="shop-label">
                Caratteristiche variante (una per riga; vuoto usa quelle del prodotto)
                <textarea
                  className="shop-input"
                  value={v.specs?.join('\n') ?? ''}
                  onChange={(e) =>
                    setVariant(index, { specs: e.target.value ? e.target.value.split('\n') : undefined })
                  }
                />
              </label>
              <PhotoEditor images={v.images} library={library} onChange={(images) => setVariant(index, { images })} />
              <button
                type="button"
                className="underline text-small"
                onClick={() => setDraft({ ...draft, variants: draft.variants?.filter((_, i) => i !== index) })}
              >
                Elimina variante
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
            Aggiungi variante
          </button>
        </div>
        <div className="flex flex-wrap gap-5 border-t border-line pt-6">
          <button type="submit" className="btn" disabled={STATIC_PREVIEW}>
            {busy ? 'Salvataggio…' : 'Salva prodotto'}
          </button>
          <button type="button" className="underline text-small" disabled={STATIC_PREVIEW} onClick={onDelete}>
            Elimina prodotto
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
  return (
    <form
      className="max-w-3xl space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(draft)
      }}
    >
      <h2 className="text-h2">{product ? 'Il profumo' : 'Aggiungi il profumo'}</h2>
      <fieldset disabled={busy} className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="shop-label">
            Nome
            <input
              className="shop-input"
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <PriceInput value={draft.priceCents ?? 12000} onChange={(priceCents) => setDraft({ ...draft, priceCents })} />
          <label className="shop-label">
            Codice
            <input
              className="shop-input"
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
            />
          </label>
        </div>
        <label className="shop-label">
          Descrizione (paragrafi separati da una riga vuota)
          <textarea
            className="shop-input min-h-48"
            value={draft.paragraphs.join('\n\n')}
            onChange={(event) => setDraft({ ...draft, paragraphs: event.target.value.split('\n\n') })}
          />
        </label>
        <label className="shop-label">
          Caratteristiche (una per riga)
          <textarea
            className="shop-input"
            value={draft.specs.join('\n')}
            onChange={(event) => setDraft({ ...draft, specs: event.target.value.split('\n') })}
          />
        </label>
        <label className="shop-label">
          Ingredienti (uno per riga)
          <textarea
            className="shop-input"
            value={draft.ingredients.join('\n')}
            onChange={(event) => setDraft({ ...draft, ingredients: event.target.value.split('\n') })}
          />
        </label>
        <label className="shop-label">
          Citazione
          <input
            className="shop-input"
            value={draft.quote.text}
            onChange={(event) => setDraft({ ...draft, quote: { ...draft.quote, text: event.target.value } })}
          />
        </label>
        <label className="shop-label">
          Autore
          <input
            className="shop-input"
            value={draft.quote.author ?? ''}
            onChange={(event) => setDraft({ ...draft, quote: { ...draft.quote, author: event.target.value } })}
          />
        </label>
        <PhotoEditor images={draft.images} library={library} onChange={(images) => setDraft({ ...draft, images })} />
        <div className="flex gap-5">
          <button className="btn" type="submit" disabled={STATIC_PREVIEW}>
            Salva profumo
          </button>
          {product && (
            <button className="underline text-small" type="button" disabled={STATIC_PREVIEW} onClick={onDelete}>
              Elimina profumo
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
        <strong className="font-medium">Anteprima pubblica dell’interfaccia · GitHub Pages</strong>
        <p className="mt-2">Puoi esplorare i pannelli e modificare i campi per provare il layout.
        Salvataggio, eliminazione, caricamenti, accesso e pagamenti sono disattivati.
        Le modifiche ai campi vengono perse quando cambi prodotto o ricarichi la pagina.
        Nessun dato privato o ordine reale è caricato.</p>
      </aside>}
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <p className="eyebrow">ZITO 1950 · {STATIC_PREVIEW ? 'Anteprima UI' : 'Area riservata'}</p>
          <h1 className="mt-3 text-display">Amministrazione</h1>
        </div>
        <div className="flex gap-5">
          <a href={import.meta.env.BASE_URL} className="link-arrow">
            <span>Visita il sito</span>
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
              Esci
            </button>
          )}
        </div>
      </header>
      <p role="status" aria-live="polite" className="my-6 text-small">
        {checking ? 'Verifica della sessione…' : status}
      </p>
      {!checking && !authenticated && (
        <form className="max-w-md space-y-6 py-10" onSubmit={(event) => void login(event)}>
          <h2 className="text-h2">Accesso amministratore</h2>
          <p className="text-small text-muted">
            Sessione protetta, scadenza dopo un’ora. Nessuna registrazione pubblica.
          </p>
          <label className="shop-label">
            Password
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
            {busy ? 'Accesso…' : 'Accedi'}
          </button>
        </form>
      )}
      {authenticated && (
        <>
          <nav aria-label="Amministrazione" className="mb-10 flex flex-wrap gap-6 border-b border-line pb-5">
            {(
              [
                ['products', 'Prodotti'],
                ['perfume', 'Profumo'],
                ['photos', 'Fotografie'],
                ['orders', 'Ordini'],
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
              Ricarica catalogo
            </button>
          </nav>
          {tab === 'perfume' && (
            <PerfumeEditor
              key={catalog.revision}
              product={catalog.perfume}
              library={library}
              busy={busy}
              onSave={(product) =>
                void perform(
                  async () =>
                    setCatalog(await api<Catalog>('/admin/perfume', 'PUT', { product, revision: catalog.revision })),
                  'Profumo salvato e pubblicato.',
                )
              }
              onDelete={() => {
                if (window.confirm('Eliminare il profumo dal sito?'))
                  void perform(
                    async () =>
                      setCatalog(
                        await api<Catalog>('/admin/perfume', 'PUT', { product: null, revision: catalog.revision }),
                      ),
                    'Profumo eliminato.',
                  )
              }}
            />
          )}
          {tab === 'products' && (
            <div className="grid gap-10 md:grid-cols-[250px_1fr]">
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
                  Aggiungi prodotto
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
                            !window.confirm('Aprire un altro prodotto? Le modifiche non salvate saranno perse.')
                          )
                            return
                          setSelected(m.id)
                          setNewProduct(null)
                        }}
                      >
                        <span className="block font-serif text-xl">{m.name}</span>
                        <span className="text-xs text-muted">{m.buyEnabled ? 'Acquisto attivo' : 'Solo vetrina'}</span>
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
                      if (window.confirm(`Eliminare ${model.name} dal catalogo?`))
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
                    <h2 className="text-h2">La collezione</h2>
                    <p className="mt-4 text-ink-2">
                      Seleziona un orologio per modificare descrizioni, prezzi, varianti e fotografie. L’acquisto può
                      essere attivato per ogni prodotto.
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
                <h2 className="text-h2">Carica fotografie</h2>
                <p className="text-small text-muted">
                  JPG, PNG e WebP, massimo 12 MB. Le foto vengono ridimensionate, private dei metadati e convertite in
                  WebP.
                </p>
                <label className="shop-label">
                  File
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
                  Descrizione accessibile
                  <input
                    className="shop-input"
                    required
                    maxLength={500}
                    value={photoAlt}
                    onChange={(e) => setPhotoAlt(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn" disabled={busy || !photo || STATIC_PREVIEW}>
                  Carica foto
                </button>
              </form>
              <form
                className="max-w-2xl space-y-5 border-t border-line pt-8"
                onSubmit={(e) => {
                  e.preventDefault()
                  void perform(
                    async () =>
                      setCatalog(
                        await api<Catalog>('/admin/hero', 'PUT', {
                          image: { src: heroSrc, alt: heroAlt },
                          revision: catalog.revision,
                        }),
                      ),
                    'Foto principale aggiornata.',
                  )
                }}
              >
                <h2 className="text-h2">Foto principale</h2>
                <img src={asset(heroSrc)} alt={heroAlt} className="max-h-64 w-full object-contain" />
                <label className="shop-label">
                  Fotografia
                  <select className="shop-input" value={heroSrc} onChange={(e) => setHeroSrc(e.target.value)}>
                    {[...new Map([catalog.hero, ...library].map((im) => [im.src, im])).values()].map((im) => (
                      <option key={im.src} value={im.src}>
                        {im.alt || im.src}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="shop-label">
                  Descrizione
                  <input className="shop-input" required value={heroAlt} onChange={(e) => setHeroAlt(e.target.value)} />
                </label>
                <button type="submit" className="btn" disabled={busy || STATIC_PREVIEW}>
                  Salva foto principale
                </button>
              </form>
              <form
                className="max-w-2xl space-y-5 border-t border-line pt-8"
                onSubmit={(e) => {
                  e.preventDefault()
                  const im = library.find((im) => im.src === replacement)
                  if (!im) return
                  void perform(
                    async () =>
                      setCatalog(
                        await api<Catalog>('/admin/image', 'PUT', { source, image: im, revision: catalog.revision }),
                      ),
                    'Fotografia del sito sostituita.',
                  )
                }}
              >
                <h2 className="text-h2">Fotografie del sito</h2>
                <label className="shop-label">
                  Foto da sostituire
                  <select required className="shop-input" value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="">Seleziona</option>
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
                  Nuova foto
                  <select
                    required
                    className="shop-input"
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                  >
                    <option value="">Seleziona</option>
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
                  Sostituisci foto
                </button>
              </form>
              <section className="border-t border-line pt-8">
                <h2 className="text-h2">Libreria caricamenti</h2>
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
                          if (window.confirm('Rimuovere la foto dalla libreria?'))
                            void perform(
                              async () =>
                                setCatalog(
                                  await api<Catalog>(
                                    `/admin/photos/${im.src.split('/')[1].replace('.webp', '')}`,
                                    'DELETE',
                                    { revision: catalog.revision },
                                  ),
                                ),
                              'Foto rimossa dalla libreria.',
                            )
                        }}
                      >
                        Elimina foto
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
          {tab === 'orders' && (
            <section>
              <h2 className="text-h2">Ordini recenti</h2>
              <p className="mt-3 text-small text-muted">
                Spedisci solo ordini COMPLETED. Gli ordini in attesa non confermano un pagamento.
              </p>
              {!orders.length && <p className="mt-8">{STATIC_PREVIEW ? 'Gli ordini reali richiedono il backend; nessun ordine è caricato nell’anteprima.' : 'Nessun ordine.'}</p>}
              <ul className="mt-8 space-y-8">
                {orders.map((order) => (
                  <li key={order.id} className="border-t border-line pt-5">
                    <div className="flex flex-wrap justify-between gap-4">
                      <h3 className="text-h3">
                        {euro(order.total)} · {order.status}
                      </h3>
                      <span className="text-small">{new Date(order.created).toLocaleString('it-IT')}</span>
                    </div>
                    <p className="mt-2 break-all text-small">
                      Riferimento: {order.id} · PayPal: {order.paypal_id ?? 'in preparazione'}
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
                        <p>Pagamento: {order.receipt.captureId}</p>
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
