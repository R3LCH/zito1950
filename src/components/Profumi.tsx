import Picture from './Picture'
import { dims } from '../lib/imageMeta'
import { useReveal } from '../lib/useReveal'
import { useContent } from '../lib/i18n'
import { useShop } from '../lib/shop'

export default function Profumi() {
  const { contatti, site } = useContent()
  const ref = useReveal<HTMLDivElement>()
  const { localizedCatalog: catalog } = useShop()
  const profumo = catalog.perfume
  if (!profumo) return null
  const mailHref = `mailto:${contatti.pec}?subject=${encodeURIComponent(
    `${profumo.labels.mailSubject} – ${profumo.name} (${profumo.code})`,
  )}`
  const [image] = profumo.images
  const size = image && dims(image.src)

  return (
    <section id="profumi" aria-labelledby="profumi-title" className="py-(--section-y)">
      <div ref={ref} className="reveal container-site grid gap-10 md:grid-cols-2 md:items-start md:gap-16 lg:gap-24">
        {image && (
          <figure className="md:sticky md:top-[calc(var(--header-h)+2rem)]">
            {/* Natural ratio (landscape 1536x1024), full column width, no well. */}
            <Picture
              src={image.src}
              alt={image.alt}
              width={size?.w}
              height={size?.h}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="h-auto w-full"
            />
          </figure>
        )}

        <div className="max-w-[60ch]">
          <p className="eyebrow">{profumo.eyebrow}</p>
          <h2 id="profumi-title" className="mt-4 text-h2">
            {profumo.name}
          </h2>

          <dl className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-4">
            <div className="flex items-baseline gap-2">
              <dt className="text-small text-muted">{site.labels.code}</dt>
              <dd className="text-small tracking-wide">{profumo.code}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-small text-muted">{site.labels.price}</dt>
              <dd className="font-sans text-[1.25rem] font-medium tabular-nums text-ink">{profumo.price}</dd>
            </div>
          </dl>

          <blockquote className="mt-8">
            <p className="font-serif text-h3 italic text-ink-2">«{profumo.quote.text}»</p>
            {profumo.quote.author && (
              <footer className="mt-2 text-small text-muted">— {profumo.quote.author}</footer>
            )}
          </blockquote>

          <div className="mt-8 space-y-5 text-ink-2">
            {profumo.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <ul className="mt-8 space-y-1 text-small" aria-label={site.labels.specs}>
            {profumo.specs.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>

          <div className="mt-8 border-t border-line pt-6">
            <h3 className="text-small font-sans font-medium text-ink-2">{profumo.labels.ingredients}</h3>
            <p className="mt-2 text-small text-muted">{profumo.ingredients.join(', ')}</p>
          </div>

          <a href={mailHref} className="btn mt-10 w-full sm:w-auto">
            {site.cta.info}
          </a>
        </div>
      </div>
    </section>
  )
}
