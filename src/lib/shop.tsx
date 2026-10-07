import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { models, profumo, site, storia } from '../data/content'
import type { Img, Model, Profumo } from '../data/types'

export const STATIC_PREVIEW = import.meta.env.VITE_STATIC_PREVIEW === 'true'

export interface Catalog {
  revision: number
  models: Model[]
  perfume: Profumo | null
  hero: Img
  photos: Img[]
  imageOverrides: Record<string, Img>
  siteImages: Img[]
}
export interface CartLine {
  modelId: string
  variantId: string | null
  quantity: number
}
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
export const euro = (cents: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
export const lineKey = (line: CartLine) => `${line.modelId}:${line.variantId ?? ''}`
// Original catalog prices use Italian thousands separators and decimal commas.
const seedPrice = (price: string) => Math.round(Number(price.replaceAll('.', '').replace(',', '.').replace(' EUR', '')) * 100)
const initial: Catalog = {
  revision: 0,
  models: models.map(model => ({
    ...model,
    priceCents: seedPrice(model.price),
    buyEnabled: false,
    variants: model.variants?.map(variant => ({ ...variant, priceCents: seedPrice(variant.price) })),
  })),
  perfume: { ...profumo, priceCents: seedPrice(profumo.price) },
  hero: site.hero.image,
  photos: [],
  imageOverrides: {},
  siteImages: [site.hero.image, ...storia.chapters.flatMap(chapter => chapter.image ? [chapter.image] : []), ...profumo.images],
}
interface ShopState {
  catalog: Catalog
  setCatalog: (catalog: Catalog) => void
  cart: CartLine[]
  setCart: (cart: CartLine[]) => void
  add: (model: Model, variant: number) => void
  cartOpen: boolean
  setCartOpen: (open: boolean) => void
  error: string
  reload: () => Promise<void>
}
const Context = createContext<ShopState | null>(null)
function storedCart(): CartLine[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('zito-cart') ?? '[]')
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (v): v is CartLine =>
          !!v &&
          typeof v.modelId === 'string' &&
          (v.variantId === null || typeof v.variantId === 'string') &&
          Number.isInteger(v.quantity) &&
          v.quantity > 0 &&
          v.quantity <= 10,
      )
      .slice(0, 30)
  } catch {
    return []
  }
}
export function ShopProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState(initial)
  const [cart, setCart] = useState<CartLine[]>(storedCart)
  const [cartOpen, setCartOpen] = useState(new URLSearchParams(location.search).has('checkout'))
  const [error, setError] = useState('')
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
  const add = (model: Model, variant: number) => {
    if (!model.buyEnabled || error) return
    const line = { modelId: model.id, variantId: model.variants?.[variant]?.id ?? null, quantity: 1 }
    setCart((current) => {
      const old = current.find((item) => lineKey(item) === lineKey(line))
      return old
        ? current.map((item) => (item === old ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item))
        : [...current, line]
    })
    setCartOpen(true)
  }
  return (
    <Context.Provider value={{ catalog, setCatalog, cart, setCart, add, cartOpen, setCartOpen, error, reload }}>
      {children}
    </Context.Provider>
  )
}
export function useShop() {
  const value = useContext(Context)
  if (!value) throw new Error('ShopProvider required')
  return value
}
