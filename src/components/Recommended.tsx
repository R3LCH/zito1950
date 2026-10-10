import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Picture from './Picture'
import { Tags, priceClass, priceTone } from './ModelCard'
import { resolveView } from './Gallery'
import { t, useContent } from '../lib/i18n'
import { useShop } from '../lib/shop'
import { facetIndex, relatedModels } from '../lib/catalogFilters'
import type { Model } from '../data/types'

interface Props {
  current: Model
  /** Public (non-hidden) models. */
  models: Model[]
  onSelect: (model: Model) => void
}

const fine = '[@media(hover:hover)_and_(pointer:fine)]'
const arrowClass = `flex h-11 w-11 items-center justify-center border border-line text-ink transition-colors duration-200 disabled:cursor-default disabled:opacity-30 ${fine}:enabled:hover:border-ink`

/** Every other public watch in one scrollable row: owner's picks first, then the most similar. */
export default function Recommended({ current, models, onSelect }: Props) {
  const { site } = useContent()
  const { catalog } = useShop()
  const railId = useId()
  const rail = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })
  const facetsFor = useMemo(() => facetIndex(catalog.models), [catalog.models])
  const picks = useMemo(() => relatedModels(current, models, facetsFor), [current, models, facetsFor])
  const hasPicks = picks.length > 0

  const measure = useCallback(() => {
    const el = rail.current
    if (!el) return
    const start = el.scrollLeft <= 1
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [])

  useEffect(() => {
    const el = rail.current
    if (!el) return
    // A newly selected model starts the row from its own most similar watches.
    el.scrollLeft = 0
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    const onWheel = (e: WheelEvent) => {
      // Horizontal gestures and pinch-zoom keep their native behaviour.
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1)
      const max = el.scrollWidth - el.clientWidth
      // At either end the wheel scrolls the dialog again, so the row never traps vertical scrolling.
      if ((delta < 0 && el.scrollLeft <= 0) || (delta > 0 && el.scrollLeft >= max - 1)) return
      e.preventDefault()
      el.scrollLeft += delta
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      el.removeEventListener('wheel', onWheel)
    }
  }, [current.id, hasPicks, measure])

  // One page = as many whole cards as fit, so pages stay aligned to card edges.
  const page = (dir: 1 | -1) => {
    const el = rail.current
    const item = el?.firstElementChild
    if (!el || !item) return
    const step = item.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || '0')
    const perPage = Math.max(1, Math.floor((el.clientWidth + 1) / step))
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * perPage * step, behavior: reduce ? 'auto' : 'smooth' })
  }

  if (!hasPicks) return null

  return (
    <section aria-labelledby="recommended-title" className="border-t border-line px-5 pt-10 pb-12 md:px-12">
      <div className="flex items-end justify-between gap-4">
        <h3 id="recommended-title" className="font-serif text-h3">
          {t('Scopri anche')}
        </h3>
        {!(edges.start && edges.end) && (
          <div className="flex gap-2">
            <button type="button" className={arrowClass} disabled={edges.start} aria-controls={railId} aria-label={t('Modelli precedenti')} onClick={() => page(-1)}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 3L5 9l6 6" /></svg>
            </button>
            <button type="button" className={arrowClass} disabled={edges.end} aria-controls={railId} aria-label={t('Modelli successivi')} onClick={() => page(1)}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 3l6 6-6 6" /></svg>
            </button>
          </div>
        )}
      </div>
      <ul
        id={railId}
        ref={rail}
        onScroll={measure}
        className="mt-6 flex gap-4 overflow-x-auto overscroll-x-contain pb-4 md:gap-6 [@media(pointer:coarse)]:snap-x [@media(pointer:coarse)]:snap-mandatory"
      >
        {picks.map((m) => {
          const view = resolveView(m, 0)
          const image = view.images[0]
          return (
            <li key={m.id} className="w-[42%] shrink-0 snap-start md:w-[calc((100%-4.5rem)/4)]">
              <button type="button" onClick={() => onSelect(m)} className="group block w-full cursor-pointer text-left">
                <span className="relative block aspect-square overflow-hidden bg-well">
                  {image && (
                    <Picture
                      src={image.src.replace('img/models/', 'img/cards/')}
                      alt=""
                      sizes="(min-width: 768px) 220px, 42vw"
                      pictureClassName="block h-full w-full"
                      className={`h-full w-full object-contain transition-transform duration-500 ease-out-quint ${fine}:group-hover:scale-[1.02]`}
                    />
                  )}
                  <Tags model={m} className="absolute left-2 top-2 max-w-[calc(100%-1rem)] flex-col" />
                </span>
                <span className={`mt-3 block font-serif text-lg leading-snug underline decoration-transparent underline-offset-4 transition-colors duration-200 ${fine}:group-hover:decoration-current`}>
                  {m.name}
                </span>
                <span className={`mt-1 block ${priceClass} ${priceTone(m)}`}>
                  <span className="sr-only">{site.labels.price}: </span>
                  {view.price}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
