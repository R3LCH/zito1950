import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { reviews } from '../data/reviews'
import { t, useContent } from '../lib/i18n'

const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=ZITO1950%20Via%20Michele%20Bianchi%2023%20Scalea'
const wrap = (index: number) => (index + reviews.length) % reviews.length

type Gesture = { id: number; start: number; last: number; time: number; velocity: number; width: number }

export default function Reviews() {
  const { contatti } = useContent()
  const region = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const [index, setIndex] = useState(0)
  const [exit, setExit] = useState<1 | -1 | 0>(0)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { setDesktop(pointer.matches); setReduced(motion.matches) }
    update()
    pointer.addEventListener('change', update)
    motion.addEventListener('change', update)
    return () => { pointer.removeEventListener('change', update); motion.removeEventListener('change', update) }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 })
    if (region.current) observer.observe(region.current)
    const update = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [])

  useEffect(() => () => { clearTimeout(timer.current) }, [])

  const change = useCallback((direction: 1 | -1) => {
    if (timer.current) return
    gesture.current = null
    setDragging(false)
    setExit(direction)
    timer.current = window.setTimeout(() => {
      setIndex(current => wrap(current + direction))
      setExit(0)
      setDrag(0)
      timer.current = undefined
    }, reduced ? 200 : 500)
  }, [reduced])

  const autoplaying = desktop && !reduced && visible && pageVisible && !hovered && !focused && !paused && !dragging
  const playing = autoplaying && !exit
  useEffect(() => {
    if (!playing) return
    const id = setTimeout(() => change(1), 6000)
    return () => clearTimeout(id)
  }, [playing, index, change])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (exit || !event.isPrimary || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { id: event.pointerId, start: event.clientX, last: event.clientX, time: event.timeStamp, velocity: 0, width: event.currentTarget.offsetWidth }
    setDragging(true)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    const elapsed = event.timeStamp - current.time
    if (elapsed > 0) current.velocity = (event.clientX - current.last) / elapsed
    current.last = event.clientX
    current.time = event.timeStamp
    if (!reduced) setDrag(event.clientX - current.start)
  }
  const finishPointer = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    gesture.current = null
    setDragging(false)
    const distance = event.clientX - current.start
    const velocity = event.timeStamp - current.time < 100 ? current.velocity : 0
    if (!cancelled && (Math.abs(distance) > current.width * 0.25 || (Math.abs(distance) > 10 && Math.abs(velocity) > 0.5))) {
      change((Math.abs(velocity) > 0.5 ? velocity : distance) < 0 ? 1 : -1)
    } else setDrag(0)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    change(event.key === 'ArrowLeft' ? -1 : 1)
  }

  return (
    <div ref={region} className="mx-auto mt-16 max-w-[32rem]" role="region" aria-roledescription={t('carosello')} aria-label={t('Recensioni')} onKeyDown={onKeyDown} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-serif text-h3">{t('Recensioni Google')}</h3>
        <span className="text-small text-muted">{t('5,0 · 31 recensioni')}</span>
      </div>
      <div className="review-stack" tabIndex={0} aria-live={autoplaying ? 'off' : 'polite'} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={event => finishPointer(event)} onPointerCancel={event => finishPointer(event, true)} onLostPointerCapture={event => finishPointer(event, true)}>
        {reviews.map((review, position) => {
          const depth = exit === -1 && position !== index ? wrap(index - position) : wrap(position - index)
          const active = position === index
          const style = {
            zIndex: active ? 5 : 4 - depth,
            opacity: active ? (exit ? 0 : 1) : depth === 1 ? 0.65 : depth === 2 ? 0.35 : 0,
            transform: active ? (exit ? `translateX(${exit === 1 ? '-' : ''}110%)` : `translateX(${drag}px)`) : `translateY(${Math.min(depth, 2) * 10}px) scale(${1 - Math.min(depth, 2) * 0.04})`,
            transition: dragging && active ? 'none' : undefined,
          }
          return <article key={review.author} className="review-card" style={style} aria-roledescription={t('recensione')} aria-hidden={!active} inert={!active}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-small font-semibold">{review.author}</span>
              <span aria-label={t('5 stelle su 5')} className="text-sm tracking-[0.12em]"><span aria-hidden="true">★★★★★</span></span>
            </div>
            <blockquote lang="it" className="font-serif text-xl leading-relaxed text-ink-2">{review.text}</blockquote>
          </article>
        })}
      </div>
      <div className="mt-8 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className="review-control" aria-label={t('Recensione precedente')} onClick={() => change(-1)}>←</button>
          <button type="button" className="review-control" aria-label={t('Recensione successiva')} onClick={() => change(1)}>→</button>
          <span className="ml-2 text-small text-muted">{t('{n} di 5', { n: index + 1 })}</span>
        </div>
        <button type="button" className="min-h-11 px-2 text-small underline underline-offset-4" disabled={!desktop || reduced} onClick={() => setPaused(value => !value)}>{paused ? t('Riprendi') : t('Pausa')}</button>
      </div>
      <a className="link-arrow mt-6 min-h-11" href={mapsUrl} target="_blank" rel="noopener noreferrer"><span>{t('Leggi tutte su Google')}<span className="sr-only"> {contatti.labels.newTab}</span></span></a>
    </div>
  )
}
