import Picture from './Picture'
import { Tags, priceClass, priceTone } from './ModelCard'
import { resolveView } from './Gallery'
import { t, useContent } from '../lib/i18n'
import type { Model } from '../data/types'

interface Props {
  current: Model
  /** Public (non-hidden) models. */
  models: Model[]
  onSelect: (model: Model) => void
}

/** Up to four other watches: same limited-edition status first, then the closest price. */
export default function Recommended({ current, models, onSelect }: Props) {
  const { site } = useContent()
  const price = current.priceCents ?? 0
  const picks = models
    .filter((m) => m.id !== current.id)
    .sort(
      (a, b) =>
        Number(!!b.limitedEdition === !!current.limitedEdition) - Number(!!a.limitedEdition === !!current.limitedEdition) ||
        Math.abs((a.priceCents ?? 0) - price) - Math.abs((b.priceCents ?? 0) - price),
    )
    .slice(0, 4)
  if (picks.length === 0) return null

  return (
    <section aria-labelledby="recommended-title" className="border-t border-line px-5 pt-10 pb-12 md:px-12">
      <h3 id="recommended-title" className="font-serif text-h3">
        {t('Scopri anche')}
      </h3>
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
        {picks.map((m) => {
          const view = resolveView(m, 0)
          const image = view.images[0]
          return (
            <li key={m.id}>
              <button type="button" onClick={() => onSelect(m)} className="group block w-full cursor-pointer text-left">
                <span className="relative block aspect-square overflow-hidden bg-well">
                  {image && (
                    <Picture
                      src={image.src.replace('img/models/', 'img/cards/')}
                      alt=""
                      sizes="(min-width: 768px) 220px, 45vw"
                      pictureClassName="block h-full w-full"
                      className="h-full w-full object-contain transition-transform duration-500 ease-out-quint [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.02]"
                    />
                  )}
                  <Tags model={m} className="absolute left-2 top-2 max-w-[calc(100%-1rem)] flex-col" />
                </span>
                <span className="mt-3 block font-serif text-lg leading-snug underline decoration-transparent underline-offset-4 transition-colors duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:decoration-current">
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
