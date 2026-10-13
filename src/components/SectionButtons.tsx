import { t, useContent } from '../lib/i18n'
import type { SectionIcon } from '../data/types'

/** Line icons drawn on the jump buttons (24px grid, 1.5 stroke). */
const ICONS: Record<SectionIcon, string> = {
  storia: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  orologi: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM9 7.5L10 3h4l1 4.5M9 16.5l1 4.5h4l1-4.5M12 10v2l1.5 1',
  limited: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z',
  officina: 'M10 4a6 6 0 1 0 0 12a6 6 0 1 0 0-12zM14.5 14.5L20 20',
  luogo: 'M12 5a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM3 16c2 0 2-1.5 4.5-1.5S10 16 12 16s2-1.5 4.5-1.5S19 16 21 16M3 20c2 0 2-1.5 4.5-1.5S10 20 12 20s2-1.5 4.5-1.5S19 20 21 20',
  profumi: 'M9.5 3h5v3h-5zM8 7h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
  social: 'M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4zM12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM16.8 7.2h.01',
  contatti: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
}

/** Rounded jump buttons under the hero: one per section of the page. */
export default function SectionButtons() {
  const { site } = useContent()
  return (
    <nav aria-label={t('Sezioni del sito')}>
      <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {site.sections.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              className="group flex min-h-16 items-center gap-3 rounded-full border border-line bg-bg py-2 pl-2 pr-4 transition-colors duration-200 hover:border-ink"
            >
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors duration-200 group-hover:border-ink group-hover:bg-ink group-hover:text-bg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICONS[s.icon]} />
                </svg>
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-small font-medium text-ink">{s.label}</span>
                <span className="mt-0.5 text-xs text-muted">{s.hint}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
