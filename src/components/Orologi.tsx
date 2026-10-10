import { useCallback, useEffect, useMemo, useState } from 'react'
import ModelCard, { availabilityOf } from './ModelCard'
import ModelDialog from './ModelDialog'
import { t, useContent } from '../lib/i18n'
import type { Availability, Model } from '../data/types'
import { useReveal } from '../lib/useReveal'
import { useShop } from '../lib/shop'

/** Purchasable first, then showcase, then out of stock, then sold. Hidden never reaches the list. */
const RANK: Record<Availability, number> = { buy: 0, 'no-buy': 1, 'out-of-stock': 2, sold: 3, hidden: 4 }
const LIMITED_HASH = '#edizioni-limitate'

export default function Orologi() {
  const { orologi } = useContent()
  const introRef = useReveal<HTMLDivElement>()
  const pillarsRef = useReveal<HTMLUListElement>()
  const [open, setOpen] = useState<{ model: Model; trigger: HTMLElement; variant: number; image: number } | null>(null)
  const [limitedOnly, setLimitedOnly] = useState(false)
  const { localizedCatalog: catalog, error } = useShop()

  const models = useMemo(
    () =>
      catalog.models
        .filter((m) => availabilityOf(m) !== 'hidden')
        .sort((a, b) => RANK[availabilityOf(a)] - RANK[availabilityOf(b)] || (b.priceCents ?? 0) - (a.priceCents ?? 0)),
    [catalog.models],
  )
  const limitedCount = models.filter((m) => m.limitedEdition).length
  const shown = limitedOnly ? models.filter((m) => m.limitedEdition) : models

  // The hero's "Edizioni limitate" link lands here with the filter already applied.
  useEffect(() => {
    const sync = () => {
      if (location.hash === LIMITED_HASH) setLimitedOnly(true)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const choose = (limited: boolean) => {
    setLimitedOnly(limited)
    // Keep the URL in step without scrolling; clearing it lets the hero link re-apply the filter later.
    history.replaceState(history.state, '', limited ? LIMITED_HASH : location.pathname + location.search)
  }

  const handleOpen = useCallback(
    (model: Model, trigger: HTMLElement, variant: number, image: number) => setOpen({ model, trigger, variant, image }),
    [],
  )
  const handleClose = useCallback(() => setOpen(null), [])
  // Same trigger: focus returns to the card that opened the dialog in the first place.
  const handleSelect = useCallback((model: Model) => setOpen((o) => o && { ...o, model, variant: 0, image: 0 }), [])

  const filterButton = (limited: boolean, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={limitedOnly === limited}
      onClick={() => choose(limited)}
      className={`inline-flex min-h-11 items-center gap-2 border px-4 font-sans text-small font-medium transition-colors duration-200 ${
        limitedOnly === limited
          ? 'border-ink bg-ink text-bg'
          : 'border-line bg-bg text-ink [@media(hover:hover)_and_(pointer:fine)]:hover:border-ink'
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  )

  return (
    <section id="orologi" aria-labelledby="orologi-title" className="py-(--section-y)">
      <div className="container-site">
        <div ref={introRef} className="reveal max-w-[60ch]">
          <p className="eyebrow">{orologi.eyebrow}</p>
          <h2 id="orologi-title" className="mt-4 font-serif text-h2">
            {orologi.title}
          </h2>
          <p className="mt-6 text-ink-2">{orologi.intro}</p>
        </div>

        <ul
          ref={pillarsRef}
          className="reveal mt-12 grid gap-x-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4"
        >
          {orologi.pillars.map((p) => (
            <li key={p.title} className="border-t border-line pt-6 pb-10">
              <h3 className="font-serif text-h3">{p.title}</h3>
              <p className="mt-3 text-small text-ink-2">{p.text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-(--section-y)">
          <p className="eyebrow">{orologi.catalog.eyebrow}</p>
          <h2 id="catalogo-title" className="mt-4 font-serif text-h2">
            {orologi.catalog.title}
          </h2>
        </div>

        <div
          id="edizioni-limitate"
          role="group"
          aria-label={t('Filtra i modelli')}
          className="mt-8 flex scroll-mt-(--header-h) flex-wrap gap-2"
        >
          {filterButton(false, t('Tutti i modelli'), models.length)}
          {filterButton(true, t('Edizioni limitate'), limitedCount)}
        </div>

        {error && <p role="status" className="mt-6 text-small">{t(error)}</p>}
        {shown.length === 0 && limitedOnly ? (
          <p className="mt-10 max-w-[60ch] text-ink-2">{t('Al momento non ci sono edizioni limitate disponibili.')}</p>
        ) : (
          <ul
            aria-labelledby="catalogo-title"
            className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-20"
          >
            {shown.map((m) => (
              <li key={m.id}>
                <ModelCard model={m} onOpen={handleOpen} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModelDialog
        model={open ? models.find((model) => model.id === open.model.id) ?? null : null}
        models={models}
        trigger={open?.trigger ?? null}
        initialVariant={open?.variant ?? 0}
        initialImage={open?.image ?? 0}
        onClose={handleClose}
        onSelect={handleSelect}
      />
    </section>
  )
}
