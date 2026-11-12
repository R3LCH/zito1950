import { useEffect, useState } from 'react'
import { reviews } from '../data/reviews'
import { t, useContent } from '../lib/i18n'
import Panel from './Panel'
import { CardStack } from './ui/card-stack'

const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=ZITO1950%20Via%20Michele%20Bianchi%2023%20Scalea'

/** Shop reviews after the contacts: short text beside a stack of cards sent away by click or swipe. */
export default function Reviews() {
  const { recensioni, contatti } = useContent()
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setDesktop(pointer.matches)
    update()
    pointer.addEventListener('change', update)
    return () => pointer.removeEventListener('change', update)
  }, [])

  const items = reviews.map(review => ({
    id: review.author,
    name: review.author,
    designation: t('5 stelle su 5'),
    content: <blockquote>{t(review.text)}</blockquote>,
  }))

  return (
    <Panel
      id="recensioni"
      eyebrow={recensioni.eyebrow}
      title={recensioni.title}
      preview={({ header }) => (
        <div className="grid gap-10 md:grid-cols-12 md:items-center md:gap-x-10 lg:gap-x-16">
          <div className="max-w-[34ch] md:col-span-5">
     {header}
     <div className="mt-6 space-y-4 text-ink-2">
{recensioni.paragraphs.map(p => <p key={p}>{p}</p>)}
     </div>
     <a className="link-arrow mt-6 min-h-11" href={mapsUrl} target="_blank" rel="noopener noreferrer"><span>{t('Leggi tutte')}<span className="sr-only"> {contatti.labels.newTab}</span></span></a>
   </div>
          <div className="mx-auto w-full max-w-[32rem] md:col-span-7 md:col-start-6">
            <CardStack items={items} label={recensioni.title} roleLabel={t('carosello')} itemLabel={t('recensione')} />
     <p className="mt-5 flex items-center justify-center gap-2 text-small text-muted" aria-hidden="true">
       {t(desktop ? 'Clicca' : 'Scorri')}
       <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
     </p>
   </div>
        </div>
      )}
    />
  )
}
