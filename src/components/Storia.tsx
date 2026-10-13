import { useContent } from '../lib/i18n'
import type { StoriaChapter } from '../data/types'
import Picture from './Picture'
import Panel from './Panel'
import { dims } from '../lib/imageMeta'

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

/** Archive poster beside the 1951 railway assignment; "Scopri la storia" opens every chapter. */
export default function Storia() {
  const { storia } = useContent()
  const { image } = storia
  const size = dims(image.src)

  return (
    <Panel
      id="storia"
      eyebrow={storia.eyebrow}
      title={storia.title}
      moreLabel={storia.more}
      preview={({ header, toggle }) => (
        <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center md:gap-x-16 lg:gap-x-24">
          {/* Portrait archive poster shown whole; capped near its 533px native width so it stays sharp. */}
          <figure className="mx-auto w-full max-w-[460px]">
            <Picture
              src={image.src}
              alt={image.alt}
              width={size?.w}
              height={size?.h}
              sizes="(min-width: 768px) 460px, 100vw"
              pictureClassName="block overflow-hidden rounded-[1.25rem] bg-well"
              className="h-auto w-full"
            />
            {image.caption && <figcaption className="mt-3 text-small text-muted">{image.caption}</figcaption>}
          </figure>
          <div>
            {header}
            <div className="mt-6 max-w-[40ch] space-y-4 font-serif text-[clamp(1.25rem,1.8vw,1.5rem)] leading-[1.45] text-ink-2">
              <p>{storia.intro}</p>
              <p>{storia.introMore}</p>
            </div>
            {toggle && <div className="mt-8">{toggle}</div>}
          </div>
        </div>
      )}
    >
      {storia.chapters.map((chapter, i) => (
        <Chapter key={chapter.title} chapter={chapter} index={i} />
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
