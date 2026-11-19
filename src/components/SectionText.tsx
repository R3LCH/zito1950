import type { Signature, TextBlock } from '../data/types'

// Desktop rows share the 12-column grid: heading (or the signature line) on the left third, text on the right.
const row = 'grid gap-y-4 md:grid-cols-12 md:gap-x-10'
const left = 'md:col-span-4'
const right = 'md:col-span-8 md:col-start-5'
// Short point lists fit one row (Assistenza's five services); longer ones wrap in rows of four.
const itemCols: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }

/**
 * Expanded body shared by Officina, Territorio and Perché: headed text rows, titled points as a hairline grid, closing signature.
 * Paragraphs without a heading start where the section photo starts (`plain`, default the left edge).
 */
export default function SectionText({ blocks, closing, plain = 'md:col-span-8 md:col-start-1' }: { blocks: TextBlock[]; closing: Signature; plain?: string }) {
  return (
    <div className="space-y-12 text-ink-2 md:space-y-16">
      {blocks.map((block, i) => (
        <div key={block.heading ?? i} className="space-y-8">
          {(block.heading || block.paragraphs.length > 0) && (
            <div className={row}>
              {block.heading && <h3 className={`${left} font-serif text-h3 text-balance text-ink`}>{block.heading}</h3>}
              {block.paragraphs.length > 0 && (
                // Two text columns on wide screens keep long blocks short.
                <div className={`${block.heading ? right : plain} ${block.paragraphs.length > 2 ? 'lg:columns-2 lg:gap-x-10' : 'max-w-[60ch]'} *:mb-5 *:break-inside-avoid *:last:mb-0`}>
                  {block.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          {block.items && (
            <ul className={`grid gap-x-8 sm:grid-cols-2 ${itemCols[block.items.length] ?? 'lg:grid-cols-4'}`}>
              {block.items.map((item) => (
                <li key={item.title} className="border-t border-line pb-6 pt-5">
                  <h4 className="font-serif text-h3 text-balance text-ink">{item.title}</h4>
                  <p className="mt-3 text-small">{item.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <div className={`${row} border-t border-line pt-8 md:items-baseline`}>
        <p className={`${left} font-sans text-eyebrow font-medium uppercase tracking-[0.18em] text-ink-2`}>{closing.title}</p>
        <p className={`${right} font-serif text-h3 text-balance text-ink`}>{closing.text}</p>
      </div>
    </div>
  )
}
