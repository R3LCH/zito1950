import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { models, officina, profumo, site, storia, tesoroDiAlarico, territorio } from '../data/content'
import type { CertificateHolder, Img, Model, Profumo } from '../data/types'
import { ENGRAVING_MAX_CHARS } from '../data/types'
import { localizeImage, localizeModel, localizePerfume, seedImageTranslations, seedModelTranslations, seedPerfumeTranslations } from '../data/localization'
import { formatMoney, useLocale } from './i18n'
import { availabilityOf } from './catalogFilters'

export const STATIC_PREVIEW = import.meta.env.VITE_STATIC_PREVIEW === 'true'

export interface Catalog {
  revision: number
  models: Model[]
  perfumes: Profumo[]
  /** Model ids shown on the homepage before the catalog is expanded, owner order, max 4. */
  featured: string[]
  hero: Img
  photos: Img[]
  imageOverrides: Record<string, Img>
  siteImages: Img[]
}
export interface CartLine {
  /** Missing = 'model', so carts stored before perfumes were sold keep working. */
  kind?: 'model' | 'perfume'
  /** Watch model id, or the perfume id when kind is 'perfume'. */
  modelId: string
  /** Always null for perfumes. */
  variantId: string | null
  quantity: number
  /** Stable per-line id, so differently personalized lines of one product coexist; assigned when missing. */
  id?: string
  /** Optional "Certificato della proprietà e garanzia" holder; null = none. Fields may be blank while the buyer is typing. */
  certificate?: CertificateHolder | null
  /** Optional engraving as typed; null or blank = none. */
  engraving?: string | null
  /** Buyer confirmed that an engraved item cannot be returned. */
  engravingAccepted?: boolean
}
/** Personalized lines (certificate or engraving) are one piece each and never merge with a new add. */
export const isPersonalized = (line: CartLine) => !!line.certificate || !!line.engraving?.trim()
export interface Session {
  csrf: string
  admin: boolean
}
let session: Session | null = null
export async function getSession() {
  if (STATIC_PREVIEW) throw new Error('Anteprima statica: accesso e operazioni server non disponibili.')
  const response = await fetch('/api/session')
  if (!response.ok) throw new Error('Sessione non disponibile.')
  session = (await response.json()) as Session
  return session
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (STATIC_PREVIEW) throw new Error('Anteprima statica: nessuna modifica viene pubblicata e i pagamenti sono disattivati.')
  if (method !== 'GET' && !session) await getSession()
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(method !== 'GET' ? { 'X-CSRF-Token': session!.csrf } : {}),
    },
    ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Richiesta non riuscita.')
  if (path === '/admin/login') session = result
  if (path === '/admin/logout') session = null
  return result as T
}
export const euro = formatMoney
export const lineKey = (line: CartLine) => `${line.kind ?? 'model'}:${line.modelId}:${line.variantId ?? ''}:${line.id ?? ''}`
// Original catalog prices use Italian thousands separators and decimal commas.
const seedPrice = (price: string) => Math.round(Number(price.replaceAll('.', '').replace(',', '.').replace(' EUR', '')) * 100)
// Seed models whose specs read "Edizione limitata".
const LIMITED_EDITIONS: Record<string, true> = { 'tutus-ab-uno': true, takimo: true, bauletto: true }
const initial: Catalog = {
  revision: 0,
  models: models.map(model => seedModelTranslations({
    ...model,
    priceCents: seedPrice(model.price),
    // The GitHub Pages preview has no backend catalog; make the seed purchasable so the cart can be shown.
    availability: STATIC_PREVIEW ? 'buy' : 'no-buy',
    limitedEdition: LIMITED_EDITIONS[model.id] === true,
    piecesRemaining: null,
    variants: model.variants?.map(variant => ({ ...variant, priceCents: seedPrice(variant.price) })),
  })),
  perfumes: [profumo, tesoroDiAlarico].map(perfume => {
    const priceCents = perfume.price.trim() ? seedPrice(perfume.price) : 0
    return seedPerfumeTranslations({ ...perfume, priceCents, ...(STATIC_PREVIEW && priceCents > 0 ? { availability: 'buy' as const } : {}) })
  }),
  featured: [],
  hero: seedImageTranslations(site.hero.image),
  photos: [],
  imageOverrides: {},
  siteImages: [site.hero.image, storia.image, ...storia.chapters.flatMap(chapter => chapter.image ? [chapter.image] : []), officina.image, territorio.image, ...profumo.images],
}
interface ShopState {
  catalog: Catalog
  localizedCatalog: Catalog
  setCatalog: (catalog: Catalog) => void
  cart: CartLine[]
  setCart: (cart: CartLine[]) => void
  add: (model: Model, variant: number) => void
  addPerfume: (perfume: Profumo) => void
  cartOpen: boolean
  setCartOpen: (open: boolean) => void
  /** The product just added on a phone, shown in the "Aggiunto al carrello" popup; null when it is closed. */
  added: Omit<CartLine, 'id'> | null
  setAdded: (line: Omit<CartLine, 'id'> | null) => void
  error: string
  reload: () => Promise<void>
}
const Context = createContext<ShopState | null>(null)
const isText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max
function storedCart(): CartLine[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('zito-cart') ?? '[]')
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (v): v is CartLine =>
          !!v &&
          (v.kind === undefined || v.kind === 'model' || v.kind === 'perfume') &&
          typeof v.modelId === 'string' &&
          (v.variantId === null || typeof v.variantId === 'string') &&
          Number.isInteger(v.quantity) &&
          v.quantity > 0 &&
          v.quantity <= 10 &&
          // Lines stored before personalization have none of the fields below.
          (v.id === undefined || isText(v.id, 64)) &&
          (v.certificate == null ||
            (typeof v.certificate === 'object' &&
              isText(v.certificate.firstName, 80) &&
              isText(v.certificate.lastName, 80) &&
              isText(v.certificate.email, 254))) &&
          (v.engraving == null || isText(v.engraving, ENGRAVING_MAX_CHARS)) &&
          (v.engravingAccepted === undefined || typeof v.engravingAccepted === 'boolean'),
      )
      .slice(0, 30)
      .map((line) => {
        const id = line.id ?? crypto.randomUUID()
        return isPersonalized(line) ? { ...line, id, quantity: 1 } : { ...line, id }
      })
  } catch {
    return []
  }
}
export function ShopProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale()
  const [catalog, setCatalog] = useState(initial)
  const [cart, setCart] = useState<CartLine[]>(storedCart)
  const [cartOpen, setCartOpen] = useState(new URLSearchParams(location.search).has('checkout'))
  const [added, setAdded] = useState<Omit<CartLine, 'id'> | null>(null)
  const [error, setError] = useState('')
  const localizedCatalog = useMemo<Catalog>(() => ({
    ...catalog,
    hero: localizeImage(catalog.hero, locale),
    models: catalog.models.map(model => {
      const localized = localizeModel(model, locale)
      return { ...localized, price: formatMoney(model.priceCents ?? seedPrice(model.price)), variants: localized.variants?.map(variant => ({ ...variant, price: formatMoney(variant.priceCents ?? seedPrice(variant.price)) })) }
    }),
    perfumes: catalog.perfumes
      .filter(perfume => perfume.availability !== 'hidden')
      .map(perfume => {
        const cents = perfume.priceCents ?? seedPrice(perfume.price)
        return { ...localizePerfume(perfume, locale), price: cents > 0 ? formatMoney(cents) : '' }
      }),
    imageOverrides: Object.fromEntries(Object.entries(catalog.imageOverrides).map(([source, image]) => [source, localizeImage(image, locale)])),
  }), [catalog, locale])
  const reload = async () => {
    if (STATIC_PREVIEW) return
    try {
      setCatalog(await api<Catalog>('/catalog'))
      setError('')
    } catch {
      setError('Il negozio non è disponibile. Puoi consultare la collezione e contattarci.')
    }
  }
  useEffect(() => {
    void reload()
    if (!STATIC_PREVIEW) void getSession().catch(() => {})
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('zito-cart', JSON.stringify(cart))
    } catch {
      /* Cart still works without browser storage. */
    }
  }, [cart])
  const addLine = (line: Omit<CartLine, 'id'>) => {
    setCart((current) => {
      // A new add only joins the plain (unpersonalized) line of the same product.
      const old = current.find(
        (item) =>
          (item.kind ?? 'model') === (line.kind ?? 'model') &&
          item.modelId === line.modelId &&
          item.variantId === line.variantId &&
          !isPersonalized(item),
      )
      return old
        ? current.map((item) => (item === old ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item))
        : [...current, { ...line, id: crypto.randomUUID(), certificate: null, engraving: null, engravingAccepted: false }]
    })
    // Below lg the cart is a single column: confirm in a small popup and let the buyer keep browsing.
    if (window.matchMedia('(max-width: 1023.98px)').matches) setAdded(line)
    else setCartOpen(true)
  }
  const add = (model: Model, variant: number) => {
    if (availabilityOf(model) !== 'buy' || error) return
    addLine({ modelId: model.id, variantId: model.variants?.[variant]?.id ?? null, quantity: 1 })
  }
  const addPerfume = (perfume: Profumo) => {
    if (perfume.availability !== 'buy' || error) return
    addLine({ kind: 'perfume', modelId: perfume.id, variantId: null, quantity: 1 })
  }
  return (
    <Context.Provider value={{ catalog, localizedCatalog, setCatalog, cart, setCart, add, addPerfume, cartOpen, setCartOpen, added, setAdded, error, reload }}>
      {children}
    </Context.Provider>
  )
}
export function useShop() {
  const value = useContext(Context)
  if (!value) throw new Error('ShopProvider required')
  return value
}
