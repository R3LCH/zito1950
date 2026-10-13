import Picture from './Picture'
import Panel from './Panel'
import { statusTag } from './ModelCard'
import { dims } from '../lib/imageMeta'
import { t, useContent } from '../lib/i18n'
import { useShop } from '../lib/shop'
import type { Profumo } from '../data/types'

/**
 * One perfume: photo, name, line, code, price, quote, opening text, size and its action.
 * coming-soon shows the «Prossimamente» eyebrow and no code, price, quote or button.
 */
function Summary({ profumo, first }: { profumo: Profumo; first: boolean }) {
  const { contatti, site, profumiSection } = useContent()
  const { addPerfume, error } = useShop()
  const availability = profumo.availability ?? 'no-buy'
  const soon = availability === 'coming-soon'
  const mailHref = `mailto:${contatti.pec}?subject=${encodeURIComponent(`${profumo.labels.mailSubject} – ${profumo.name}${profumo.code ? ` (${profumo.code})` : ''}`)}`
  const [image] = profumo.images
  const size = image && dims(image.src)
  const titleId = `profumo-${profumo.id}`

  return (
    <article aria-labelledby={titleId} className={`grid gap-8 md:grid-cols-2 md:items-center md:gap-14 ${first ? '' : 'mt-12 border-t border-line pt-12'}`}>
      {image && (
        <Picture src={image.src} alt={image.alt} width={size?.w} height={size?.h} sizes="(min-width: 768px) 44vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem]" className="h-auto w-full" />
      )}
      <div className="max-w-[60ch]">
        {soon && <p className="mb-3 text-small uppercase tracking-[0.18em] text-muted">{profumiSection.soon}</p>}
        <h3 id={titleId} className="text-h2">{profumo.name}</h3>
        {profumo.line?.trim() && <p className="mt-2 font-serif text-h3 italic text-ink-2">{profumo.line}</p>}
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
        {!soon && profumo.quote.text.trim() && (
          <blockquote className="mt-6">
            <p className="font-serif text-h3 italic text-ink-2">«{profumo.quote.text}»</p>
            {profumo.quote.author?.trim() && <footer className="mt-2 text-small text-muted">— {profumo.quote.author}</footer>}
          </blockquote>
        )}
        {soon
          ? profumo.paragraphs.map((p) => <p key={p} className="mt-6 text-ink-2">{p}</p>)
          : profumo.paragraphs[0] && <p className="mt-6 text-ink-2">{profumo.paragraphs[0]}</p>}
        {profumo.specs.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2 text-small" aria-label={site.labels.specs}>
            {profumo.specs.map((s) => (
              <li key={s} className="rounded-full border border-line px-3 py-1">{s}</li>
            ))}
          </ul>
        )}
        {availability === 'buy' && !error && (
          <button type="button" className="btn mt-8 w-full" onClick={() => addPerfume(profumo)}>
            {t('Acquista')}
          </button>
        )}
        {(availability === 'no-buy' || (availability === 'buy' && !!error)) && (
          <a href={mailHref} className="btn mt-8 w-full rounded-full sm:w-auto">
            {site.cta.info}
          </a>
        )}
      </div>
    </article>
  )
}

/** The rest of a perfume's text and its ingredients, shown when the section is opened. */
function More({ profumo }: { profumo: Profumo }) {
  const rest = profumo.paragraphs.slice(1)
  return (
    <div className="mt-10 border-t border-line pt-8 first:mt-0 first:border-t-0 first:pt-0 md:grid md:grid-cols-12 md:gap-x-10">
      <p className="font-serif text-h3 md:col-span-4">{profumo.name}</p>
      <div className="mt-4 max-w-[60ch] md:col-span-8 md:mt-0">
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
  // Coming-soon perfumes show all their text in the summary, so they add nothing to More.
  const extra = perfumes.filter((p) => (p.availability ?? 'no-buy') !== 'coming-soon' && (p.paragraphs.length > 1 || p.ingredients.length > 0))

  return (
    <Panel
      id="profumi"
      eyebrow={profumiSection.eyebrow}
      title={profumiSection.title}
      intro={<p>{profumiSection.intro}</p>}
      preview={
        <>
          {perfumes.map((p, i) => (
            <Summary key={p.id} profumo={p} first={i === 0} />
          ))}
        </>
      }
    >
      {extra.length > 0 ? extra.map((p) => <More key={p.id} profumo={p} />) : undefined}
    </Panel>
  )
}
