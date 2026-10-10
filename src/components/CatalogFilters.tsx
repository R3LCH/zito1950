import { useEffect, useId, useRef, useState } from 'react'
import type { Model } from '../data/types'
import { LANGUAGE_TAGS } from '../data/localization'
import { t, useLocale } from '../lib/i18n'
import {
  EMPTY_FILTERS,
  FEATURES,
  MATERIALS,
  MOVEMENTS,
  PRICE_BANDS,
  PUBLIC_AVAILABILITIES,
  SORTS,
  activeCount,
  matches,
  type Facets,
  type FilterState,
  type SortKey,
} from '../lib/catalogFilters'

type ListKey = 'availability' | 'movement' | 'features' | 'material' | 'price'
type FlagKey = 'isNew' | 'limited'

const SORT_LABELS: Record<SortKey, string> = {
  featured: 'In evidenza',
  'price-asc': 'Prezzo crescente',
  'price-desc': 'Prezzo decrescente',
  name: 'Nome (A–Z)',
}
const OPTION_LABELS: Record<string, string> = {
  buy: 'Acquistabile',
  'no-buy': 'Solo vetrina',
  'out-of-stock': 'Esaurito',
  automatic: 'Automatico',
  manual: 'Carica manuale',
  quartz: 'Quarzo',
  chronograph: 'Cronografo',
  tourbillon: 'Tourbillon',
  date: 'Data',
  steel: 'Acciaio',
  gold: 'Oro 18 kt',
  'gold-plated': 'Laminato oro',
}
const FLAG_LABELS: Record<FlagKey, string> = { isNew: 'Novità', limited: 'Edizioni limitate' }
const GROUPS: { key: ListKey; legend: string; options: readonly string[] }[] = [
  { key: 'availability', legend: 'Disponibilità', options: PUBLIC_AVAILABILITIES },
  { key: 'movement', legend: 'Movimento', options: MOVEMENTS },
  { key: 'features', legend: 'Funzioni', options: FEATURES },
  { key: 'material', legend: 'Cassa', options: MATERIALS },
  { key: 'price', legend: 'Prezzo', options: PRICE_BANDS.map((b) => b.id) },
]

const fine = '[@media(hover:hover)_and_(pointer:fine)]'
const legendClass = 'mb-2 font-sans text-xs font-medium uppercase tracking-[0.14em] text-ink-2'
const rowClass = 'flex min-h-11 cursor-pointer items-center gap-3 text-small has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted'
const inputClass = 'h-5 w-5 shrink-0 cursor-pointer rounded-none accent-ink disabled:cursor-not-allowed'

interface Props {
  /** Public models, the base every count is computed from. */
  models: Model[]
  facetsFor: (model: Model) => Facets
  filters: FilterState
  onChange: (filters: FilterState) => void
  resultCount: number
}

