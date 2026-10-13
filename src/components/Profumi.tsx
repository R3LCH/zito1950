import Picture from './Picture'
import Panel from './Panel'
import { dims } from '../lib/imageMeta'
import { useContent } from '../lib/i18n'
import { useShop } from '../lib/shop'
import type { Profumo } from '../data/types'

function Detail({ profumo, first }: { profumo: Profumo; first: boolean }) {
  const { contatti, site } = useContent()
  const mailHref = `mailto:${contatti.pec}?subject=${encodeURIComponent(`${profumo.labels.mailSubject} – ${profumo.name} (${profumo.code})`)}`
  const [image] = profumo.images
  const size = image && dims(image.src)
  const titleId = `profumo-${profumo.id}`

  return (
    <article aria-labelledby={titleId} className={`grid gap-8 md:grid-cols-2 md:items-start md:gap-14 ${first ? '' : 'mt-10 border-t border-line pt-10'}`}>
      {image && (
        <figure className="md:sticky md:top-[calc(var(--header-h)+2rem)]">
          <Picture src={image.src} alt={image.alt} width={size?.w} height={size?.h} sizes="(min-width: 768px) 44vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem]" className="h-auto w-full" />
        </figure>
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
        {(profumo.quote.text.trim() || profumo.quote.author?.trim()) && (
          <blockquote className="mt-8">
            {profumo.quote.text.trim() && <p className="font-serif text-h3 italic text-ink-2">«{profumo.quote.text}»</p>}
            {profumo.quote.author?.trim() && (
              <footer className={`${profumo.quote.text.trim() ? 'mt-2 ' : ''}text-small text-muted`}>— {profumo.quote.author}</footer>
            )}
          </blockquote>
        )}
        <div className="mt-8 space-y-5 text-ink-2">
          {profumo.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        {profumo.specs.length > 0 && (
          <ul className="mt-8 space-y-1 text-small" aria-label={site.labels.specs}>
            {profumo.specs.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        {profumo.ingredients.length > 0 && (
          <div className="mt-8 border-t border-line pt-6">
            <h4 className="text-small font-medium text-ink-2">{profumo.labels.ingredients}</h4>
            <p className="mt-2 text-small text-muted">{profumo.ingredients.join(', ')}</p>
          </div>
        )}
        <a href={mailHref} className="btn mt-10 w-full rounded-full sm:w-auto">
          {site.cta.info}
        </a>
      </div>
    </article>
  )
}

export default function Profumi() {
  const { profumiSection } = useContent()
  const { localizedCatalog: catalog } = useShop()
  const perfumes = catalog.perfumes
  if (perfumes.length === 0) return null

  return (
    <Panel
      id="profumi"
      eyebrow={profumiSection.eyebrow}
      title={profumiSection.title}
      intro={<p>{profumiSection.intro}</p>}
      previewOnlyCollapsed
      preview={
        <ul className={`grid gap-6 ${perfumes.length > 1 ? 'sm:grid-cols-2' : 'max-w-xl'} ${perfumes.length > 2 ? 'lg:grid-cols-3' : ''}`}>
          {perfumes.map((p) => {
            const [image] = p.images
            return (
              <li key={p.id}>
                {image && <Picture src={image.src} alt={image.alt} sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw" pictureClassName="block aspect-[3/2] overflow-hidden rounded-[1.25rem] bg-well" className="h-full w-full object-cover" />}
                <p className="mt-4 font-serif text-h3">{p.name}</p>
                <p className="mt-1 text-small text-muted">
                  {p.code} · <span className="font-medium tabular-nums text-ink">{p.price}</span>
                </p>
              </li>
            )
          })}
        </ul>
      }
    >
      {perfumes.map((p, i) => (
        <Detail key={p.id} profumo={p} first={i === 0} />
      ))}
    </Panel>
  )
}
