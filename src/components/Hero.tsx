import { site } from '../data/content'
import { useReveal } from '../lib/useReveal'
import Picture from './Picture'

export default function Hero() {
  const textRef = useReveal<HTMLDivElement>()

  return (
    <section id="home" aria-labelledby="hero-title" className="pb-[var(--section-y)] pt-6 md:pt-10">
      <div className="container-site">
        {/* Wide product photo (1600×617). On phones it is cropped to 16:10 around the two watches. */}
        <Picture
          src={site.hero.image.src}
          alt={site.hero.image.alt}
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1368px) 1240px, calc(100vw - 2 * clamp(1.25rem, 4vw, 4rem))"
          width={1600}
          height={617}
          pictureClassName="block"
          className="aspect-[16/10] w-full object-cover object-[42%_50%] sm:aspect-[1600/617] sm:object-center"
        />

        <div
          ref={textRef}
          className="reveal mt-10 grid gap-8 md:mt-16 md:grid-cols-12 md:items-end md:gap-x-10"
        >
          <div className="md:col-span-7">
            <p className="eyebrow">{site.name}</p>
            <h1 id="hero-title" className="mt-4 text-display text-ink">
              {site.tagline}
            </h1>
          </div>
          <div className="md:col-span-5 md:pb-2">
            <p className="max-w-[44ch] text-ink-2">{site.description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
              <a href="#orologi" className="btn">
                {site.cta.collection}
              </a>
              <a href="#storia" className="link-arrow min-h-11">
                <span>{site.cta.story}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
