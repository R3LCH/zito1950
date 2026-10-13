import Panel from './Panel'
import { contatti as baseContacts } from '../data/content'
import { useContent } from '../lib/i18n'

const fullAddress = `${baseContacts.address}, ${baseContacts.city}`
const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`

/** Large, calm link row: label on top, value below; whole row is the tap target. */
export function ContactLink({
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

  return (
    <Panel
      id="contatti"
      eyebrow={contatti.eyebrow}
      title={contatti.title}
      intro={<p>{contatti.intro}</p>}
      preview={
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <h3 className="text-h3">{site.cta.whereToFind}</h3>
            <address className="mt-5 not-italic">
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
            <a href={contatti.mapsUrl} target="_blank" rel="noopener noreferrer" className="link-arrow mt-5 min-h-11">
              <span>{contatti.labels.maps}</span>
              <span className="sr-only"> {contatti.labels.newTab}</span>
            </a>
            <h3 className="mt-10 text-h3">{site.cta.visit}</h3>
            <ul className="mt-5 border-t border-line">
              <ContactLink label={contatti.labels.pec} value={contatti.pec} href={`mailto:${contatti.pec}`} />
            </ul>
          </div>
          <div className="aspect-[4/3] w-full overflow-hidden rounded-[1.25rem] border border-line bg-well">
            <iframe src={mapEmbed} title={contatti.labels.mapTitle} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full w-full grayscale" />
          </div>
        </div>
      }
    />
  )
}
