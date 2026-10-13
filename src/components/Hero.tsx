import { useContent } from '../lib/i18n'
import { useReveal } from '../lib/useReveal'
import Picture from './Picture'
import { useShop } from '../lib/shop'

export default function Hero() {
  const { site } = useContent()
  const textRef = useReveal<HTMLDivElement>()
  const { localizedCatalog: catalog } = useShop()

  return (
    <section id="home" aria-labelledby="hero-title" className="container-site pt-6 md:pt-10">
      <div className="grid items-center gap-8 md:grid-cols-12 md:gap-10">
        {/* The watch photo leads into the collection. */}
        <a
          href="#orologi"
          aria-label={site.cta.collection}
          className="group flex justify-center rounded-[1.25rem] focus-visible:outline-offset-4 md:order-2 md:col-span-7"
        >
          <Picture
            src={catalog.hero.src}
            alt={catalog.hero.alt}
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 768px) 58vw, calc(100vw - 2 * clamp(1.25rem, 4vw, 4rem))"
            pictureClassName="block"
            className="h-auto max-h-[56vh] w-auto max-w-full object-contain transition-transform duration-700 ease-out-quint group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </a>
        <div ref={textRef} className="reveal md:order-1 md:col-span-5">
          <h1 id="hero-title" className="text-display text-ink">
            {site.name}
          </h1>
          <p className="mt-3 text-small uppercase tracking-[0.32em] text-muted">{site.hero.motto}</p>
          <span aria-hidden="true" className="mt-6 block h-px w-10 bg-ink" />
          <p className="mt-6 font-serif text-h3 text-ink">{site.hero.lead}</p>
          <p className="mt-4 max-w-[44ch] text-ink-2">{site.hero.text}</p>
          <a href="#orologi" className="btn mt-8 w-full gap-3 rounded-full bg-ink text-bg hover:bg-transparent hover:text-ink sm:w-auto">
            {site.cta.collection}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
