import { useContent } from '../lib/i18n'
import { asset } from '../lib/asset'

export default function Footer() {
  const { contatti, site } = useContent()
  const year = new Date().getFullYear()
  const social = [
    { href: contatti.instagram, label: contatti.labels.instagram },
    { href: contatti.facebook, label: contatti.labels.facebook },
  ]

  return (
    <footer className="border-t border-line bg-bg">
      <div className="container-site grid gap-10 py-[clamp(3rem,6vw,5rem)] md:grid-cols-12 md:gap-x-10">
        <div className="md:col-span-4">
          <a href="#home" className="inline-flex min-h-11 items-center">
            <img src={asset('logo-mark.svg')} alt={site.labels.home} width={100} height={100} className="h-12 w-12" />
          </a>
          <p className="mt-5 max-w-[36ch] text-small text-ink-2">{site.tagline}</p>
        </div>

        <nav aria-label={site.labels.footerNav} className="md:col-span-4">
          <ul className="flex flex-col">
            {site.nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="inline-flex min-h-11 items-center text-small font-medium text-ink-2 hover:text-ink">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-4">
          <p className="text-small font-medium text-ink">{contatti.labels.social}</p>
          <ul className="mt-2 flex flex-col">
            {social.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-small font-medium text-ink-2 hover:text-ink"
                >
                  {s.label}
                  <span className="sr-only"> {contatti.labels.newTab}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container-site">
        <div className="flex flex-col gap-2 border-t border-line py-6 text-small text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{site.footer.copyright.replace('©', `© ${year}`)}</p>
          <p>
            {contatti.company} · {contatti.address}, {contatti.city}
          </p>
        </div>
      </div>
    </footer>
  )
}
