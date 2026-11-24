import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import Picture from './Picture'
import Panel from './Panel'
import { statusTag } from './ModelCard'
import { Arrows, useSwipe } from './Gallery'
import { dims } from '../lib/imageMeta'
import { t, useContent } from '../lib/i18n'
import { useShop } from '../lib/shop'
import type { Profumo } from '../data/types'

/**
 * One perfume: gallery, description and its details toggle, purchase/contact action, then plain-text specs.
 * coming-soon shows the «Prossimamente» eyebrow, all its text and no code, price or button.
 */
function PerfumeCard({ profumo }: { profumo: Profumo }) {
  const { contatti, site, profumiSection } = useContent()
  const { addPerfume, error } = useShop()
  const availability = profumo.availability ?? 'no-buy'
  const soon = availability === 'coming-soon'
  const mailHref = `mailto:${contatti.email}?subject=${encodeURIComponent(`${profumo.labels.mailSubject} – ${profumo.name}${profumo.code ? ` (${profumo.code})` : ''}`)}`
  const [imageIndex, setImageIndex] = useState(0)
  const count = profumo.images.length
  const active = Math.min(imageIndex, Math.max(0, count - 1))
  const image = profumo.images[active]
  const size = image && dims(image.src)
  const swipe = useSwipe((dir) => {
    if (count > 1) setImageIndex((active + dir + count) % count)
  })
  const [expanded, setExpanded] = useState(false)
  const paragraphs = profumo.paragraphs.filter((p) => p.trim())
  const hasMore = !soon && (paragraphs.length > 1 || profumo.ingredients.length > 0 || !!profumo.quote.text.trim())
  const detailsId = `profumo-${profumo.id}-details`
  const titleId = `profumo-${profumo.id}`
  const canBuy = availability === 'buy' && !error
  const askInfo = availability === 'no-buy' || (availability === 'buy' && !!error)

  return (
    <article aria-labelledby={titleId} className="flex h-full flex-col scroll-mt-[calc(var(--header-h)+1.5rem)] outline-none">
      {image && (
        <div className="relative aspect-square overflow-hidden rounded-[1.25rem] bg-bg" {...swipe}>
          <Picture
            key={image.src}
            src={image.src}
            alt={image.alt}
            width={size?.w}
            height={size?.h}
            sizes="(min-width: 640px) 46vw, 100vw"
            pictureClassName="block h-full w-full"
            className="h-full w-full object-contain"
          />
          <Arrows count={count} index={active} onChange={setImageIndex} label={profumo.name} />
        </div>
      )}
      <div className="flex flex-1 flex-col pt-6">
        {soon && <p className="mb-3 text-small uppercase tracking-[0.18em] text-muted">{profumiSection.soon}</p>}
        <h3 id={titleId} className="font-serif text-h3">{profumo.name}</h3>
        {profumo.line?.trim() && <p className="mt-1 font-serif text-lg italic text-ink-2">{profumo.line}</p>}
        {availability === 'out-of-stock' && <p className="mt-4"><span className={statusTag}>{t('Esaurito')}</span></p>}
        {!soon && (
          <dl className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-4">
            {profumo.code && (
              <div className="flex items-baseline gap-2">
                <dt className="text-small text-muted">{site.labels.code}</dt>
                <dd className="text-small tracking-wide">{profumo.code}</dd>
              </div>
            )}
            {profumo.price && (
              <div className="flex items-baseline gap-2">
                <dt className="text-small text-muted">{site.labels.price}</dt>
                <dd className={`font-sans text-[1.25rem] font-medium tabular-nums ${availability === 'out-of-stock' ? 'text-muted' : 'text-ink'}`}>{profumo.price}</dd>
              </div>
            )}
          </dl>
        )}
        {(soon ? paragraphs : paragraphs.slice(0, 1)).map((p, i) => (
          <p key={i} className="mt-5 max-w-[60ch] whitespace-pre-line text-ink-2">{p}</p>
        ))}
        {hasMore && (
          <>
            <div id={detailsId} hidden={!expanded} className="mt-5">
              <More profumo={profumo} />
            </div>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={detailsId}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-ink bg-bg px-5 text-small font-medium text-ink transition-colors duration-200 hover:bg-ink hover:text-bg"
                onClick={(event) => {
                  const button = event.currentTarget
                  const before = button.getBoundingClientRect().top
                  flushSync(() => setExpanded(!expanded))
                  if (expanded) window.scrollBy({ top: button.getBoundingClientRect().top - before, behavior: 'instant' })
                }}
              >
                {expanded ? site.panel.less : site.panel.more}
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
                  <path d="M3 5l4 4 4-4" />
                </svg>
              </button>
            </div>
          </>
        )}
        {(canBuy || askInfo) && (
          <div className="pt-6">
            {canBuy && (
              <button type="button" className="btn btn-motion w-full" onClick={() => addPerfume(profumo)}>
                {t('Acquista')}
              </button>
            )}
            {askInfo && (
              <a href={mailHref} className="btn btn-motion w-full rounded-full sm:w-auto">
                {site.cta.info}
              </a>
            )}
          </div>
        )}
        {profumo.specs.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-small text-ink-2" aria-label={site.labels.specs}>
            {profumo.specs.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

/** Details remain in their own card, above its toggle and purchase action. */
function More({ profumo }: { profumo: Profumo }) {
  const rest = profumo.paragraphs.filter((p) => p.trim()).slice(1)
  const quote = profumo.quote.text.trim()
  return (
    <div className="max-w-[60ch]">
        {quote && (
          <blockquote className={rest.length > 0 ? 'mb-6' : ''}>
            <p className="font-serif text-h3 italic text-ink-2">«{profumo.quote.text}»</p>
            {profumo.quote.author?.trim() && <footer className="mt-2 text-small text-muted">— {profumo.quote.author}</footer>}
          </blockquote>
        )}
        <div className="space-y-5 text-ink-2">
          {rest.map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>
        {profumo.ingredients.length > 0 && (
          <div className="mt-8">
            <h4 className="text-small font-medium text-ink-2">{profumo.labels.ingredients}</h4>
            <p className="mt-2 text-small text-muted">{profumo.ingredients.join(', ')}</p>
          </div>
        )}
    </div>
  )
}

export default function Profumi() {
  const { profumiSection } = useContent()
  const { localizedCatalog: catalog, viewing, setViewing } = useShop()
  // Hidden perfumes are already filtered out of the localized catalog.
  const perfumes = catalog.perfumes
  // A perfume clicked in the cart has no dialog: bring its card into view and move focus to it.
  useEffect(() => {
    if (viewing?.kind !== 'perfume') return
    setViewing(null)
    const card = document.getElementById(`profumo-${viewing.modelId}`)?.closest('article')
    if (!card) return
    // Two frames: the cart's close (scroll unlock, focus back to its opener) settles first, then one instant jump
    // (explicit, since the root's smooth scroll-behavior would otherwise animate across the whole page).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        card.setAttribute('tabindex', '-1')
        card.focus({ preventScroll: true })
        card.scrollIntoView({ block: 'start', behavior: 'instant' })
      }),
    )
  }, [viewing, setViewing])
  if (perfumes.length === 0) return null

  return (
    <Panel
      id="profumi"
      eyebrow={profumiSection.eyebrow}
      title={profumiSection.title}
      intro={<p>{profumiSection.intro}</p>}
      preview={
        <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:gap-x-10">
          {perfumes.map((p) => (
            <li key={p.id}>
              <PerfumeCard profumo={p} />
            </li>
          ))}
        </ul>
      }
    />
  )
}
