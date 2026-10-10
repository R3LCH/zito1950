import { useReveal } from '../lib/useReveal'
import { useContent, t } from '../lib/i18n'
import { ContactLink } from './Contatti'

export default function Social() {
  const { contatti, site } = useContent()
  const ref = useReveal<HTMLDivElement>()

  return (
    <section id="social" aria-labelledby="social-title" className="border-t border-line py-(--section-y)">
      <div ref={ref} className="reveal container-site grid gap-10 md:grid-cols-12 md:gap-x-10">
        <header className="md:col-span-5">
          <h2 id="social-title" className="text-h2">
            {site.cta.social}
          </h2>
          <p className="mt-4 max-w-[40ch] text-ink-2">{t('Segui ZITO 1950 su Instagram e Facebook.')}</p>
        </header>
        <ul className="border-t border-line md:col-span-6 md:col-start-7">
          <ContactLink
            label={contatti.labels.instagram}
            value={`@${new URL(contatti.instagram).pathname.replaceAll('/', '')}`}
            href={contatti.instagram}
            external
          />
          <ContactLink
            label={contatti.labels.facebook}
            value={new URL(contatti.facebook).pathname.replaceAll('/', '')}
            href={contatti.facebook}
            external
          />
        </ul>
      </div>
    </section>
  )
}
