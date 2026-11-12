import Panel from './Panel'
import { contatti as baseContacts } from '../data/content'
import { useContent } from '../lib/i18n'

const fullAddress = `${baseContacts.address}, ${baseContacts.city}`
const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`
const reviewsUrl = 'https://www.google.com/maps/search/?api=1&query=ZITO1950%20Via%20Michele%20Bianchi%2023%20Scalea'

/** Google listing rating under the map: hairline pill, opens the reviews in a new tab. */
function GoogleRating() {
  const { contatti } = useContent()
  return (
    <a
      href={reviewsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group mx-auto mt-6 flex w-fit min-h-11 items-center gap-3 rounded-full border border-line px-5 py-2 transition-[border-color] duration-200 hover:border-ink"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink" fill="currentColor">
        <path d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8Z" />
        <path d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
 <path d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
 <path d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
      </svg>
      <span className="font-serif text-xl leading-none text-ink">5,0</span>
      <span aria-hidden="true" className="text-small tracking-[0.12em] text-ink">★★★★★</span>
      <span className="sr-only">{contatti.labels.googleRating}.</span>
      <span className="text-small text-muted underline decoration-line underline-offset-[0.25em] transition-[text-decoration-color] duration-200 group-hover:decoration-current">{contatti.labels.googleReviews}</span>
      <span className="sr-only"> {contatti.labels.newTab}</span>
    </a>
  )
}

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

/** Dove siamo: centred map, Google rating and email link. No postal address is shown. */
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
          <GoogleRating />
          <ul className="mx-auto mt-8 max-w-[32rem] border-t border-line">
            <ContactLink label={contatti.labels.email} value={contatti.email} href={`mailto:${contatti.email}`} />
          </ul>
        </div>
      }
    />
  )
}
