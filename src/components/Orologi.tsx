import { useCallback, useEffect, useMemo, useState } from 'react'
import ModelCard, { availabilityOf } from './ModelCard'
import ModelDialog from './ModelDialog'
import CatalogFilters from './CatalogFilters'
import { t, useContent } from '../lib/i18n'
import type { Model } from '../data/types'
import { useReveal } from '../lib/useReveal'
import { useShop } from '../lib/shop'
import { EMPTY_FILTERS, compareModels, facetIndex, matches, type FilterState } from '../lib/catalogFilters'

const LIMITED_HASH = '#edizioni-limitate'

export default function Orologi() {
  const { orologi } = useContent()
  const introRef = useReveal<HTMLDivElement>()
  const pillarsRef = useReveal<HTMLUListElement>()
  const [open, setOpen] = useState<{ model: Model; trigger: HTMLElement; variant: number; image: number } | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const { catalog: source, localizedCatalog: catalog, error } = useShop()
  // Facets read the Italian source text; localized specs would miss the keywords.
  const facetsFor = useMemo(() => facetIndex(source.models), [source.models])

  const models = useMemo(
    () => catalog.models.filter((m) => availabilityOf(m) !== 'hidden').sort(compareModels('featured')),
    [catalog.models],
  )
  const shown = useMemo(
    () => models.filter((m) => matches(m, facetsFor(m), filters)).sort(compareModels(filters.sort)),
    [models, facetsFor, filters],
  )

  // The hero's "Edizioni limitate" link lands here with only that filter applied.
  useEffect(() => {
    const sync = () => {
      if (location.hash === LIMITED_HASH) setFilters((f) => ({ ...EMPTY_FILTERS, sort: f.sort, limited: true }))
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const update = (next: FilterState) => {
    setFilters(next)
    // Keep the URL in step without scrolling; clearing it lets the hero link re-apply the filter later.
    if (next.limited !== filters.limited)
      history.replaceState(history.state, '', next.limited ? LIMITED_HASH : location.pathname + location.search)
  }

  const handleOpen = useCallback(
    (model: Model, trigger: HTMLElement, variant: number, image: number) => setOpen({ model, trigger, variant, image }),
    [],
  )
  const handleClose = useCallback(() => setOpen(null), [])
  // Same trigger: focus returns to the card that opened the dialog in the first place.
  const handleSelect = useCallback((model: Model) => setOpen((o) => o && { ...o, model, variant: 0, image: 0 }), [])

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

        <div id="edizioni-limitate" className="mt-8 scroll-mt-(--header-h)">
          <CatalogFilters models={models} facetsFor={facetsFor} filters={filters} onChange={update} resultCount={shown.length} />
        </div>

        {error && <p role="status" className="mt-6 text-small">{t(error)}</p>}
        {shown.length === 0 && models.length > 0 ? (
          <div className="mt-10 max-w-[60ch]">
            <p className="text-ink-2">{t('Nessun modello corrisponde ai filtri scelti.')}</p>
            <button type="button" className="btn mt-6" onClick={() => update({ ...EMPTY_FILTERS, sort: filters.sort })}>
              {t('Azzera filtri')}
            </button>
          </div>
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
