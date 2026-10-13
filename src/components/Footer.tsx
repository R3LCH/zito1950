import { t, useContent } from '../lib/i18n'
import { asset } from '../lib/asset'

/** Line icons (24px grid, 1.5 stroke), same drawing style as SectionButtons. */
const ICONS = {
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: <path d="M15 3.5h-2.2A3.3 3.3 0 0 0 9.5 6.8V10H7v3h2.5v7.5h3V13H15l.5-3h-3V7.3c0-.5.3-.8.8-.8H15z" />,
}

const linkClass = 'inline-flex min-h-11 items-center text-small text-ink-2 transition-colors duration-200 hover:text-ink'

export default function Footer() {
  const { contatti, site } = useContent()
  const year = new Date().getFullYear()

  const columns = [
    {
      title: t('Il marchio'),
      links: [
        { href: '#storia', label: t('La nostra storia') },
        { href: '#officina', label: t('Il laboratorio') },
        { href: '#territorio', label: t('La Calabria') },
        { href: '#profumi', label: t('I profumi') },
      ],
    },
    {
      title: t('Assistenza'),
      links: [
        { href: '#orologi', label: site.panel.fullCatalog },
        { href: '#contatti', label: t('Contatti') },
      ],
    },
  ]

  const social = [
    { key: 'instagram' as const, href: contatti.instagram, label: contatti.labels.instagram },
    { key: 'facebook' as const, href: contatti.facebook, label: contatti.labels.facebook },
  ]

  return (
    <footer className="border-t border-line bg-bg">
      <div className="container-site grid gap-10 py-[clamp(3rem,6vw,5rem)] md:grid-cols-12 md:gap-x-10">
        <div className="md:col-span-5">
          <a href="#home" className="inline-flex min-h-11 items-center">
            <img src={asset('logo.svg')} alt={site.labels.home} width={341} height={100} className="h-12 w-auto" />
          </a>
          <p className="mt-2 font-serif text-small uppercase tracking-[0.2em] text-ink-2">{site.hero.motto}</p>
        </div>

        <nav aria-label={site.labels.footerNav} className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:col-span-7">
          {columns.map((col) => (
            <div key={col.title}>
              <p className="eyebrow">{col.title}</p>
              <ul className="mt-2 flex flex-col">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className={linkClass}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="eyebrow">{contatti.labels.social}</p>
            <ul className="mt-2 -ml-3 flex items-center">
              {social.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors duration-200 hover:text-ink"
                  >
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {ICONS[s.key]}
                    </svg>
                    <span className="sr-only">
                      {s.label} {contatti.labels.newTab}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      <div className="container-site">
        <div className="flex flex-col gap-2 border-t border-line py-6 text-small text-muted md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
            <p>{site.footer.copyright.replace('©', `© ${year}`)}</p>
            <p>
              {contatti.company} · {contatti.address}, {contatti.city}
            </p>
          </div>
          <p>{t('Design italiano · Calabria · Dal 1950')}</p>
        </div>
      </div>
    </footer>
  )
}
