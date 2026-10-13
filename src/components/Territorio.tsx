import { useContent } from '../lib/i18n'
import Picture from './Picture'
import Panel from './Panel'

/** «Scopri il territorio»: text on the left, the sea photo held in view beside it on desktop. */
export default function Territorio() {
  const { territorio } = useContent()
  const { image } = territorio

  return (
    <Panel
      id="territorio"
      eyebrow={territorio.eyebrow}
      title={territorio.title}
      preview={
        <div className="grid gap-8 md:grid-cols-12 md:gap-x-10">
          <figure className="md:sticky md:top-[calc(var(--header-h)+1.5rem)] md:col-span-7 md:col-start-6 md:row-start-1 md:self-start">
            <Picture src={image.src} alt={image.alt} sizes="(min-width: 768px) 52vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well" className="w-full" />
          </figure>
          <div className="max-w-[60ch] space-y-5 text-ink-2 md:col-span-5 md:col-start-1 md:row-start-1">
            {territorio.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="pt-3 font-serif text-h3 text-ink">{territorio.closing}</p>
          </div>
        </div>
      }
    />
  )
}
