import { useCallback, useState } from 'react'
import ModelCard from './ModelCard'
import ModelDialog from './ModelDialog'
import { models, orologi } from '../data/content'
import type { Model } from '../data/types'
import { useReveal } from '../lib/useReveal'

export default function Orologi() {
  const introRef = useReveal<HTMLDivElement>()
  const pillarsRef = useReveal<HTMLUListElement>()
  const [open, setOpen] = useState<{ model: Model; trigger: HTMLElement } | null>(null)

  const handleOpen = useCallback((model: Model, trigger: HTMLElement) => setOpen({ model, trigger }), [])
  const handleClose = useCallback(() => setOpen(null), [])

  return (
    <section id="orologi" aria-labelledby="orologi-title" className="py-(--section-y)">
      <div className="container-site">
        <div ref={introRef} className="reveal max-w-[60ch]">
          <p className="eyebrow">{orologi.eyebrow}</p>
          <h2 id="orologi-title" className="mt-4 font-serif text-h2">
            {orologi.title}
          </h2>
          <p className="mt-6 text-ink-2">{orologi.intro}</p>
        </div>

        <ul
          ref={pillarsRef}
          className="reveal mt-12 grid gap-x-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4"
        >
          {orologi.pillars.map((p) => (
            <li key={p.title} className="border-t border-line pt-6 pb-10">
              <h3 className="font-serif text-h3">{p.title}</h3>
              <p className="mt-3 text-small text-ink-2">{p.text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-(--section-y)">
          <p className="eyebrow">{orologi.catalog.eyebrow}</p>
          <h2 id="catalogo-title" className="mt-4 font-serif text-h2">
            {orologi.catalog.title}
          </h2>
        </div>

        <ul
          aria-labelledby="catalogo-title"
          className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-20"
        >
          {models.map((m) => (
            <li key={m.id}>
              <ModelCard model={m} onOpen={handleOpen} />
            </li>
          ))}
        </ul>
      </div>

      <ModelDialog model={open?.model ?? null} trigger={open?.trigger ?? null} onClose={handleClose} />
    </section>
  )
}
