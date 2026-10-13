import { useContent } from '../lib/i18n'
import type { StoriaChapter } from '../data/types'
import Picture from './Picture'
import Panel from './Panel'

function Chapter({ chapter, index }: { chapter: StoriaChapter; index: number }) {
  const titleId = `storia-capitolo-${index + 1}`
  const { image } = chapter
  // Chapter 1 (1945) is text-only, so image chapters alternate right, left, right… on desktop.
  const flip = index % 2 === 1

  return (
    <article
      aria-labelledby={titleId}
      className={`grid gap-6 py-[clamp(2rem,5vw,3.5rem)] md:grid-cols-12 md:gap-x-10 ${index ? 'border-t border-line' : 'pt-0'}`}
    >
      {image && (
        <figure className={`md:col-span-5 md:row-start-1 ${flip ? 'md:col-start-8' : 'md:col-start-1'}`}>
          <Picture src={image.src} alt={image.alt} sizes="(min-width: 768px) 36vw, 100vw" pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well" className="w-full" />
          <figcaption className="mt-3 text-small text-muted">{image.caption}</figcaption>
        </figure>
      )}
      <div
        className={
          image
            ? `md:col-span-6 md:row-start-1 ${flip ? 'md:col-start-1' : 'md:col-start-7'} md:self-center`
            : 'md:col-span-9'
        }
      >
        <p className="text-small font-medium tracking-[0.04em] text-muted">{chapter.eyebrow}</p>
        <h3 id={titleId} className="mt-3 text-h3 text-ink md:text-[2rem] md:leading-[1.2]">
          {chapter.title}
        </h3>
        <div className="mt-5 max-w-[60ch] space-y-5 text-ink-2">
          {chapter.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
    </article>
  )
}

export default function Storia() {
  const { storia } = useContent()
  const [first, ...rest] = storia.chapters

  return (
    <Panel
      id="storia"
      eyebrow={storia.eyebrow}
      title={storia.title}
      intro={<p className="font-serif text-[1.25rem] italic leading-[1.5]">{storia.intro}</p>}
      preview={first && <Chapter chapter={first} index={0} />}
    >
      {rest.map((chapter, i) => (
        <Chapter key={chapter.title} chapter={chapter} index={i + 1} />
      ))}
      <figure className="border-t border-line pt-[clamp(2rem,5vw,3.5rem)]">
        <blockquote>
          <p className="font-serif text-[clamp(1.5rem,2.6vw,2.25rem)] italic leading-[1.3] text-ink">«{storia.closing.text}»</p>
        </blockquote>
        {storia.closing.author && (
          <figcaption className="mt-6 text-small font-medium tracking-[0.12em] text-muted">— {storia.closing.author}</figcaption>
        )}
      </figure>
    </Panel>
  )
}
