import { useRef } from 'react'
import { orologi } from '../data/content'
import type { Img, Model, Variant } from '../data/types'

/** Codes, price, specs and photos for the chosen variant (or the model itself). */
export function resolveView(model: Model, variant: number): { codes: string[]; price: string; specs: string[]; images: Img[]; current?: Variant } {
  const v = model.variants?.[variant]
  if (!v) return { codes: model.codes, price: model.price, specs: model.specs, images: model.images }
  return { codes: v.codes, price: v.price, specs: v.specs ?? model.specs, images: v.images, current: v }
}

interface ArrowsProps {
  count: number
  index: number
  onChange: (i: number) => void
  /** Model name, for screen-reader context. */
  label: string
  className?: string
}

/** Prev/next buttons plus a 1/3 counter; wraps around. Renders nothing for a single photo. */
export function Arrows({ count, index, onChange, label, className = '' }: ArrowsProps) {
  if (count < 2) return null
  const btn =
    'pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center bg-bg/85 text-ink transition-colors duration-200 hover:bg-bg'
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between ${className}`}>
      <button type="button" className={btn} aria-label={`${orologi.catalog.prevImage} – ${label}`} onClick={() => onChange((index - 1 + count) % count)}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 3L5 9l6 6" /></svg>
      </button>
      <span className="bg-bg/85 px-2 py-0.5 text-xs tabular-nums text-ink-2" aria-live="polite">
        {index + 1}/{count}
      </span>
      <button type="button" className={btn} aria-label={`${orologi.catalog.nextImage} – ${label}`} onClick={() => onChange((index + 1) % count)}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 3l6 6-6 6" /></svg>
      </button>
    </div>
  )
}

/** Horizontal swipe on touch screens. */
export function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<number | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = e.touches[0].clientX
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (start.current === null) return
      const dx = e.changedTouches[0].clientX - start.current
      start.current = null
      if (Math.abs(dx) > 40) onSwipe(dx < 0 ? 1 : -1)
    },
  }
}

interface SwatchesProps {
  model: Model
  value: number
  onChange: (i: number) => void
  size?: 'sm' | 'md'
}

/** Colour picker as a radio group; each swatch shows 1–2 colours split diagonally. */
export function Swatches({ model, value, onChange, size = 'sm' }: SwatchesProps) {
  if (!model.variants || model.variants.length < 2) return null
  const dot = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'
  return (
    <div role="radiogroup" aria-label={`${orologi.catalog.colors} – ${model.name}`} className="flex flex-wrap items-center gap-1">
      {model.variants.map((v, i) => {
        const [a, b = a] = v.swatch
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={i === value}
            aria-label={v.label}
            title={v.label}
            onClick={() => onChange(i)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center"
          >
            <span
              aria-hidden="true"
              className={`block ${dot} rounded-full border border-line ${i === value ? 'outline outline-1 outline-offset-2 outline-ink' : ''}`}
              style={{ background: `linear-gradient(135deg, ${a} 50%, ${b} 50%)` }}
            />
          </button>
        )
      })}
      {size === 'md' && model.variants[value] && <span className="ml-1 text-small text-ink-2">{model.variants[value].label}</span>}
    </div>
  )
}
