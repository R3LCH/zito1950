import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { motion, useReducedMotion, type PanInfo, type Transition } from 'framer-motion'

export interface CardStackItem {
  id: string
  name: string
  designation?: string
  content: ReactNode
}

interface CardStackProps {
  items: readonly CardStackItem[]
  /** Accessible name of the stack, its role description and each card's role description. */
  label: string
  roleLabel: string
  itemLabel: string
  /** Vertical peek of each card behind the front one, in px; every card stays visible. */
  offset?: number
  scaleFactor?: number
}

const SETTLE: Transition = { type: 'spring', stiffness: 210, damping: 30, mass: 0.9 }
const EXIT: Transition = { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
const REDUCED: Transition = { default: { duration: 0 }, opacity: { duration: 0.2, ease: 'linear' } }

/**
 * Hairline cards stacked one behind the other. A click, tap, swipe or arrow key sends the front card
 * out while the others move up in the same motion; the sent card rejoins the back of the stack unseen.
 */
export function CardStack({ items, label, roleLabel, itemLabel, offset = 12, scaleFactor = 0.035 }: CardStackProps) {
  const reduced = useReducedMotion()
  const [order, setOrder] = useState(() => items.map(item => item.id))
  const [leaving, setLeaving] = useState<{ id: string; direction: 1 | -1 } | null>(null)
  const byId = new Map(items.map(item => [item.id, item]))

  const advance = (direction: 1 | -1) => {
    if (leaving || order.length < 2) return
    setLeaving({ id: order[0], direction })
  }
  const settle = () => {
    setOrder(current => [...current.slice(1), current[0]])
    setLeaving(null)
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 70 || Math.abs(info.velocity.x) > 500)
      advance((info.velocity.x || info.offset.x) < 0 ? -1 : 1)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) return
    event.preventDefault()
    advance(event.key === 'ArrowRight' ? 1 : -1)
  }

  return (
    <div
      role="group"
      aria-roledescription={roleLabel}
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="grid rounded-[1.25rem] outline-offset-4"
      style={{ paddingTop: offset * (items.length - 1) }}
    >
      {order.map((id, position) => {
        const item = byId.get(id)
        if (!item) return null
        const isLeaving = leaving?.id === id
        const front = position === 0 && !leaving
        // While the front card leaves, the others already take their next places.
        const depth = leaving ? position - 1 : position
        const target = isLeaving
          ? reduced
     ? { opacity: 0 }
     : { x: leaving.direction < 0 ? '-45%' : '45%', y: -offset * 2, scale: 1, opacity: 0 }
   : { x: 0, y: -depth * offset, scale: 1 - depth * scaleFactor, opacity: 1 }
        return (
   <motion.article
     key={id}
     aria-roledescription={itemLabel}
     aria-hidden={!front && !isLeaving}
     className={`col-start-1 row-start-1 flex min-w-0 select-none flex-col justify-between gap-8 rounded-[1.25rem] border border-line bg-bg p-6 md:p-8 ${front ? 'cursor-pointer' : ''}`}
     style={{ transformOrigin: 'top center', zIndex: isLeaving ? order.length + 1 : order.length - depth }}
     initial={false}
     animate={target}
     transition={reduced ? REDUCED : isLeaving ? EXIT : SETTLE}
     onAnimationComplete={() => { if (isLeaving) settle() }}
            drag={front ? 'x' : false}
     dragSnapToOrigin
            dragElastic={0.5}
     onDragEnd={front ? onDragEnd : undefined}
     onTap={front ? () => advance(-1) : undefined}
   >
     <div className="font-serif text-xl leading-relaxed text-ink-2" aria-live={front ? 'polite' : undefined}>{item.content}</div>
     <div>
       <p className="text-small font-semibold text-ink">{item.name}</p>
       {item.designation && <p className="text-small text-muted">{item.designation}</p>}
     </div>
          </motion.article>
        )
      })}
    </div>
  )
}
