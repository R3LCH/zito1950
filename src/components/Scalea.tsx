import { useContent } from '../lib/i18n'
import Picture from './Picture'
import Panel from './Panel'

/** The town: all text beside the village photo, the period photo under the text. */
export default function Scalea() {
  const { storia } = useContent()
  const { place } = storia
  const [main, secondary] = place.images

  return (
    <Panel
      id="scalea"
      eyebrow={place.eyebrow}
      title={place.title}
      preview={
        <div className="grid gap-8 md:grid-cols-12 md:gap-x-10">
          <div className="md:col-span-5">
            <div className="max-w-[52ch] space-y-5 text-ink-2">
              {place.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {secondary && (
              <figure className="mt-10">
                <Picture src={secondary.src} alt={secondary.alt} sizes="(min-width: 768px) 36vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well" className="w-full" />
                <figcaption className="mt-3 text-small text-muted">{secondary.caption}</figcaption>
              </figure>
            )}
          </div>
          {main && (
            <figure className="md:col-span-6 md:col-start-7">
              <Picture src={main.src} alt={main.alt} sizes="(min-width: 768px) 46vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well" className="w-full" />
              <figcaption className="mt-3 text-small text-muted">{main.caption}</figcaption>
            </figure>
          )}
        </div>
      }
    />
  )
}
