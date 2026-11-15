import { t, useContent } from '../lib/i18n'
import { Triquetra } from './Triquetra'

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
                <Triquetra className="h-[22px] w-[22px]" />
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
