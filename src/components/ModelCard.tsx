import { useRef, useState } from 'react'
import Picture from './Picture'
import { Arrows, Swatches, resolveView, useSwipe } from './Gallery'
import { contatti, orologi } from '../data/content'
import { t, useContent } from '../lib/i18n'
import type { Model } from '../data/types'
import { availabilityOf } from '../lib/catalogFilters'
import { BuyButton } from './Cart'

/** mailto link for an information request about a model (codes of the chosen variant). */
export function infoHref(model: Model, codes: string[] = model.codes): string {
  const subject = `${t(orologi.catalog.mailSubject)}${model.name} (${codes.join(', ')})`
  return `mailto:${contatti.pec}?subject=${encodeURIComponent(subject)}`
}

/** Price style shared by the card, the dialog and the recommendations; colour comes from `priceTone`. */
export const priceClass = 'font-sans text-base font-medium tabular-nums'

/** Out-of-stock watches stay listed, with a quieter price. */
export const priceTone = (model: Model) => (statusLabel(model) ? 'text-muted' : 'text-ink')

export function statusLabel(model: Model): string | null {
  return availabilityOf(model) === 'out-of-stock' ? t('Esaurito') : null
}

const tag = 'inline-block border border-ink px-2 py-[5px] font-sans text-[0.6875rem] font-medium uppercase leading-[1.2] tracking-[0.08em] lg:tracking-[0.14em]'
export const limitedTag = `${tag} bg-ink text-bg`
export const statusTag = `${tag} bg-bg text-ink`

/** Limited-edition and status labels; the caller picks the direction (column on cards, row in the dialog). */
export function Tags({ model, className = '' }: { model: Model; className?: string }) {
  const status = statusLabel(model)
  if (!model.isNew && !model.limitedEdition && !status) return null
  return (
    <span className={`flex items-start gap-1 ${className}`}>
      {model.isNew && <span className={limitedTag}>{t('Nuovo')}</span>}
      {model.limitedEdition && <span className={limitedTag}>{t('Edizione limitata')}</span>}
      {status && <span className={statusTag}>{status}</span>}
    </span>
  )
}

/** Remaining pieces of a limited edition, shown only while at least one is left. */
export function PiecesNote({ model, className = '' }: { model: Model; className?: string }) {
  const pieces = model.piecesRemaining
  if (!model.limitedEdition || pieces == null || pieces < 1) return null
  return (
    <p className={`border-l-2 border-ink pl-2 font-sans text-xs font-medium uppercase leading-snug tracking-[0.12em] text-ink ${className}`}>
      {pieces === 1 ? t('Ultimo pezzo disponibile') : t('Ancora {count} pezzi', { count: pieces })}
    </p>
  )
}

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
        <Tags model={model} className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] flex-col" />
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
        <p className={`mt-1 ${priceClass} ${priceTone(model)}`}>
          <span className="sr-only">{site.labels.price}: </span>
          {view.price}
        </p>
        <PiecesNote model={model} className="mt-2" />
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
