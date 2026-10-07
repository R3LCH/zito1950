import { storia } from '../data/content'
import type { StoriaChapter } from '../data/types'
import { useReveal } from '../lib/useReveal'
import Picture from './Picture'

function Chapter({ chapter, index }: { chapter: StoriaChapter; index: number }) {
  const ref = useReveal<HTMLElement>()
  const titleId = `storia-capitolo-${index + 1}`
  const { image } = chapter
  // Image on the left for even chapters, on the right for odd ones (desktop only).
  const flip = index % 2 === 1

  const text = (
    <div
      className={
        image
          ? `md:col-span-6 md:row-start-1 ${flip ? 'md:col-start-1' : 'md:col-start-7'} md:self-center`
          : 'md:col-span-8 md:col-start-3'
      }
    >
      <p className="text-small font-medium tracking-[0.04em] text-muted">{chapter.eyebrow}</p>
      <h3 id={titleId} className="mt-3 text-h2 text-ink">
        {chapter.title}
      </h3>
      <div className="mt-6 max-w-[60ch] space-y-5 text-ink-2 md:mt-8">
        {chapter.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </div>
  )

  return (
    <article
      ref={ref}
      aria-labelledby={titleId}
      className="reveal grid gap-8 border-t border-line py-[clamp(3rem,7vw,6.5rem)] md:grid-cols-12 md:gap-x-10"
    >
      {image && (
        <figure
          className={`md:col-span-5 md:row-start-1 ${flip ? 'md:col-start-8' : 'md:col-start-1'}`}
        >
          <Picture
            src={image.src}
            alt={image.alt}
            sizes="(min-width: 768px) 40vw, 100vw"
            pictureClassName="block bg-well"
            className="w-full"
          />
          <figcaption className="mt-3 text-small text-muted">{image.caption}</figcaption>
        </figure>
      )}
      {text}
    </article>
  )
}

export default function Storia() {
  const introRef = useReveal<HTMLDivElement>()
  const quoteRef = useReveal<HTMLElement>()

  return (
    <section id="storia" aria-labelledby="storia-title" className="py-[var(--section-y)]">
      <div className="container-site">
        <div ref={introRef} className="reveal grid gap-6 pb-[clamp(3rem,6vw,5rem)] md:grid-cols-12 md:gap-x-10">
          <p className="eyebrow md:col-span-12">{storia.eyebrow}</p>
          <h2 id="storia-title" className="text-h2 text-ink md:col-span-7">
            {storia.title}
          </h2>
          <p className="max-w-[48ch] font-serif text-[1.375rem] italic leading-[1.5] text-ink-2 md:col-span-4 md:col-start-9 md:self-end">
            {storia.intro}
          </p>
        </div>

        {storia.chapters.map((chapter, i) => (
          <Chapter key={chapter.title} chapter={chapter} index={i} />
        ))}

        <figure
          ref={quoteRef}
          className="reveal border-y border-line py-[clamp(3.5rem,8vw,7rem)] md:grid md:grid-cols-12 md:gap-x-10"
        >
          <blockquote className="md:col-span-10 md:col-start-2">
            <p className="font-serif text-[clamp(1.625rem,3vw,2.5rem)] italic leading-[1.3] text-ink">
              «{storia.closing.text}»
            </p>
          </blockquote>
          {storia.closing.author && (
            <figcaption className="mt-8 text-small font-medium tracking-[0.12em] text-muted md:col-span-10 md:col-start-2">
              — {storia.closing.author}
            </figcaption>
          )}
        </figure>
      </div>
    </section>
  )
}
