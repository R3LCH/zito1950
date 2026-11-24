import { asset } from './asset'

export type ProductKind = 'model' | 'perfume'

/** IDs, not names or catalogue positions: renaming and admin additions keep links stable. */
export function productHref(kind: ProductKind, id: string, locale: string, variantId?: string) {
  const query = new URLSearchParams({ product: `${kind}:${id}`, lang: locale })
  if (kind === 'model' && variantId) query.set('variant', variantId)
  return `${asset('')}?${query}`
}

export function productRequest() {
  const query = new URLSearchParams(location.search)
  const value = query.get('product')
  if (value === null) return null
  const separator = value.indexOf(':')
  return { kind: value.slice(0, separator), id: separator < 0 ? '' : value.slice(separator + 1), variantId: query.get('variant') }
}

/** Selecting products updates the address bar without adding a history entry per gallery click. */
export function setProductUrl(kind: ProductKind, id: string, locale: string, variantId?: string) {
  history.replaceState(history.state, '', productHref(kind, id, locale, variantId))
  window.dispatchEvent(new Event('producturlchange'))
}

export function clearProductUrl() {
  const url = new URL(location.href)
  url.searchParams.delete('product')
  url.searchParams.delete('variant')
  history.replaceState(history.state, '', url)
  window.dispatchEvent(new Event('producturlchange'))
}
