import { useContent } from '../lib/i18n'
import Picture from './Picture'
import Panel from './Panel'

/** The town: main photo with the opening lines, the rest of the text and the period photo open below. */
export default function Scalea() {
  const { storia } = useContent()
  const { place } = storia
  const [main, secondary] = place.images
  const lead = place.paragraphs.slice(0, 2)
  const more = place.paragraphs.slice(2)

  return (
    <Panel
      id="scalea"
      eyebrow={place.eyebrow}
      title={place.title}
      preview={
        <div className="grid gap-8 md:grid-cols-12 md:items-start md:gap-x-10">
          <div className="max-w-[52ch] space-y-5 text-ink-2 md:col-span-5">
            {lead.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {main && (
            <figure className="md:col-span-7">
              <Picture src={main.src} alt={main.alt} sizes="(min-width: 768px) 52vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well" className="w-full" />
              <figcaption className="mt-3 text-small text-muted">{main.caption}</figcaption>
            </figure>
          )}
        </div>
      }
    >
      <div className="grid gap-8 md:grid-cols-12 md:gap-x-10">
        <div className="max-w-[60ch] space-y-5 text-ink-2 md:col-span-6">
          {more.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        {secondary && (
          <figure className="md:col-span-5 md:col-start-8">
            <Picture src={secondary.src} alt={secondary.alt} sizes="(min-width: 768px) 38vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well" className="w-full" />
            <figcaption className="mt-3 text-small text-muted">{secondary.caption}</figcaption>
          </figure>
        )}
      </div>
    </Panel>
  )
}
