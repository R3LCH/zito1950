import { useRef } from 'react'
import Picture from './Picture'
import { contatti, orologi, site } from '../data/content'
import type { Model } from '../data/types'
import { naturalCap } from '../lib/imageMeta'

/** mailto link for an information request about a model. */
export function infoHref(model: Model): string {
  const subject = `${orologi.catalog.mailSubject}${model.name} (${model.codes.join(', ')})`
  return `mailto:${contatti.pec}?subject=${encodeURIComponent(subject)}`
}

/** Price style shared by the card and the dialog. */
export const priceClass = 'font-sans text-base font-medium tabular-nums text-ink'

interface Props {
  model: Model
  onOpen: (model: Model, trigger: HTMLElement) => void
}

export default function ModelCard({ model, onOpen }: Props) {
  const image = model.images[0]
  const titleId = `model-${model.id}-name`
  // Focus returns here on close, also when the dialog was opened from the image.
  const detailsRef = useRef<HTMLButtonElement>(null)
  const open = () => {
    if (detailsRef.current) onOpen(model, detailsRef.current)
  }
  return (
    <article aria-labelledby={titleId} className="group flex h-full flex-col">
      <button
        type="button"
        onClick={open}
        className="block w-full cursor-pointer text-left"
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-well/40 p-2 sm:p-3">
          {image && (
            // Capped at the natural size so small photos are never upscaled.
            <div className="h-full w-full" style={naturalCap(image.src)}>
              <Picture
                src={image.src}
                alt={image.alt}
                sizes="(min-width: 1024px) 380px, 45vw"
                pictureClassName="block h-full w-full"
                className="h-full w-full object-contain transition-transform duration-500 ease-out-quint [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.02]"
              />
            </div>
          )}
        </div>
      </button>
      <div className="flex flex-1 flex-col border-b border-line pt-4 pb-4">
        <h3 id={titleId} className="font-serif text-lg leading-snug lg:text-xl">
          {model.name}
        </h3>
        <p className="mt-1 text-xs text-muted">
          <span className="sr-only">{model.codes.length > 1 ? site.labels.codes : site.labels.code}: </span>
          {model.codes.join(' · ')}
        </p>
        <p className={`mt-1 ${priceClass}`}>
          <span className="sr-only">{site.labels.price}: </span>
          {model.price}
        </p>
        <div className="mt-auto flex flex-col pt-3">
          <button
            ref={detailsRef}
            type="button"
            onClick={(e) => onOpen(model, e.currentTarget)}
            className="link-arrow min-h-11 w-full cursor-pointer text-left"
            aria-haspopup="dialog"
            aria-describedby={titleId}
          >
            <span>{orologi.catalog.details}</span>
          </button>
          <a
            href={infoHref(model)}
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
