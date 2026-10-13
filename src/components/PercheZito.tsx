import { useContent } from '../lib/i18n'
import Panel from './Panel'

/** Why choose ZITO 1950: the serif lead beside the reasons, closed by the brand line. */
export default function PercheZito() {
  const { perche } = useContent()

  return (
    <Panel
      id="perche-zito"
      title={perche.title}
      preview={
        <div className="grid gap-8 md:grid-cols-12 md:gap-x-10">
          <p className="font-serif text-[clamp(1.5rem,2.6vw,2.25rem)] italic leading-[1.3] text-ink md:col-span-5">{perche.lead}</p>
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
