import { useEffect, useRef, useState } from 'react'
import Picture from './Picture'
import { infoHref, priceClass } from './ModelCard'
import { orologi, site } from '../data/content'
import type { Model } from '../data/types'
import { dims } from '../lib/imageMeta'

interface Props {
  model: Model | null
  /** Element focused again once the dialog closes. */
  trigger: HTMLElement | null
  onClose: () => void
}

export default function ModelDialog({ model, trigger, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
    const dialog = ref.current
    if (!dialog || !model) return
    if (!dialog.open) dialog.showModal()
    const { overflow } = document.documentElement.style
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = overflow
      if (dialog.open) dialog.close()
      trigger?.focus()
    }
  }, [model, trigger])

  const titleId = 'model-dialog-title'
  const image = model?.images[active] ?? model?.images[0]
  const size = image && dims(image.src)
  // Wide photos stack above the text so the grid doesn't leave an empty block under them.
  const wide = !!size && size.w / size.h > 1.3
  const capVh = wide ? 60 : 70

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Clicks on the ::backdrop target the dialog element itself.
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-bg p-0 text-ink backdrop:bg-ink/30 md:m-auto md:h-auto md:max-h-[90dvh] md:w-[min(1040px,calc(100%-4rem))] md:border md:border-line"
    >
      {model && (
        <div className="relative">
          <div className="sticky top-0 z-10 flex justify-end bg-bg/95 md:absolute md:top-3 md:right-3 md:bg-transparent">
            <button
              type="button"
              onClick={onClose}
              aria-label={site.labels.close}
              className="flex h-12 w-12 cursor-pointer items-center justify-center text-ink transition-colors duration-200 hover:bg-well"
            >
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l12 12M16 4L4 16" />
              </svg>
            </button>
          </div>
          <div className={`grid gap-8 px-5 pb-10 md:gap-12 md:p-12 ${wide ? '' : 'md:grid-cols-2'}`}>
            <div>
              {image && (
                <div className="flex justify-center">
                  {/* Natural aspect ratio, capped in height and never wider than the file's pixel width. */}
                  <div
                    className="w-full"
                    style={
                      size && {
                        aspectRatio: `${size.w} / ${size.h}`,
                        maxWidth: `min(${size.w}px, calc(${capVh}vh * ${size.w / size.h}))`,
                      }
                    }
                  >
                    <Picture
                      key={image.src}
                      src={image.src}
                      alt={image.alt}
                      width={size?.w}
                      height={size?.h}
                      loading="eager"
                      sizes={wide ? '(min-width: 768px) 940px, 100vw' : '(min-width: 768px) 480px, 100vw'}
                      pictureClassName="block h-full w-full"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              )}
              {model.images.length > 1 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {model.images.map((im, i) => (
                    <li key={im.src}>
                      <button
                        type="button"
                        onClick={() => setActive(i)}
                        aria-pressed={i === active}
                        aria-label={`${orologi.catalog.viewImage} ${i + 1}: ${im.alt}`}
                        className={`block h-16 w-14 cursor-pointer bg-well ${i === active ? 'outline outline-1 outline-ink' : ''}`}
                      >
                        <Picture src={im.src} alt="" sizes="56px" pictureClassName="block h-full w-full" className="h-full w-full object-contain p-1" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={wide ? 'grid gap-8 md:grid-cols-2 md:gap-12' : 'max-w-[60ch]'}>
              <div className={wide ? 'max-w-[60ch]' : undefined}>
                <h2 id={titleId} className="font-serif text-h2">
                  {model.name}
                </h2>
                <p className="mt-2 text-small text-muted">
                  {model.codes.length > 1 ? site.labels.codes : site.labels.code}: {model.codes.join(' · ')}
                </p>
                <p className={`mt-4 ${priceClass}`}>
                  <span className="sr-only">{site.labels.price}: </span>
                  {model.price}
                </p>
                {model.quote && (
                  <figure className="mt-8 border-l border-line pl-5">
                    <blockquote className="font-serif text-xl italic leading-snug">“{model.quote.text}”</blockquote>
                    {model.quote.author && (
                      <figcaption className="mt-2 text-small text-muted">— {model.quote.author}</figcaption>
                    )}
                  </figure>
                )}
                {model.description && <p className="mt-6 text-ink-2">{model.description}</p>}
              </div>
              <div>
                {/* In the stacked layout the grid gap already separates the columns. */}
                <h3 className={`${wide ? '' : 'mt-8 '}font-sans text-eyebrow uppercase tracking-[0.18em] font-medium text-ink-2`}>
                  {site.labels.specs}
                </h3>
                <ul className="mt-3 border-t border-line">
                  {model.specs.map((s) => (
                    <li key={s} className="border-b border-line py-2.5 text-small">
                      {s}
                    </li>
                  ))}
                </ul>
                <a href={infoHref(model)} className="btn mt-8 w-full sm:w-auto">
                  {site.cta.info}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}
