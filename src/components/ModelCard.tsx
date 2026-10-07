import { useRef, useState } from 'react'
import Picture from './Picture'
import { Arrows, Swatches, resolveView, useSwipe } from './Gallery'
import { contatti, orologi } from '../data/content'
import { t, useContent } from '../lib/i18n'
import type { Model } from '../data/types'
import { BuyButton } from './Cart'

/** mailto link for an information request about a model (codes of the chosen variant). */
export function infoHref(model: Model, codes: string[] = model.codes): string {
  const subject = `${t(orologi.catalog.mailSubject)}${model.name} (${codes.join(', ')})`
  return `mailto:${contatti.pec}?subject=${encodeURIComponent(subject)}`
}

/** Price style shared by the card and the dialog. */
export const priceClass = 'font-sans text-base font-medium tabular-nums text-ink'

interface Props {
  model: Model
  onOpen: (model: Model, trigger: HTMLElement, variant: number, image: number) => void
}

export default function ModelCard({ model, onOpen }: Props) {
  const { orologi, site } = useContent()
  const [variant, setVariant] = useState(0)
  const [index, setIndex] = useState(0)
  const view = resolveView(model, variant)
  const image = view.images[index] ?? view.images[0]
  const count = view.images.length
  const titleId = `model-${model.id}-name`
  const detailsRef = useRef<HTMLButtonElement>(null)
  const swipe = useSwipe((dir) => setIndex((i) => (i + dir + count) % count))

  return (
    <article aria-labelledby={titleId} className="group flex h-full flex-col">
      <div className="relative aspect-square overflow-hidden bg-bg" {...swipe}>
        <button
          type="button"
          onClick={() => detailsRef.current && onOpen(model, detailsRef.current, variant, index)}
          className="block h-full w-full cursor-pointer"
          tabIndex={-1}
          aria-hidden="true"
        >
          {image && (
            <Picture
              key={image.src}
              src={image.src.replace('img/models/', 'img/cards/')}
              alt={image.alt}
              sizes="(min-width: 1024px) 380px, 45vw"
              pictureClassName="block h-full w-full"
              className="h-full w-full object-contain transition-transform duration-500 ease-out-quint [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.02]"
            />
          )}
        </button>
        <Arrows
          count={count}
          index={index}
          onChange={setIndex}
          label={model.name}
          className="[@media(hover:hover)_and_(pointer:fine)]:opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
        />
      </div>
      <div className="flex flex-1 flex-col border-b border-line pt-4 pb-4">
        <h3 id={titleId} className="font-serif text-lg leading-snug lg:text-xl">
          {model.name}
        </h3>
        <p className="mt-1 text-xs text-muted">
          <span className="sr-only">{view.codes.length > 1 ? site.labels.codes : site.labels.code}: </span>
          {view.codes.join(' · ')}
          {view.current && <span className="text-ink-2"> · {view.current.label}</span>}
        </p>
        <p className={`mt-1 ${priceClass}`}>
          <span className="sr-only">{site.labels.price}: </span>
          {view.price}
        </p>
        <div className="-ml-3 mt-1">
          <Swatches
            model={model}
            value={variant}
            onChange={(i) => {
              setVariant(i)
              setIndex(0)
            }}
          />
        </div>
        <div className="mt-auto flex flex-col pt-3">
          <button
            ref={detailsRef}
            type="button"
            onClick={(e) => onOpen(model, e.currentTarget, variant, index)}
            className="link-arrow min-h-11 w-full cursor-pointer text-left"
            aria-haspopup="dialog"
            aria-describedby={titleId}
          >
            <span>{orologi.catalog.details}</span>
          </button>
          <BuyButton modelId={model.id} variant={variant} />
          <a
            href={infoHref(model, view.codes)}
            aria-describedby={titleId}
            className="flex min-h-11 w-full items-center py-1 text-[0.8125rem] leading-tight tracking-normal text-ink-2 underline decoration-line underline-offset-4 [overflow-wrap:anywhere] hover:decoration-current lg:text-small"
          >
            {site.cta.info}
          </a>
        </div>
      </div>
    </article>
  )
}
