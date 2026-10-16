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

/** Dove siamo: the map alone, centred, with the email link right under it. No postal address is shown. */
export default function Contatti() {
  const { contatti } = useContent()

  return (
    <Panel
      id="contatti"
      eyebrow={contatti.eyebrow}
      title={contatti.title}
      preview={
        <div className="mx-auto max-w-[56rem]">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-[1.25rem] border border-line bg-well sm:aspect-[16/9]">
            <iframe src={mapEmbed} title={contatti.labels.mapTitle} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full w-full grayscale" />
          </div>
          <ul className="mx-auto mt-8 max-w-[32rem] border-t border-line">
            <ContactLink label={contatti.labels.email} value={contatti.email} href={`mailto:${contatti.email}`} />
          </ul>
        </div>
      }
    />
  )
}
