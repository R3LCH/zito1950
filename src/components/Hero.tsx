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
        {/* Intrinsic width/height come from the image manifest via Picture; w-auto keeps it at natural size. */}
        <Picture
          src={catalog.hero.src}
          alt={catalog.hero.alt}
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 768px) 58vw, calc(100vw - 2 * clamp(1.25rem, 4vw, 4rem))"
          pictureClassName="flex justify-center md:order-2 md:col-span-7"
          className="h-auto max-h-[56vh] w-auto max-w-full object-contain"
        />
        <div ref={textRef} className="reveal md:order-1 md:col-span-5">
          <p className="eyebrow">{site.name}</p>
          <h1 id="hero-title" className="mt-4 text-display text-ink">
            {site.tagline}
          </h1>
          <p className="mt-5 max-w-[44ch] text-ink-2">{site.description}</p>
          <a href="#orologi" className="btn mt-8 w-full rounded-full bg-ink text-bg hover:bg-transparent hover:text-ink sm:w-auto">
            {site.cta.collection}
          </a>
        </div>
      </div>
    </section>
  )
}
