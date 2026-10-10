import { useContent } from '../lib/i18n'
import { useReveal } from '../lib/useReveal'
import Picture from './Picture'
import { useShop } from '../lib/shop'

export default function Hero() {
  const { site } = useContent()
  const textRef = useReveal<HTMLDivElement>()
  const { localizedCatalog: catalog } = useShop()
  // Mobile: stacked full-width; from sm up a single row of three.
  const button = 'btn w-full sm:w-auto'

  return (
    <section id="home" aria-labelledby="hero-title" className="pb-[var(--section-y)] pt-6 md:pt-10">
      <div className="container-site">
        {/* Intrinsic width/height come from the image manifest via Picture; w-auto keeps it at natural size. */}
        <Picture
          src={catalog.hero.src}
          alt={catalog.hero.alt}
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1368px) 1240px, calc(100vw - 2 * clamp(1.25rem, 4vw, 4rem))"
          pictureClassName="flex justify-center"
          className="h-auto max-h-[70vh] w-auto max-w-full object-contain"
        />

        <div
          ref={textRef}
          className="reveal mt-10 grid gap-8 border-t border-line pt-10 md:mt-16 md:grid-cols-12 md:items-end md:gap-x-10 md:pt-14"
        >
          <div className="md:col-span-7">
            <p className="eyebrow">{site.name}</p>
            <h1 id="hero-title" className="mt-4 text-display text-ink">
              {site.tagline}
            </h1>
          </div>
          <p className="max-w-[44ch] text-ink-2 md:col-span-5 md:pb-2">{site.description}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4 md:col-span-12">
            <a href="#storia" className={`${button} bg-ink text-bg hover:bg-transparent hover:text-ink`}>
              {site.cta.story}
            </a>
            <a href="#edizioni-limitate" className={button}>
              {site.cta.limited}
            </a>
            <a href="#social" className={button}>
              {site.cta.social}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
