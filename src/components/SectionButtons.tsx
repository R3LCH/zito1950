import { t, useContent } from '../lib/i18n'
import type { SectionIcon } from '../data/types'

/** Line icons on the three links (24px grid, 1.5 stroke): shield, star, cut stone. */
const ICONS: Record<SectionIcon, string> = {
  storia: 'M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z',
  limited: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z',
  perche: 'M7 4h10l4 5-9 11L3 9zM3 9h18M10 4L8.5 9 12 20M14 4l1.5 5L12 20',
}

/** The three links under the hero: story, limited collection, why ZITO1950. */
export default function SectionButtons() {
  const { site } = useContent()
  return (
    <nav aria-label={t('Sezioni del sito')} className="pb-10 md:pb-14">
      <ul className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {site.sections.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              className="group flex h-full flex-col items-center rounded-[1.25rem] px-4 py-6 text-center sm:py-4"
            >
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-ink transition-colors duration-200 group-hover:border-ink group-hover:bg-ink group-hover:text-bg">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICONS[s.icon]} />
                </svg>
              </span>
              <span className="mt-4 font-serif text-[1.125rem] uppercase tracking-[0.08em] text-ink underline decoration-transparent underline-offset-[0.3em] transition-[text-decoration-color] duration-200 group-hover:decoration-current">
                {s.label}
              </span>
              <span className="mt-1.5 max-w-[28ch] text-small text-muted">{s.hint}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
