import { useContent } from '../lib/i18n'
import Picture from './Picture'
import Panel from './Panel'

/** The owner at the workbench; the craft notes on movements and materials open below. */
export default function Officina() {
  const { officina, orologi } = useContent()
  const { image } = officina

  return (
    <Panel
      id="officina"
      eyebrow={officina.eyebrow}
      title={officina.title}
      preview={
        <div className="grid gap-8 md:grid-cols-12 md:items-center md:gap-x-10">
          <figure className="md:col-span-7">
            <Picture src={image.src} alt={image.alt} sizes="(min-width: 768px) 52vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well" className="w-full" />
            <figcaption className="mt-3 text-small text-muted">{image.caption}</figcaption>
          </figure>
          <div className="max-w-[52ch] space-y-5 text-ink-2 md:col-span-5">
            {officina.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      }
    >
      <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
        {orologi.pillars.map((p) => (
          <li key={p.title} className="border-t border-line pb-8 pt-6">
            <h3 className="font-serif text-h3">{p.title}</h3>
            <p className="mt-3 text-small text-ink-2">{p.text}</p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
