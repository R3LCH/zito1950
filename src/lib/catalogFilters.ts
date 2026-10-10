import type { Availability, Model } from '../data/types'

/**
 * Catalog facets derived from the Italian source text (specs, description, variant labels).
 * Always derive from the source catalog, never the localized one: translated specs would miss the keywords.
 * Caliber numbers stand in for missing wording (ETA 2824 is automatic, ETA 7001 manual, Miyota 2039 quartz).
 */
export const MOVEMENTS = ['automatic', 'manual', 'quartz'] as const
export const FEATURES = ['chronograph', 'tourbillon', 'date'] as const
export const MATERIALS = ['steel', 'gold', 'gold-plated'] as const
export type Movement = (typeof MOVEMENTS)[number]
export type Feature = (typeof FEATURES)[number]
export type Material = (typeof MATERIALS)[number]

export interface Facets {
  movement: Movement[]
  features: Feature[]
  material: Material[]
}

const RULES: { movement: Record<Movement, RegExp>; features: Record<Feature, RegExp>; material: Record<Material, RegExp> } = {
  movement: {
    automatic: /automatic|eta 2824|eta 2671|valjoux 7750/,
    manual: /carica manuale|eta 7001/,
    quartz: /quarz|miyota 2039/,
  },
  features: {
    chronograph: /chrono|cronograf/,
    tourbillon: /tourbillon/,
    date: /datario|\bdata\b/,
  },
  material: {
    steel: /acciai/,
    // Solid gold is always given with its caratage; "laminata in oro" is plating.
    gold: /\boro (rosa |giallo |bianco )?18/,
    'gold-plated': /laminat/,
  },
}

const pick = <K extends string>(text: string, rules: Record<K, RegExp>) =>
  (Object.keys(rules) as K[]).filter((key) => rules[key].test(text))

export function facetsOf(model: Model): Facets {
  const text = [
    model.name,
    model.description ?? '',
    ...model.specs,
    ...(model.variants ?? []).flatMap((v) => [v.label, ...(v.specs ?? [])]),
  ]
    .join(' ')
    .toLowerCase()
  return { movement: pick(text, RULES.movement), features: pick(text, RULES.features), material: pick(text, RULES.material) }
}

const EMPTY: Facets = { movement: [], features: [], material: [] }

/** Facets per model id; build from the source (Italian) catalog and memoize at the call site. */
export function facetIndex(models: Model[]): (model: Model) => Facets {
  const index = new Map(models.map((m) => [m.id, facetsOf(m)]))
  return (model: Model) => index.get(model.id) ?? EMPTY
}

/** Price shown first on the card: the default variant's when the model has variants. */
export const priceOf = (model: Model) => model.variants?.[0]?.priceCents ?? model.priceCents ?? 0

/** Upper bounds in cents; the last band is open-ended. */
export const PRICE_BANDS = [
  { id: 'to-300', min: 0, max: 30000 },
  { id: '300-600', min: 30000, max: 60000 },
  { id: '600-1000', min: 60000, max: 100000 },
  { id: '1000-2500', min: 100000, max: 250000 },
  { id: 'from-2500', min: 250000, max: Infinity },
] as const
export type PriceBand = (typeof PRICE_BANDS)[number]['id']

export const SORTS = ['featured', 'price-asc', 'price-desc', 'name'] as const
export type SortKey = (typeof SORTS)[number]

/** Public availabilities, in the order the catalog groups them. */
export const PUBLIC_AVAILABILITIES = ['buy', 'no-buy', 'out-of-stock', 'sold'] as const satisfies readonly Availability[]

export interface FilterState {
  sort: SortKey
  isNew: boolean
  limited: boolean
  availability: Availability[]
  movement: Movement[]
  features: Feature[]
  material: Material[]
  price: PriceBand[]
}

export const EMPTY_FILTERS: FilterState = {
  sort: 'featured',
  isNew: false,
  limited: false,
  availability: [],
  movement: [],
  features: [],
  material: [],
  price: [],
}

/** Number of active filters (sort excluded). */
export const activeCount = (f: FilterState) =>
  Number(f.isNew) + Number(f.limited) + f.availability.length + f.movement.length + f.features.length + f.material.length + f.price.length

const anyOf = <T,>(selected: T[], values: T[]) => selected.length === 0 || selected.some((v) => values.includes(v))

/** OR inside a group, AND across groups. */
export function matches(model: Model, facets: Facets, f: FilterState): boolean {
  const price = priceOf(model)
  return (
    (!f.isNew || !!model.isNew) &&
    (!f.limited || !!model.limitedEdition) &&
    anyOf(f.availability, [model.availability ?? 'no-buy']) &&
    anyOf(f.movement, facets.movement) &&
    anyOf(f.features, facets.features) &&
    anyOf(f.material, facets.material) &&
    (f.price.length === 0 || PRICE_BANDS.some((b) => f.price.includes(b.id) && price >= b.min && price < b.max))
  )
}

const RANK: Record<Availability, number> = { buy: 0, 'no-buy': 1, 'out-of-stock': 2, sold: 3, hidden: 4 }

/** Featured: new first, then purchasable → showcase → out of stock → sold, most expensive first. */
export function compareModels(sort: SortKey): (a: Model, b: Model) => number {
  switch (sort) {
    case 'price-asc':
      return (a, b) => priceOf(a) - priceOf(b) || a.name.localeCompare(b.name)
    case 'price-desc':
      return (a, b) => priceOf(b) - priceOf(a) || a.name.localeCompare(b.name)
    case 'name':
      return (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    default:
      return (a, b) =>
        Number(!!b.isNew) - Number(!!a.isNew) ||
        RANK[a.availability ?? 'no-buy'] - RANK[b.availability ?? 'no-buy'] ||
        priceOf(b) - priceOf(a)
  }
}

const shared = <T,>(a: T[], b: T[]) => a.filter((v) => b.includes(v)).length

/**
 * Every other model, most similar first:
 * 1. the owner's picks (`current.similar`), in the owner's order;
 * 2. by score: movement ×3, features ×2, case material ×1, same limited-edition status ×2, price closeness 0–2;
 * 3. ties: new first, then the closer price.
 */
export function relatedModels(current: Model, models: Model[], facetsFor: (m: Model) => Facets): Model[] {
  const others = models.filter((m) => m.id !== current.id)
  const picks = (current.similar ?? []).flatMap((id) => others.find((m) => m.id === id) ?? [])
  const picked = new Set(picks.map((m) => m.id))
  const base = facetsFor(current)
  const price = priceOf(current)
  const closeness = (m: Model) => {
    const other = priceOf(m)
    if (!price || !other) return 0
    // 2 for the same price, 0 from a tenfold difference on.
    return Math.max(0, 2 * (1 - Math.abs(Math.log10(other / price))))
  }
  const score = (m: Model) => {
    const f = facetsFor(m)
    return (
      3 * shared(base.movement, f.movement) +
      2 * shared(base.features, f.features) +
      shared(base.material, f.material) +
      (!!m.limitedEdition === !!current.limitedEdition ? 2 : 0) +
      closeness(m)
    )
  }
  const scored = others
    .filter((m) => !picked.has(m.id))
    .map((m) => ({ m, s: score(m) }))
    .sort(
      (a, b) =>
        b.s - a.s ||
        Number(!!b.m.isNew) - Number(!!a.m.isNew) ||
        Math.abs(priceOf(a.m) - price) - Math.abs(priceOf(b.m) - price),
    )
  return [...picks, ...scored.map(({ m }) => m)]
}
