import { useCallback, useEffect, useMemo, useState } from 'react'
import ModelCard from './ModelCard'
import ModelDialog from './ModelDialog'
import CatalogFilters from './CatalogFilters'
import Panel from './Panel'
import { t, useContent, useLocale } from '../lib/i18n'
import type { Model } from '../data/types'
import { useShop } from '../lib/shop'
import { EMPTY_FILTERS, availabilityOf, compareModels, facetIndex, matches, type FilterGender, type FilterState } from '../lib/catalogFilters'
import { setCatalogLine } from '../lib/catalogLine'
import { clearProductUrl, setProductUrl } from '../lib/productLinks'

const LIMITED_HASH = '#edizioni-limitate'
/** The navigation's "Orologi uomo" / "Orologi donna" links open the catalogue with one line picked. */
const GENDER_HASHES: Record<string, FilterGender> = { '#orologi-uomo': 'uomo', '#orologi-donna': 'donna' }

export default function Orologi() {
  const { orologi, site } = useContent()
  const { locale } = useLocale()
  const [open, setOpen] = useState<{ model: Model; trigger: HTMLElement; variant: number; image: number } | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [catalogOpen, setCatalogOpen] = useState(false)
  // The header marks "Orologi uomo/donna" while the open catalogue shows exactly that line.
  useEffect(() => {
    setCatalogLine(catalogOpen && filters.gender.length === 1 ? filters.gender[0] : null)
  }, [catalogOpen, filters.gender])
  useEffect(() => () => setCatalogLine(null), [])
  const { catalog: source, localizedCatalog: catalog, error, viewing, setViewing } = useShop()
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

  // Links into the catalogue: "Edizioni limitate" applies one filter, "Orologi uomo/donna" one line.
  useEffect(() => {
    const sync = () => {
      const gender = GENDER_HASHES[location.hash]
      if (gender) setFilters((f) => ({ ...EMPTY_FILTERS, sort: f.sort, gender: [gender] }))
      else if (location.hash === LIMITED_HASH) setFilters((f) => ({ ...EMPTY_FILTERS, sort: f.sort, limited: true }))
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
    (model: Model, trigger: HTMLElement, variant: number, image: number) => {
      setProductUrl('model', model.id, locale, model.variants?.[variant]?.id)
      setOpen({ model, trigger, variant, image })
    },
    [locale],
  )
  const handleClose = useCallback(() => { setOpen(null); clearProductUrl() }, [])
  // Same trigger: focus returns to the card that opened the dialog in the first place.
  const handleSelect = useCallback((model: Model) => {
    setProductUrl('model', model.id, locale, model.variants?.[0]?.id)
    setOpen((o) => o && { ...o, model, variant: 0, image: 0 })
  }, [locale])
  // A watch clicked in the cart opens here, at the finish in the cart; focus then returns to its card if it is on the page.
  useEffect(() => {
    if (viewing?.kind === 'perfume' || !viewing) return
    setViewing(null)
    const model = models.find((m) => m.id === viewing.modelId)
    if (!model) return
    const variant = Math.max(0, model.variants?.findIndex((v) => v.id === viewing.variantId) ?? 0)
    const card = document.querySelector<HTMLElement>(`[aria-labelledby="model-${CSS.escape(model.id)}-name"] [aria-haspopup="dialog"]`)
    const trigger = card ?? (document.activeElement as HTMLElement | null) ?? document.body
    handleOpen(model, trigger, variant, 0)
  }, [viewing, models, setViewing, handleOpen])
  // Opening the full catalogue: the second row lands under the sticky header, so the first row stays roughly where the preview was.
  // Runs after the body rendered synchronously and replaces any scroll-anchoring adjustment with one absolute position.
  const handleCatalogOpen = useCallback(() => {
    const items = document.querySelectorAll<HTMLElement>('#orologi ul[aria-labelledby="catalogo-title"] > li')
    const first = items[0]
    if (!first) return
    const target = Array.from(items).find((li) => li.offsetTop > first.offsetTop) ?? first
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - headerH - 16, behavior: 'instant' })
  }, [])

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
        onOpen={handleCatalogOpen}
        onOpenChange={setCatalogOpen}
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
        {/* Links into the closed section (#orologi-uomo, #orologi-donna) land on one of these anchors,
            so Panel opens the body first; the filters above then show the active line. */}
        <span id="orologi-uomo" className="absolute" aria-hidden="true" />
        <span id="orologi-donna" className="absolute" aria-hidden="true" />
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
