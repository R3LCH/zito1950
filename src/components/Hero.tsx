import { useContent } from '../lib/i18n'
import { useReveal } from '../lib/useReveal'
import Picture from './Picture'
import { useShop } from '../lib/shop'

export default function Hero() {
  const { site } = useContent()
  const textRef = useReveal<HTMLDivElement>()
  const { localizedCatalog: catalog, loaded } = useShop()

  return (
    <section id="home" aria-labelledby="hero-title" className="container-site pt-6 md:pt-10">
      <div className="grid items-center gap-8 md:grid-cols-12 md:gap-10">
        {/* The watch photo leads into the collection. */}
        <a
          href="#orologi"
          aria-label={site.cta.collection}
          className={`group flex items-center justify-center rounded-[2rem] focus-visible:outline-offset-4 md:order-2 md:col-span-7 md:min-h-[min(56vh,32rem)] ${loaded ? '' : 'min-h-56'}`}
        >
          {/* The owner's photo comes from the server; until it arrives the slot stays empty, so the built-in photo never flashes. */}
          {loaded && (
            <Picture
              src={catalog.hero.src}
              alt={catalog.hero.alt}
              loading="eager"
              fetchPriority="high"
              sizes="(min-width: 768px) 58vw, calc(100vw - 2 * clamp(1.25rem, 4vw, 4rem))"
              pictureClassName="block overflow-hidden rounded-[2rem]"
              className="h-auto max-h-[56vh] w-auto max-w-full object-contain transition-transform duration-700 ease-out-quint group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          )}
        </a>
        <div ref={textRef} className="reveal md:order-1 md:col-span-5">
          <h1 id="hero-title" className="font-brand text-display font-normal tracking-[0.02em] text-ink">
            {/* At display size a full-height ® reads heavy; set it as a small superscript. */}
            {site.name.split('®').map((part, i) => (i ? [<sup key={i} className="ml-[0.04em] align-super text-[0.32em] font-normal">®</sup>, part] : part))}
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
