import { useContent } from '../lib/i18n'
import Picture from './Picture'
import Panel from './Panel'
import SectionText from './SectionText'

/** Assistance: the owner at the workbench beside the opening text; the button opens the services and how to ask for them. */
export default function Officina() {
  const { officina } = useContent()
  const { image } = officina

  return (
    <Panel
      id="officina"
      eyebrow={officina.eyebrow}
      title={officina.title}
      moreLabel={officina.more}
      preview={({ header, toggle }) => (
        <div className="grid gap-8 md:grid-cols-12 md:items-center md:gap-x-12">
          <figure className="md:col-span-7">
            <Picture src={image.src} alt={image.alt} sizes="(min-width: 768px) 52vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well" className="w-full" />
            <figcaption className="mt-3 text-small text-muted">{image.caption}</figcaption>
          </figure>
          <div className="md:col-span-5">
            {header}
            <div className="mt-6 max-w-[52ch] space-y-5 text-ink-2">
              {officina.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {toggle && <div className="mt-8">{toggle}</div>}
          </div>
        </div>
      )}
    >
      <SectionText blocks={officina.blocks} closing={officina.closing} />
    </Panel>
  )
}
