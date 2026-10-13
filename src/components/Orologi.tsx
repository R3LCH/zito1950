import { useCallback, useEffect, useMemo, useState } from 'react'
import ModelCard from './ModelCard'
import ModelDialog from './ModelDialog'
import CatalogFilters from './CatalogFilters'
import Panel from './Panel'
import { t, useContent } from '../lib/i18n'
import type { Model } from '../data/types'
import { useShop } from '../lib/shop'
import { EMPTY_FILTERS, availabilityOf, compareModels, facetIndex, matches, type FilterState } from '../lib/catalogFilters'

const LIMITED_HASH = '#edizioni-limitate'

export default function Orologi() {
  const { orologi, site } = useContent()
  const [open, setOpen] = useState<{ model: Model; trigger: HTMLElement; variant: number; image: number } | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const { catalog: source, localizedCatalog: catalog, error } = useShop()
  // Facets read the Italian source text; localized specs would miss the keywords.
  const facetsFor = useMemo(() => facetIndex(source.models), [source.models])

  const models = useMemo(
    () => catalog.models.filter((m) => availabilityOf(m) !== 'hidden').sort(compareModels('featured')),
    [catalog.models],
  )
  // Owner-picked watches for the closed section; without picks, the first four of the featured order.
  const featured = useMemo(() => {
    const picked = catalog.featured.flatMap((id) => models.find((m) => m.id === id) ?? [])
    return (picked.length ? picked : models).slice(0, 4)
  }, [catalog.featured, models])
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

  const grid = 'grid grid-cols-2 gap-x-4 gap-y-10 lg:gap-x-8 lg:gap-y-14'

  return (
    <>
      <Panel
        id="orologi"
        eyebrow={orologi.eyebrow}
        title={orologi.title}
        intro={<p>{orologi.intro}</p>}
        previewOnlyCollapsed
        moreLabel={site.panel.fullCatalog}
        preview={
          <ul className={`${grid} ${featured.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
            {featured.map((m) => (
              <li key={m.id}>
                <ModelCard model={m} onOpen={handleOpen} />
              </li>
            ))}
          </ul>
        }
      >
        <h3 id="catalogo-title" className="text-h3">
          {orologi.catalog.title}
        </h3>
        <div id="edizioni-limitate" className="mt-6 scroll-mt-[calc(var(--header-h)+1rem)]">
          <CatalogFilters models={models} facetsFor={facetsFor} filters={filters} onChange={update} resultCount={shown.length} />
        </div>
        {error && <p role="status" className="mt-6 text-small">{t(error)}</p>}
        {shown.length === 0 && models.length > 0 ? (
          <div className="mt-10 max-w-[60ch]">
            <p className="text-ink-2">{t('Nessun modello corrisponde ai filtri scelti.')}</p>
            <button type="button" className="btn mt-6 rounded-full" onClick={() => update({ ...EMPTY_FILTERS, sort: filters.sort })}>
              {t('Azzera filtri')}
            </button>
          </div>
        ) : (
          <ul aria-labelledby="catalogo-title" className={`mt-10 ${grid} lg:grid-cols-3`}>
            {shown.map((m) => (
              <li key={m.id}>
                <ModelCard model={m} onOpen={handleOpen} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ModelDialog
        model={open ? models.find((model) => model.id === open.model.id) ?? null : null}
        models={models}
        trigger={open?.trigger ?? null}
        initialVariant={open?.variant ?? 0}
        initialImage={open?.image ?? 0}
        onClose={handleClose}
        onSelect={handleSelect}
      />
    </>
  )
}
