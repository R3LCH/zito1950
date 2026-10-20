import { useEffect, useMemo, useState } from 'react'
import { FULFILLMENT_LABELS, FULFILLMENT_STATUSES, type OrderItemView, type PublicOrder } from '../data/types'
import { LANGUAGE_TAGS } from '../data/localization'
import { availabilityOf } from '../lib/catalogFilters'
import { t, useLocale } from '../lib/i18n'
import { euro, STATIC_PREVIEW, useShop } from '../lib/shop'
import Picture from './Picture'

/** Token for `${BASE_URL}ordine/<token>`, `anteprima` for the static preview demo, otherwise null. */
export function orderToken(): string | null {
  const path = location.pathname.slice(import.meta.env.BASE_URL.length - 1).replace(/^\/|\/$/g, '')
  const match = /^ordine\/([A-Za-z0-9_-]+)$/.exec(path)
  if (match) return match[1]
  if (STATIC_PREVIEW && new URLSearchParams(location.search).get('ordine') === 'anteprima') return 'anteprima'
  return null
}

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; order: PublicOrder }

export default function OrderPage({ token }: { token: string }) {
  const { localizedCatalog: catalog } = useShop()
  const { locale } = useLocale()
  const preview = STATIC_PREVIEW && token === 'anteprima'
  const [state, setState] = useState<State>({ kind: 'loading' })
  // The GitHub Pages build has no backend: show a sample order built from the catalog instead.
  const demo = useMemo<PublicOrder | null>(() => {
    if (!preview) return null
    const watches = catalog.models.filter((m) => availabilityOf(m) === 'buy')
    const perfume = catalog.perfumes.find((p) => p.availability === 'buy' && (p.priceCents ?? 0) > 0)
    const items: OrderItemView[] = []
    if (watches[0]) {
      const variant = watches[0].variants?.[0]
      items.push({
        kind: 'model',
        name: `${watches[0].name}${variant ? ` · ${variant.label}` : ''}`,
        codes: variant?.codes ?? watches[0].codes,
        quantity: 1,
        priceCents: variant?.priceCents ?? watches[0].priceCents ?? 0,
        image: variant?.images[0] ?? watches[0].images[0] ?? null,
        certificate: { firstName: 'Maria', lastName: 'Rossi', email: 'maria.rossi@example.com' },
        engraving: 'Per Luca, 12 giugno 2026',
      })
    }
    if (perfume) {
      items.push({ kind: 'perfume', name: perfume.name, codes: perfume.code ? [perfume.code] : [], quantity: 1, priceCents: perfume.priceCents ?? 0, image: perfume.images[0] ?? null, certificate: null, engraving: null })
    } else if (watches[1]) {
      items.push({ kind: 'model', name: watches[1].name, codes: watches[1].codes, quantity: 1, priceCents: watches[1].priceCents ?? 0, image: watches[1].images[0] ?? null, certificate: null, engraving: null })
    }
    const day = 24 * 60 * 60 * 1000
    const created = Date.now() - 3 * day
    return {
      reference: 'anteprima',
      created,
      total: items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
      status: 'pronto',
      history: [
        { status: 'ricevuto', at: created },
        { status: 'in-lavorazione', at: created + day },
        { status: 'pronto', at: created + 2 * day },
      ],
      items,
    }
  }, [preview, catalog])
  useEffect(() => {
    if (preview) return
    let cancelled = false
    setState({ kind: 'loading' })
    fetch(`/api/orders/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 404) setState({ kind: 'missing' })
        else if (!response.ok) setState({ kind: 'error' })
        else setState({ kind: 'ready', order: (await response.json()) as PublicOrder })
      })
      .catch(() => !cancelled && setState({ kind: 'error' }))
    return () => {
      cancelled = true
    }
  }, [token, preview])
  const shown: State = demo ? { kind: 'ready', order: demo } : state
  const date = (at: number) => new Date(at).toLocaleDateString(LANGUAGE_TAGS[locale], { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <section aria-labelledby="order-title" className="container-site py-12 md:py-20">
      <p className="eyebrow">
        {t('Il tuo ordine')}
        {preview && ` · ${t('Anteprima')}`}
      </p>
      {shown.kind === 'loading' && (
        <h1 id="order-title" className="mt-3 text-h2" aria-busy="true">
          {t('Caricamento dell’ordine…')}
        </h1>
      )}
      {shown.kind === 'missing' && (
        <h1 id="order-title" className="mt-3 max-w-2xl text-h2">
          {t('Ordine non trovato. Controlla il link ricevuto via email.')}
        </h1>
      )}
      {shown.kind === 'error' && (
        <h1 id="order-title" className="mt-3 max-w-2xl text-h2">
          {t('Non riusciamo a mostrare l’ordine in questo momento. Riprova tra qualche minuto.')}
        </h1>
      )}
      {shown.kind === 'ready' && <OrderDetails order={shown.order} preview={preview} date={date} />}
      <p className="mt-12 border-t border-line pt-6 text-small text-ink-2">
        {t('Per qualsiasi domanda scrivi a')}{' '}
        <a className="underline" href="mailto:customer@zito1950.it">
          customer@zito1950.it
        </a>
      </p>
    </section>
  )
}

function OrderDetails({ order, preview, date }: { order: PublicOrder; preview: boolean; date: (at: number) => string }) {
  const current = FULFILLMENT_STATUSES.indexOf(order.status)
  return (
    <>
      <h1 id="order-title" className="mt-3 text-h2">
        {t(FULFILLMENT_LABELS[order.status])}
      </h1>
      <p className="mt-3 break-all text-small text-muted">
        {t('Riferimento:')} {preview ? t('Anteprima') : order.reference} · {date(order.created)}
      </p>
      <ol className="mt-10 grid gap-4 md:grid-cols-5 md:gap-0" aria-label={t('Stato dell’ordine')}>
        {FULFILLMENT_STATUSES.map((status, i) => {
          // The latest entry for a status is the one the owner last set.
          const at = order.history.findLast((entry) => entry.status === status)?.at
          const reached = i <= current
          return (
            <li
              key={status}
              aria-current={i === current ? 'step' : undefined}
              className={`flex items-start gap-3 border-l-2 pl-4 md:flex-col md:gap-2 md:border-l-0 md:border-t-2 md:pl-0 md:pr-4 md:pt-4 ${reached ? 'border-ink' : 'border-line'}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-small ${
                  i === current ? 'border-ink bg-ink text-bg' : reached ? 'border-ink text-ink' : 'border-line text-muted'
                }`}
              >
                {i + 1}
              </span>
              <span className="flex flex-col">
                <span className={`text-small ${i === current ? 'font-medium text-ink' : reached ? 'text-ink' : 'text-muted'}`}>
                  {t(FULFILLMENT_LABELS[status])}
                  {i < current && <span className="sr-only"> · {t('completato')}</span>}
                </span>
                {reached && at && <span className="text-small text-muted">{date(at)}</span>}
              </span>
            </li>
          )
        })}
      </ol>
      <h2 className="mt-14 text-h3">{t('Articoli')}</h2>
      <ul className="mt-4 border-t border-line">
        {order.items.map((item, i) => (
          <li key={i} className="grid grid-cols-[5rem_1fr] gap-4 border-b border-line py-6 sm:grid-cols-[7rem_1fr_auto] sm:gap-6">
            <div className="aspect-square overflow-hidden bg-well">
              {item.image && <Picture src={item.image.src} alt={item.image.alt} sizes="112px" className="h-full w-full object-cover" />}
            </div>
            <div>
              <h3 className="font-serif text-xl">{item.name}</h3>
              {!!item.codes.length && <p className="mt-1 text-small text-muted">{item.codes.join(' · ')}</p>}
              <p className="mt-1 text-small">
                {t('Quantità')}: {item.quantity} · {euro(item.priceCents)}
                {' ' + t('/ pezzo')}
              </p>
              {item.certificate && (
                <p className="mt-3 text-small">
                  <span className="text-muted">{t('Certificato della proprietà e garanzia')}:</span>{' '}
                  <span className="[overflow-wrap:anywhere]">
                    {item.certificate.firstName} {item.certificate.lastName} · {item.certificate.email}
                  </span>
                </p>
              )}
              {item.engraving && (
                <div className="mt-3 text-small">
                  <p>
                    <span className="text-muted">{t('Incisione')}:</span> <span className="[overflow-wrap:anywhere]">«{item.engraving}»</span>
                  </p>
                  <p className="mt-1 text-muted">{t('Articolo personalizzato: non può essere restituito né cambiato.')}</p>
                </div>
              )}
            </div>
            <p className="col-start-2 text-small font-medium sm:col-start-3 sm:text-right">{euro(item.priceCents * item.quantity)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-between text-xl">
        <span>{t('Totale')}</span>
        <strong className="font-medium">{euro(order.total)}</strong>
      </div>
    </>
  )
}
