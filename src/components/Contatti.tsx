import { useReveal } from '../lib/useReveal'
import { contatti as baseContacts } from '../data/content'
import { useContent } from '../lib/i18n'

const fullAddress = `${baseContacts.address}, ${baseContacts.city}`
const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`

/** Large, calm link row: label on top, value below; whole row is the tap target. */
function ContactLink({
  label,
  value,
  href,
  external = false,
}: {
  label: string
  value: string
  href: string
  external?: boolean
}) {
  const { contatti } = useContent()
  return (
    <li className="border-b border-line">
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="group flex min-h-16 items-center justify-between gap-4 py-4"
      >
        <span className="flex flex-col">
          <span className="text-small text-muted">{label}</span>
          <span className="font-serif text-xl [overflow-wrap:anywhere] underline decoration-line underline-offset-[0.25em] transition-[text-decoration-color] duration-200 group-hover:decoration-current sm:text-h3">
            {value}
          </span>
          {external && <span className="sr-only"> {contatti.labels.newTab}</span>}
        </span>
        <span aria-hidden="true" className="text-ink-2">
          {external ? '↗' : '→'}
        </span>
      </a>
    </li>
  )
}

export default function Contatti() {
  const { contatti, site } = useContent()
  const ref = useReveal<HTMLDivElement>()

  return (
    <section id="contatti" aria-labelledby="contatti-title" className="border-t border-line py-(--section-y)">
      <div ref={ref} className="reveal container-site">
        <header className="max-w-[60ch]">
          <p className="eyebrow">{contatti.eyebrow}</p>
          <h2 id="contatti-title" className="mt-4 text-h2">
            {contatti.title}
          </h2>
          <p className="mt-4 text-ink-2">{contatti.intro}</p>
        </header>

        <div className="mt-12 grid gap-12 md:mt-16 md:grid-cols-2 md:gap-16 lg:gap-24">
          <div>
            <h3 className="text-h3">{site.cta.whereToFind}</h3>
            <address className="mt-6 not-italic">
              <p className="font-medium">{contatti.company}</p>
              <p className="mt-1 text-ink-2">
                <span className="sr-only">{contatti.labels.address}: </span>
                {contatti.address}
                <br />
                {contatti.city}
              </p>
              <p className="mt-3 text-small text-muted">
                {contatti.labels.piva} {contatti.piva}
              </p>
            </address>
            <a
              href={contatti.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-arrow mt-6 min-h-11"
            >
              <span>{contatti.labels.maps}</span>
              <span className="sr-only"> {contatti.labels.newTab}</span>
            </a>
            <div className="mt-8 aspect-[4/3] w-full border border-line bg-well">
              <iframe
                src={mapEmbed}
                title={contatti.labels.mapTitle}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full grayscale"
              />
            </div>
          </div>

          <div>
            <h3 className="text-h3">{site.cta.visit}</h3>
            <ul className="mt-6 border-t border-line">
              <ContactLink label={contatti.labels.phone} value={contatti.numeroVerde} href={contatti.numeroVerdeHref} />
              <ContactLink label={contatti.labels.pec} value={contatti.pec} href={`mailto:${contatti.pec}`} />
            </ul>

            <h4 className="mt-10 text-small font-medium text-ink-2">{contatti.labels.social}</h4>
            <ul className="mt-3 border-t border-line">
              <ContactLink
                label={contatti.labels.instagram}
                value={`@${new URL(contatti.instagram).pathname.replaceAll('/', '')}`}
                href={contatti.instagram}
                external
              />
              <ContactLink
                label={contatti.labels.facebook}
                value={new URL(contatti.facebook).pathname.replaceAll('/', '')}
                href={contatti.facebook}
                external
              />
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
