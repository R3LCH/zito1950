import { useContent } from '../lib/i18n'
import Picture from './Picture'
import Panel from './Panel'

/** Why choose ZITO1950: the serif lead and the client's photo beside the reasons, closed by the brand line. */
export default function PercheZito() {
  const { perche } = useContent()

  return (
    <Panel
      id="perche-zito"
      title={perche.title}
      preview={
        <div className="grid gap-8 md:grid-cols-12 md:gap-x-10">
          <div className="space-y-8 md:col-span-5">
            <p className="font-serif text-[clamp(1.5rem,2.6vw,2.25rem)] italic leading-[1.3] text-ink">{perche.lead}</p>
            <Picture
              src={perche.image.src}
              alt={perche.image.alt}
              sizes="(min-width: 768px) 40vw, 100vw"
              pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well"
              className="h-auto w-full"
            />
          </div>
          <div className="max-w-[60ch] space-y-5 text-ink-2 md:col-span-6 md:col-start-7">
            {perche.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="pt-3 font-serif text-h3 text-ink">{perche.closing}</p>
          </div>
        </div>
      }
    />
  )
}
