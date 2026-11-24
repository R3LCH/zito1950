import { useEffect, useRef, useState, type ReactNode } from 'react'
import { asset } from '../lib/asset'
import { LanguageSelector, t, useLocale } from '../lib/i18n'
import { productRequest } from '../lib/productLinks'
import { useShop } from '../lib/shop'

/** Resolve only after a successful catalogue load; never reveal bundled or hidden products. */
export default function ProductEntry({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState(productRequest)
  const { localizedCatalog: catalog, loaded, error, reload, setViewing } = useShop()
  const { locale } = useLocale()
  const [retrying, setRetrying] = useState(false)
  const entered = useRef(false)
  useEffect(() => {
    const selected = () => { entered.current = true; setRequest(productRequest()) }
    const navigated = () => { entered.current = false; setRequest(productRequest()) }
    window.addEventListener('producturlchange', selected)
    window.addEventListener('popstate', navigated)
    return () => {
      window.removeEventListener('producturlchange', selected)
      window.removeEventListener('popstate', navigated)
    }
  }, [])
  const product = request?.kind === 'model'
    ? catalog.models.find(item => item.id === request.id && item.availability !== 'hidden')
    : request?.kind === 'perfume'
      ? catalog.perfumes.find(item => item.id === request.id && item.availability !== 'hidden')
      : undefined
  const ready = loaded && !error && !retrying
  useEffect(() => {
    if (!request || !ready || !product || entered.current) return
    entered.current = true
    setViewing({ kind: request.kind === 'perfume' ? 'perfume' : 'model', modelId: product.id, variantId: request.variantId })
  }, [request, ready, product, setViewing])
  if (!request || (ready && product)) return children
  const loading = !loaded || retrying
  const home = `${asset('')}?lang=${locale}`
  const heading = loading ? 'Caricamento del prodotto…' : error ? 'Impossibile caricare il prodotto' : 'Prodotto non trovato'
  return (
    <main id="contenuto" className="container-site flex min-h-dvh flex-col items-center py-8 text-center">
      <div className="self-end"><LanguageSelector /></div>
      <a href={home} aria-label={t('Torna alla pagina iniziale')} className="mt-12 block w-full max-w-[22rem]">
        <img src={asset('logo.svg')} alt="ZITO1950®" width="352" height="112" className="h-auto w-full" />
      </a>
      <div className="my-auto w-full max-w-[38rem] py-16" aria-busy={loading}>
        <h1 className="font-serif text-h2" role="status">{t(heading)}</h1>
        {!loading && <>
          <p className="mt-5 text-ink-2">{t(error ? 'Riprova tra poco oppure torna alla collezione.' : 'Questo prodotto non è disponibile nella collezione.')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {error && <button type="button" className="btn rounded-full" onClick={async () => { setRetrying(true); try { await reload() } finally { setRetrying(false) } }}>{t('Riprova')}</button>}
            <a className="btn rounded-full" href={`${home}#${request.kind === 'perfume' ? 'profumi' : 'orologi'}`}>{t('Vai ai prodotti')}</a>
          </div>
        </>}
      </div>
    </main>
  )
}
