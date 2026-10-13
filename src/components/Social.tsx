import { useContent, t } from '../lib/i18n'
import { ContactLink } from './Contatti'
import Panel from './Panel'

export default function Social() {
  const { contatti, site } = useContent()

  return (
    <Panel
      id="social"
      title={site.cta.social}
      intro={<p>{t('Segui ZITO 1950 su Instagram e Facebook.')}</p>}
      preview={
        <ul className="grid border-t border-line md:grid-cols-2 md:gap-x-10">
          <ContactLink label={contatti.labels.instagram} value={`@${new URL(contatti.instagram).pathname.replaceAll('/', '')}`} href={contatti.instagram} external />
          <ContactLink label={contatti.labels.facebook} value={new URL(contatti.facebook).pathname.replaceAll('/', '')} href={contatti.facebook} external />
        </ul>
      }
    />
  )
}
