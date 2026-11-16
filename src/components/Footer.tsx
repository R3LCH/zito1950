import { t, useContent } from '../lib/i18n'
import { asset, sectionHref } from '../lib/asset'

/** Footer glyphs retain their platform colors, including on hover. */
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

/** WhatsApp: the official glyph, drawn in the brand green rather than the footer's line style. */
const WHATSAPP = (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
)

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
    { key: 'instagram' as const, href: contatti.instagram, label: contatti.labels.instagram, color: 'text-[#E4405F]' },
    { key: 'facebook' as const, href: contatti.facebook, label: contatti.labels.facebook, color: 'text-[#1877F2]' },
    { key: 'whatsapp' as const, href: contatti.whatsapp, label: contatti.labels.whatsapp, color: 'text-[#25D366]' },
  ]

  return (
    <footer className="relative isolate overflow-hidden border-t border-line bg-bg">
      <img
        src={asset('img/footer-triquetra.webp')}
        alt=""
        aria-hidden="true"
        width={1000}
        height={588}
        loading="lazy"
        className="pointer-events-none absolute right-0 top-1/2 w-[min(90%,42rem)] max-w-none -translate-y-1/2 select-none opacity-[0.04]"
      />
      <div className="container-site relative grid gap-10 py-[clamp(3rem,6vw,5rem)] md:grid-cols-12 md:gap-x-10">
        <div className="md:col-span-5">
          <a href={sectionHref('#home')} className="inline-flex min-h-11 items-center">
            <img src={asset('logo.svg')} alt={site.labels.home} width={355} height={100} className="h-12 w-auto" />
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
                    <a href={sectionHref(link.href)} className={linkClass}>
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
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${s.color}`}
                  >
                    {s.key === 'whatsapp' ? WHATSAPP : (
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill={s.key === 'facebook' ? 'currentColor' : 'none'} stroke={s.key === 'facebook' ? 'none' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        {ICONS[s.key]}
                      </svg>
                    )}
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

      <div className="container-site relative">
        <div className="flex flex-col gap-2 border-t border-line py-6 text-small text-muted md:flex-row md:items-center md:justify-between md:gap-6">
          <p>{site.footer.copyright.replace('©', `© ${year}`)}</p>
          <p>{t('Design italiano · Calabria · Dal 1950')}</p>
        </div>
      </div>
    </footer>
  )
}
