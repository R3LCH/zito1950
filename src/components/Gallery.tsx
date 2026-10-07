import { useRef } from 'react'
import { useContent } from '../lib/i18n'
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

/**
 * Transparent prev/next arrows centred on the photo's sides, plus clickable dots at the bottom.
 * Wraps around. Renders nothing for a single photo.
 */
export function Arrows({ count, index, onChange, label, className = '' }: ArrowsProps) {
  const { orologi } = useContent()
  if (count < 2) return null
  // Dark icon with a soft white halo: readable on both white product shots and dark close-ups.
  const btn =
    'pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center text-ink [filter:drop-shadow(0_0_2px_rgb(255_255_255/0.95))_drop-shadow(0_0_6px_rgb(255_255_255/0.7))] transition-transform duration-200 active:scale-90'
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between">
        <button type="button" className={btn} aria-label={`${orologi.catalog.prevImage} – ${label}`} onClick={() => onChange((index - 1 + count) % count)}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 3L5 9l6 6" /></svg>
        </button>
        <button type="button" className={btn} aria-label={`${orologi.catalog.nextImage} – ${label}`} onClick={() => onChange((index + 1) % count)}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 3l6 6-6 6" /></svg>
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-1 flex justify-center">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${orologi.catalog.viewImage} ${i + 1} – ${label}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => onChange(i)}
            className="pointer-events-auto flex h-6 w-6 cursor-pointer items-center justify-center"
          >
            {/* White dot; a faint dark ring keeps it visible on white backgrounds. */}
            <span
              aria-hidden="true"
              className={`block rounded-full transition-all duration-300 ${
                i === index
                  ? 'h-2.5 w-2.5 bg-white shadow-[0_0_0_1px_rgb(20_20_20/0.55)]'
                  : 'h-2 w-2 bg-white/40 shadow-[0_0_0_1px_rgb(20_20_20/0.18)]'
              }`}
            />
          </button>
        ))}
      </div>
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
  const { orologi } = useContent()
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
