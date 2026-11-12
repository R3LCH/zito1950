import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { reviews } from '../data/reviews'
import { t, useContent } from '../lib/i18n'
import Panel from './Panel'

const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=ZITO1950%20Via%20Michele%20Bianchi%2023%20Scalea'
const wrap = (index: number) => (index + reviews.length) % reviews.length
const SLIDE = 1100

type Gesture = { id: number; start: number; last: number; time: number; velocity: number; width: number }

/** Stack of shop reviews: cards fan out behind the active one and leave toward the top left. */
export default function Reviews() {
  const { recensioni, contatti } = useContent()
  const region = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const [index, setIndex] = useState(0)
  const [exit, setExit] = useState<1 | -1 | 0>(0)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { setDesktop(pointer.matches); setReduced(motion.matches) }
    update()
    pointer.addEventListener('change', update)
    motion.addEventListener('change', update)
    return () => { pointer.removeEventListener('change', update); motion.removeEventListener('change', update) }
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
    }, reduced ? 200 : SLIDE)
  }, [reduced])

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
    <Panel
      id="recensioni"
      eyebrow={recensioni.eyebrow}
      title={recensioni.title}
      preview={({ header }) => (
        <div className="grid gap-8 md:grid-cols-12 md:items-center md:gap-x-10 lg:gap-x-16">
          <div className="max-w-[34ch] md:col-span-5 md:col-start-1">
            {header}
            <div className="mt-6 space-y-4 text-ink-2">
              {recensioni.paragraphs.map(p => <p key={p}>{p}</p>)}
            </div>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <div ref={region} role="region" aria-roledescription={t('carosello')} aria-label={recensioni.title} onKeyDown={onKeyDown}>
              <div className="review-stack" tabIndex={0} aria-live="polite" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={event => finishPointer(event)} onPointerCancel={event => finishPointer(event, true)} onLostPointerCapture={event => finishPointer(event, true)}>
                {reviews.map((review, position) => {
                  const depth = exit === -1 && position !== index ? wrap(index - position) : wrap(position - index)
                  const active = position === index
                  const leaving = active && exit !== 0
                  const style = {
                    zIndex: active ? 5 : 4 - depth,
                    opacity: leaving ? 0 : depth === 0 ? 1 : depth === 1 ? 0.65 : depth === 2 ? 0.35 : 0,
                    transform: leaving
                      ? `translate(-72%, -40%) rotate(-7deg)`
                      : active
                        ? `translateX(${drag}px)`
                        : `translateY(${Math.min(depth, 2) * 12}px) scale(${1 - Math.min(depth, 2) * 0.04})`,
                    transition: dragging && active ? 'none' : undefined,
                  }
                  return <article key={review.author} className="review-card" style={style} aria-roledescription={t('recensione')} aria-hidden={!active} inert={!active}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-small font-semibold">{review.author}</span>
                      <span aria-label={t('5 stelle su 5')} className="text-sm tracking-[0.12em]"><span aria-hidden="true">★★★★★</span></span>
                    </div>
                    <blockquote className="font-serif text-xl leading-relaxed text-ink-2">{t(review.text)}</blockquote>
                  </article>
                })}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center gap-1">
                  <button type="button" className="review-control" aria-label={t('Recensione precedente')} onClick={() => change(-1)}>←</button>
                  <button type="button" className="review-control" aria-label={t('Recensione successiva')} onClick={() => change(1)}>→</button>
                </div>
                <p className="text-small text-muted">{t(desktop ? 'Clicca le frecce per leggere le altre recensioni' : 'Scorri di lato per leggere le altre recensioni')}</p>
              </div>
              <a className="link-arrow mt-4 min-h-11" href={mapsUrl} target="_blank" rel="noopener noreferrer"><span>{t('Leggi tutte')}<span className="sr-only"> {contatti.labels.newTab}</span></span></a>
            </div>
          </div>
        </div>
      )}
    />
  )
}
