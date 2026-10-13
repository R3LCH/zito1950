import Picture from './Picture'
import Panel from './Panel'
import { dims } from '../lib/imageMeta'
import { useContent } from '../lib/i18n'
import { useShop } from '../lib/shop'
import type { Profumo } from '../data/types'

/** One perfume: photo, name, code, price, quote, opening text, size and the request button. */
function Summary({ profumo, first }: { profumo: Profumo; first: boolean }) {
  const { contatti, site } = useContent()
  const mailHref = `mailto:${contatti.pec}?subject=${encodeURIComponent(`${profumo.labels.mailSubject} – ${profumo.name} (${profumo.code})`)}`
  const [image] = profumo.images
  const size = image && dims(image.src)
  const titleId = `profumo-${profumo.id}`

  return (
    <article aria-labelledby={titleId} className={`grid gap-8 md:grid-cols-2 md:items-center md:gap-14 ${first ? '' : 'mt-12 border-t border-line pt-12'}`}>
      {image && (
        <Picture src={image.src} alt={image.alt} width={size?.w} height={size?.h} sizes="(min-width: 768px) 44vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem]" className="h-auto w-full" />
      )}
      <div className="max-w-[60ch]">
        <h3 id={titleId} className="text-h2">{profumo.name}</h3>
        <dl className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-4">
          <div className="flex items-baseline gap-2">
            <dt className="text-small text-muted">{site.labels.code}</dt>
            <dd className="text-small tracking-wide">{profumo.code}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-small text-muted">{site.labels.price}</dt>
            <dd className="font-sans text-[1.25rem] font-medium tabular-nums text-ink">{profumo.price}</dd>
          </div>
        </dl>
        {profumo.quote.text.trim() && (
          <blockquote className="mt-6">
            <p className="font-serif text-h3 italic text-ink-2">«{profumo.quote.text}»</p>
            {profumo.quote.author?.trim() && <footer className="mt-2 text-small text-muted">— {profumo.quote.author}</footer>}
          </blockquote>
        )}
        {profumo.paragraphs[0] && <p className="mt-6 text-ink-2">{profumo.paragraphs[0]}</p>}
        {profumo.specs.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2 text-small" aria-label={site.labels.specs}>
            {profumo.specs.map((s) => (
              <li key={s} className="rounded-full border border-line px-3 py-1">{s}</li>
            ))}
          </ul>
        )}
        <a href={mailHref} className="btn mt-8 w-full rounded-full sm:w-auto">
          {site.cta.info}
        </a>
      </div>
    </article>
  )
}

/** The rest of a perfume's text and its ingredients, shown when the section is opened. */
function More({ profumo }: { profumo: Profumo }) {
  const rest = profumo.paragraphs.slice(1)
  if (!rest.length && !profumo.ingredients.length) return null
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
  const perfumes = catalog.perfumes
  if (perfumes.length === 0) return null
  const hasMore = perfumes.some((p) => p.paragraphs.length > 1 || p.ingredients.length > 0)

  return (
    <Panel
      id="profumi"
      eyebrow={profumiSection.eyebrow}
      title={profumiSection.title}
      intro={<p>{profumiSection.intro}</p>}
      preview={perfumes.map((p, i) => (
        <Summary key={p.id} profumo={p} first={i === 0} />
      ))}
    >
      {hasMore
        ? perfumes.map((p) => <More key={p.id} profumo={p} />)
        : undefined}
    </Panel>
  )
}
