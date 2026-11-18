import type { Signature, TextBlock } from '../data/types'

/** Expanded body shared by Officina, Territorio and Perché: headed blocks, titled points, closing signature. */
export default function SectionText({ blocks, closing }: { blocks: TextBlock[]; closing: Signature }) {
  return (
    <div className="max-w-[60ch] text-ink-2">
      {blocks.map((block, i) => (
        <div key={block.heading ?? i} className={i ? 'mt-10' : undefined}>
          {block.heading && <h3 className="mb-4 font-serif text-h3 text-balance text-ink">{block.heading}</h3>}
          {block.paragraphs.length > 0 && (
            <div className="space-y-5">
              {block.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          )}
          {block.items && (
            <dl className={`border-t border-line${block.paragraphs.length ? ' mt-6' : ''}`}>
              {block.items.map((item) => (
                <div key={item.title} className="border-b border-line py-5">
                  <dt className="font-sans text-eyebrow font-medium uppercase tracking-[0.18em] text-ink">{item.title}</dt>
                  <dd className="mt-2">{item.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
      <div className="mt-12">
        <p className="font-sans text-eyebrow font-medium uppercase tracking-[0.18em] text-ink-2">{closing.title}</p>
        <p className="mt-2 font-serif text-h3 text-balance text-ink">{closing.text}</p>
      </div>
    </div>
  )
}
