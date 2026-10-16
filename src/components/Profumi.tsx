import Picture from './Picture'
import Panel from './Panel'
import { statusTag } from './ModelCard'
import { dims } from '../lib/imageMeta'
import { t, useContent } from '../lib/i18n'
import { useShop } from '../lib/shop'
import type { Profumo } from '../data/types'

/**
 * One perfume as a vertical card: photo, name, line, code, price, opening text, size and its action.
 * coming-soon shows the «Prossimamente» eyebrow, all its text and no code, price or button.
 */
function PerfumeCard({ profumo }: { profumo: Profumo }) {
  const { contatti, site, profumiSection } = useContent()
  const { addPerfume, error } = useShop()
  const availability = profumo.availability ?? 'no-buy'
  const soon = availability === 'coming-soon'
  const mailHref = `mailto:${contatti.email}?subject=${encodeURIComponent(`${profumo.labels.mailSubject} – ${profumo.name}${profumo.code ? ` (${profumo.code})` : ''}`)}`
  const [image] = profumo.images
  const size = image && dims(image.src)
  const titleId = `profumo-${profumo.id}`
  const canBuy = availability === 'buy' && !error
  const askInfo = availability === 'no-buy' || (availability === 'buy' && !!error)

  return (
    <article aria-labelledby={titleId} className="flex h-full flex-col">
      {image && (
        <Picture
          src={image.src}
          alt={image.alt}
          width={size?.w}
          height={size?.h}
          sizes="(min-width: 640px) 46vw, 100vw"
          pictureClassName="block aspect-square overflow-hidden rounded-[1.25rem] bg-bg"
          className="h-full w-full object-contain"
        />
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
        {soon
          ? profumo.paragraphs.map((p) => <p key={p} className="mt-5 max-w-[60ch] text-ink-2">{p}</p>)
          : profumo.paragraphs[0] && <p className="mt-5 max-w-[60ch] text-ink-2">{profumo.paragraphs[0]}</p>}
        {profumo.specs.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2 text-small" aria-label={site.labels.specs}>
            {profumo.specs.map((s) => (
              <li key={s} className="rounded-full border border-line px-3 py-1">{s}</li>
            ))}
          </ul>
        )}
        {(canBuy || askInfo) && (
          <div className="mt-auto pt-8">
            {canBuy && (
              <button type="button" className="btn w-full" onClick={() => addPerfume(profumo)}>
                {t('Acquista')}
              </button>
            )}
            {askInfo && (
              <a href={mailHref} className="btn w-full rounded-full sm:w-auto">
                {site.cta.info}
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

/** A perfume's quote, the rest of its text and its ingredients, shown when the section is opened. */
function More({ profumo }: { profumo: Profumo }) {
  const rest = profumo.paragraphs.slice(1)
  const quote = profumo.quote.text.trim()
  return (
    <div className="mt-10 border-t border-line pt-8 first:mt-0 first:border-t-0 first:pt-0 md:grid md:grid-cols-12 md:gap-x-10">
      <p className="font-serif text-h3 md:col-span-4">{profumo.name}</p>
      <div className="mt-4 max-w-[60ch] md:col-span-8 md:mt-0">
        {quote && (
          <blockquote className={rest.length > 0 ? 'mb-6' : ''}>
            <p className="font-serif text-h3 italic text-ink-2">«{profumo.quote.text}»</p>
            {profumo.quote.author?.trim() && <footer className="mt-2 text-small text-muted">— {profumo.quote.author}</footer>}
          </blockquote>
        )}
        <div className="space-y-5 text-ink-2">
          {rest.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        {profumo.ingredients.length > 0 && (
          <div className="mt-8">
            <h4 className="text-small font-medium text-ink-2">{profumo.labels.ingredients}</h4>
            <p className="mt-2 text-small text-muted">{profumo.ingredients.join(', ')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Profumi() {
  const { profumiSection } = useContent()
  const { localizedCatalog: catalog } = useShop()
  // Hidden perfumes are already filtered out of the localized catalog.
  const perfumes = catalog.perfumes
  if (perfumes.length === 0) return null
  // Coming-soon perfumes show all their text on the card and never a quote, so they add nothing to More.
  const extra = perfumes.filter(
    (p) => (p.availability ?? 'no-buy') !== 'coming-soon' && (p.paragraphs.length > 1 || p.ingredients.length > 0 || !!p.quote.text.trim()),
  )

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
    >
      {extra.length > 0 ? extra.map((p) => <More key={p.id} profumo={p} />) : undefined}
    </Panel>
  )
}