/** "Filtri e ordinamento" button, active-filter chips and the side sheet holding every option. */
export default function CatalogFilters({ models, facetsFor, filters, onChange, resultCount }: Props) {
  const { locale } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const active = activeCount(filters)

  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    dialog.showModal()
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previous
      if (dialog.open) dialog.close()
      triggerRef.current?.focus()
    }
  }, [open])

  const money = new Intl.NumberFormat(LANGUAGE_TAGS[locale], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const labelOf = (key: ListKey, value: string) => {
    if (key !== 'price') return t(OPTION_LABELS[value])
    const band = PRICE_BANDS.find((b) => b.id === value)!
    if (band.min === 0) return t('Fino a {price}', { price: money.format(band.max / 100) })
    if (band.max === Infinity) return t('Da {price}', { price: money.format(band.min / 100) })
    return `${money.format(band.min / 100)} – ${money.format(band.max / 100)}`
  }
  // An option's count: models shown if it were the only choice in its group, other groups as they are.
  const count = (patch: Partial<FilterState>, base = filters) =>
    models.filter((m) => matches(m, facetsFor(m), { ...base, ...patch })).length
  const toggle = (key: ListKey, value: string) => {
    const list = filters[key] as string[]
    onChange({ ...filters, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } as FilterState)
  }
  const reset = () => onChange({ ...EMPTY_FILTERS, sort: filters.sort })

  const chips = [
    ...(['isNew', 'limited'] as const).filter((k) => filters[k]).map((k) => ({ id: k, label: t(FLAG_LABELS[k]), remove: () => onChange({ ...filters, [k]: false }) })),
    ...GROUPS.flatMap(({ key }) =>
      (filters[key] as string[]).map((value) => ({ id: `${key}-${value}`, label: labelOf(key, value), remove: () => toggle(key, value) })),
    ),
  ]

  const flagRow = (key: FlagKey) => {
    const checked = filters[key]
    const n = count({ [key]: true })
    if (!checked && count({ [key]: true }, EMPTY_FILTERS) === 0) return null
    return (
      <label key={key} className={rowClass}>
        <input
          type="checkbox"
          className={inputClass}
          checked={checked}
          disabled={!checked && n === 0}
          onChange={() => onChange({ ...filters, [key]: !checked })}
        />
        <span className="flex-1">{t(FLAG_LABELS[key])}</span>
        <span className="tabular-nums text-muted">{n}</span>
      </label>
    )
  }
  const flags = (['isNew', 'limited'] as const).map(flagRow).filter(Boolean)

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={`group inline-flex min-h-11 items-center gap-3 border border-ink px-4 font-sans text-small font-medium transition-colors duration-200 ${fine}:hover:bg-ink ${fine}:hover:text-bg`}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" />
            <rect x="5" y="3" width="3" height="3" fill="var(--color-bg)" />
            <rect x="10.5" y="7.5" width="3" height="3" fill="var(--color-bg)" />
            <rect x="4" y="12" width="3" height="3" fill="var(--color-bg)" />
          </svg>
          {t('Filtri e ordinamento')}
          {active > 0 && (
            <>
              <span
                aria-hidden="true"
                className={`inline-flex h-5 min-w-5 items-center justify-center bg-ink px-1 text-xs tabular-nums text-bg ${fine}:group-hover:bg-bg ${fine}:group-hover:text-ink`}
              >
                {active}
              </span>
              <span className="sr-only">, {t('Filtri attivi: {count}', { count: active })}</span>
            </>
          )}
        </button>
        <p className="text-small text-ink-2" aria-live="polite">
          {t('Modelli: {count}', { count: resultCount })}
          {filters.sort !== 'featured' && ` · ${t(SORT_LABELS[filters.sort])}`}
        </p>
        {active > 0 && (
          <button type="button" onClick={reset} className="min-h-11 text-small underline decoration-line underline-offset-4 hover:decoration-current">
            {t('Azzera filtri')}
          </button>
        )}
      </div>
      {chips.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.id}>
              <button
                type="button"
                onClick={chip.remove}
                aria-label={t('Rimuovi filtro: {name}', { name: chip.label })}
                className={`inline-flex min-h-9 items-center gap-2 border border-line px-3 text-xs font-medium transition-colors duration-200 ${fine}:hover:border-ink`}
              >
                {chip.label}
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 1l8 8M9 1L1 9" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // Clicks on the ::backdrop target the dialog element itself.
          if (e.target === e.currentTarget) setOpen(false)
        }}
        className="m-0 ml-auto h-dvh max-h-none w-full max-w-none border-0 bg-bg p-0 text-ink backdrop:bg-ink/30 sm:w-[420px] sm:border-l sm:border-line"
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-3">
              <h2 id={titleId} className="font-serif text-h3">
                {t('Filtri e ordinamento')}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-1 text-small underline decoration-line underline-offset-4 hover:decoration-current">
                {t('Chiudi')}
              </button>
            </div>
            <div className="flex-1 space-y-8 overflow-y-auto overscroll-contain px-6 py-6">
              <fieldset>
                <legend className={legendClass}>{t('Ordina per')}</legend>
                {SORTS.map((sort) => (
                  <label key={sort} className={rowClass}>
                    <input
                      type="radio"
                      name={`${titleId}-sort`}
                      className={inputClass}
                      checked={filters.sort === sort}
                      onChange={() => onChange({ ...filters, sort })}
                    />
                    <span className="flex-1">{t(SORT_LABELS[sort])}</span>
                  </label>
                ))}
              </fieldset>
              {flags.length > 0 && (
                <fieldset>
                  <legend className={legendClass}>{t('Selezione')}</legend>
                  {flags}
                </fieldset>
              )}
              {GROUPS.map(({ key, legend, options }) => {
                const selected = filters[key] as string[]
                const visible = options.filter((v) => selected.includes(v) || count({ [key]: [v] }, EMPTY_FILTERS) > 0)
                if (visible.length === 0) return null
                return (
                  <fieldset key={key}>
                    <legend className={legendClass}>{t(legend)}</legend>
                    {visible.map((value) => {
                      const checked = selected.includes(value)
                      const n = count({ [key]: [value] })
                      return (
                        <label key={value} className={rowClass}>
                          <input
                            type="checkbox"
                            className={inputClass}
                            checked={checked}
                            disabled={!checked && n === 0}
                            onChange={() => toggle(key, value)}
                          />
                          <span className="flex-1">{labelOf(key, value)}</span>
                          <span className="tabular-nums text-muted">{n}</span>
                        </label>
                      )
                    })}
                  </fieldset>
                )
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-line px-6 py-4">
              <button
                type="button"
                onClick={reset}
                disabled={active === 0}
                className="min-h-11 text-small underline decoration-line underline-offset-4 hover:decoration-current"
              >
                {t('Azzera filtri')}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn ml-auto bg-ink text-bg hover:bg-transparent hover:text-ink"
              >
                {t('Mostra i risultati ({count})', { count: resultCount })}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
