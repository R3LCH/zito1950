import { t, useContent } from '../lib/i18n'
import Picture from './Picture'
import Panel from './Panel'
import SectionText from './SectionText'

/** Why choose ZITO1950: the serif lead and the client's photo beside the reasons, closed by the brand line. */
export default function PercheZito() {
  const { perche } = useContent()

  return (
    <Panel
      id="perche-zito"
      title={perche.title}
      moreLabel={t('Cosa ci distingue')}
      preview={({ header, toggle }) => (
        <div className="grid gap-8 md:grid-cols-12 md:items-center md:gap-x-10">
          <div className="md:col-span-6 lg:col-span-7">
            <Picture
              src={perche.image.src}
              alt={perche.image.alt}
              sizes="(min-width: 1024px) 58vw, (min-width: 768px) 50vw, 100vw"
              pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well"
              className="h-auto w-full"
            />
          </div>
          <div className="md:col-span-6 lg:col-span-5">
            {header}
            <div className="mt-6 max-w-[52ch] space-y-5 text-ink-2">
              <p className="font-serif text-h3 italic leading-[1.3] text-ink">{perche.lead}</p>
              <p>{perche.paragraphs[0]}</p>
            </div>
            {toggle && <div className="mt-8">{toggle}</div>}
          </div>
        </div>
      )}
    >
      <SectionText blocks={perche.blocks} closing={perche.closing} />
    </Panel>
  )
}
