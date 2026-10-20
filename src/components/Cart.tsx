import { useEffect, useRef, useState } from 'react'
import { api, euro, isPersonalized, lineKey, STATIC_PREVIEW, useShop, type CartLine } from '../lib/shop'
import { t } from '../lib/i18n'
import { ENGRAVING_MAX_CHARS, ENGRAVING_MAX_WORDS, engravingWords, type CertificateHolder } from '../data/types'
import { availabilityOf } from '../lib/catalogFilters'
import Picture from './Picture'
import { asset } from '../lib/asset'

const CERTIFICATE_IMAGES = [
  { src: 'img/certificato/carta-fronte.jpg', alt: 'Certificato di proprietà ZITO 1950®, fronte' },
  { src: 'img/certificato/carta-retro.jpg', alt: 'Certificato di proprietà ZITO 1950®, retro' },
]
const BRAND = 'ZITO 1950®'
// Mirrors the server's email check closely enough to keep the button honest; the server stays authoritative.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMPTY_HOLDER: CertificateHolder = { firstName: '', lastName: '', email: '' }
type LineField = keyof CertificateHolder | 'engraving' | 'engravingAccepted'
type LineErrors = Record<LineField, string | null>

/** Both personalization sections are optional; once the buyer starts one, it must be complete. */
function lineErrors(line: CartLine): LineErrors {
  const holder = line.certificate
  const engraving = line.engraving?.trim() ?? ''
  return {
    firstName: holder && !holder.firstName.trim() ? 'Inserisci il nome.' : null,
    lastName: holder && !holder.lastName.trim() ? 'Inserisci il cognome.' : null,
    email: holder && !EMAIL.test(holder.email.trim()) ? 'Inserisci un indirizzo email valido.' : null,
    // Typing stops at the limit; this catches text stored before the limit applied.
    engraving:
      engravingWords(engraving) > ENGRAVING_MAX_WORDS || engraving.length > ENGRAVING_MAX_CHARS
        ? 'Massimo 10 parole: accorcia il testo.'
        : null,
    engravingAccepted: engraving && !line.engravingAccepted ? 'Conferma di aver letto la condizione.' : null,
  }
}

/** Order request lines per the payments API; plain lines of one product are combined. */
function orderItems(cart: CartLine[]) {
  const items: {
    kind: 'model' | 'perfume'
    modelId: string
    variantId: string | null
    quantity: number
    certificate: CertificateHolder | null
    engraving: string | null
    engravingAccepted: boolean
  }[] = []
  for (const line of cart) {
    const kind = line.kind ?? 'model'
    const engraving = line.engraving?.trim() || null
    const certificate = line.certificate
      ? { firstName: line.certificate.firstName.trim(), lastName: line.certificate.lastName.trim(), email: line.certificate.email.trim() }
      : null
    const plain = items.find(
      (item) => !item.certificate && !item.engraving && !certificate && !engraving && item.kind === kind && item.modelId === line.modelId && item.variantId === line.variantId,
    )
    if (plain) plain.quantity = Math.min(10, plain.quantity + line.quantity)
    else items.push({ kind, modelId: line.modelId, variantId: line.variantId, quantity: line.quantity, certificate, engraving, engravingAccepted: !!engraving && !!line.engravingAccepted })
  }
  return items
}

export function BuyButton({
  modelId,
  variant = 0,
  beforeOpen,
}: {
  modelId: string
  variant?: number
  beforeOpen?: () => void
}) {
  const { catalog, add, error } = useShop()
  const model = catalog.models.find((m) => m.id === modelId)
  if (!model || availabilityOf(model) !== 'buy' || error) return null
  return (
    <button type="button"
    className="btn mt-3 w-full"
    onClick={() => {
      beforeOpen?.()
      add(model, variant)
    }}>{t('Acquista')}</button>
  )
}
type Touched = Partial<Record<LineField, boolean>>
/** The two optional sections under one cart line: certificate holder and engraving. */
function Personalization({
  line,
  index,
  disabled,
  touched,
  onTouch,
  onChange,
}: {
  line: CartLine
  index: number
  disabled: boolean
  touched: Touched
  onTouch: (fields: LineField[]) => void
  onChange: (patch: Partial<CartLine>) => void
}) {
  const [certificateOpen, setCertificateOpen] = useState(!!line.certificate)
  const [engravingOpen, setEngravingOpen] = useState(!!line.engraving?.trim())
  const [wordLimit, setWordLimit] = useState(false)
  const errors = lineErrors(line)
  // Sections always open and close on demand; an unfinished one is flagged in its title instead of being held open.
  const certificateShown = certificateOpen
  const engravingShown = engravingOpen
  const certificateIncomplete = !!(errors.firstName || errors.lastName || errors.email)
  const engravingIncomplete = !!(errors.engraving || errors.engravingAccepted)
  const holder = line.certificate ?? EMPTY_HOLDER
  const engraving = line.engraving ?? ''
  const words = engravingWords(engraving)
  const perfume = line.kind === 'perfume'
  const id = `cart-line-${index}`
  const summaryClass = 'flex min-h-11 w-full items-center justify-between gap-4 text-left text-small font-medium'
  const [back, setBack] = useState(false)
  const holderFields = [
    { name: 'firstName', label: 'Nome', autoComplete: 'given-name', type: 'text', maxLength: 80 },
    { name: 'lastName', label: 'Cognome', autoComplete: 'family-name', type: 'text', maxLength: 80 },
    { name: 'email', label: 'Email', autoComplete: 'email', type: 'email', maxLength: 254 },
  ] as const
  const field = ({ name, label, autoComplete, type, maxLength }: (typeof holderFields)[number], className: string) => {
    const error = touched[name] ? errors[name] : null
    const onCard = name !== 'email'
    return (
      <input
        key={name}
        className={className}
        type={type}
        autoComplete={autoComplete}
        required={!!line.certificate}
        maxLength={maxLength}
        // On the card the label is the placeholder; the email keeps its visible label.
        placeholder={onCard ? t(label) : undefined}
        aria-label={onCard ? `${t('Titolare')}: ${t(label)}` : undefined}
        value={holder[name]}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-${name}-error` : undefined}
        onBlur={() => onTouch([name])}
        onChange={(e) => {
          const next = { ...holder, [name]: e.target.value }
          // Emptying every field withdraws the certificate, so the section is optional again.
          onChange({ certificate: next.firstName || next.lastName || next.email ? next : null })
        }}
      />
    )
  }
  const flipButton = (side: 'prev' | 'next') => (
    <button
      type="button"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-200 hover:bg-well hover:text-ink"
      aria-label={back ? t('Mostra il fronte del certificato') : t('Mostra il retro del certificato')}
      onClick={() => setBack(!back)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={side === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  )
  return (
    <div className="mt-4 border-t border-line">
      <div className="border-b border-line">
        <button
          type="button"
          className={summaryClass}
          aria-expanded={certificateShown}
          aria-controls={`${id}-certificate`}
          onClick={() => setCertificateOpen(!certificateShown)}
        >
          <span>
            {t('Certificato della proprietà e garanzia')} <span className="font-normal text-muted">{certificateIncomplete ? t('(da completare)') : t('(facoltativo)')}</span>
          </span>
          <span aria-hidden="true">{certificateShown ? '−' : '+'}</span>
        </button>
        <div id={`${id}-certificate`} hidden={!certificateShown} className="pb-5">
          <p id={`${id}-certificate-help`} className="mt-1 text-small text-muted">
            {perfume
              ? t('Il certificato è intestato a questo nome e viene consegnato insieme al profumo.')
              : t('Il certificato è intestato a questo nome e viene consegnato insieme all’orologio.')}{' '}
            {t('Scrivi nome e cognome direttamente sul certificato, accanto a «Titolare».')}
          </p>
          <fieldset disabled={disabled} className="mt-5" aria-describedby={`${id}-certificate-help`}>
            <legend className="sr-only">{t('Intestatario del certificato')}</legend>
            <div className="flex items-center gap-1 sm:gap-3">
              {flipButton('prev')}
              <div className="certificate-scene min-w-0 flex-1">
                <div className={`certificate-card${back ? ' is-flipped' : ''}`}>
                  <div className="certificate-face" inert={back} aria-hidden={back || undefined}>
                    <Picture src={CERTIFICATE_IMAGES[0].src} alt={t(CERTIFICATE_IMAGES[0].alt)} sizes="(min-width: 640px) 560px, 80vw" pictureClassName="block" className="block h-auto w-full" />
                    {/* Sits on the card's own Titolare panel, measured on the cropped photo. */}
                    <div className="certificate-holder">
                      {holderFields.slice(0, 2).map((f) => field(f, 'certificate-field'))}
                    </div>
                  </div>
                  <div className="certificate-face certificate-back" inert={!back} aria-hidden={!back || undefined}>
                    <Picture src={CERTIFICATE_IMAGES[1].src} alt={t(CERTIFICATE_IMAGES[1].alt)} sizes="(min-width: 640px) 560px, 80vw" pictureClassName="block" className="block h-auto w-full" />
                  </div>
                </div>
              </div>
              {flipButton('next')}
            </div>
            <p className="mt-2 text-center text-eyebrow uppercase tracking-[0.18em] text-muted" aria-live="polite">
              {back ? t('Retro') : t('Fronte')}
            </p>
            {(['firstName', 'lastName'] as const).map((f) =>
              touched[f] && errors[f] ? (
                <p key={f} id={`${id}-${f}-error`} className="mt-2 text-small text-ink">
                  {t(errors[f]!)}
                </p>
              ) : null,
            )}
            <label className="shop-label mt-5">
              {t('Email')}
              {field(holderFields[2], 'shop-input')}
              {touched.email && errors.email && (
                <span id={`${id}-email-error`} className="text-small text-ink">
                  {t(errors.email)}
                </span>
              )}
            </label>
          </fieldset>
          {line.certificate && (
            <button
              type="button"
              className="mt-4 underline text-small"
              disabled={disabled}
              onClick={() => {
                onChange({ certificate: null })
                setCertificateOpen(false)
                setBack(false)
              }}
            >
              {t('Rimuovi certificato')}
            </button>
          )}
        </div>
      </div>
      {/* No bottom border: the cart line's own hairline closes the section. */}
      <div>
        <button
          type="button"
          className={summaryClass}
          aria-expanded={engravingShown}
          aria-controls={`${id}-engraving`}
          onClick={() => setEngravingOpen(!engravingShown)}
        >
          <span>
            {t('Incisione')} <span className="font-normal text-muted">{engravingIncomplete ? t('(da completare)') : t('(facoltativo)')}</span>
          </span>
          <span aria-hidden="true">{engravingShown ? '−' : '+'}</span>
        </button>
        <div id={`${id}-engraving`} hidden={!engravingShown} className="pb-5">
          <label className="shop-label">
            <span id={`${id}-engraving-hint`} className="text-muted">
              {perfume
                ? t('Sul flacone: un nome, una data o una breve frase.')
                : t('Sul retro della cassa: un nome, una data o una breve frase.')}
            </span>
            <textarea
              className="shop-input resize-y"
              rows={2}
              maxLength={ENGRAVING_MAX_CHARS}
              disabled={disabled}
              value={engraving}
              aria-label={t('Testo dell’incisione')}
              aria-invalid={touched.engraving && errors.engraving ? true : undefined}
              aria-describedby={`${id}-engraving-hint ${id}-engraving-count`}
              onBlur={() => onTouch(['engraving'])}
              onChange={(e) => {
                const text = e.target.value
                // Hard stop: a word beyond the limit is not accepted.
                if (engravingWords(text) > ENGRAVING_MAX_WORDS) {
                  setWordLimit(true)
                  return
                }
                setWordLimit(false)
                onChange({ engraving: text.trim() ? text : null, ...(text.trim() ? {} : { engravingAccepted: false }) })
              }}
            />
          </label>
          <p id={`${id}-engraving-count`} className="mt-2 text-small text-muted" aria-live="polite">
            {t('{n}/{max} parole', { n: words, max: ENGRAVING_MAX_WORDS })}
            {wordLimit && <span className="ml-2 text-ink">{t('Hai raggiunto il limite di {max} parole.', { max: ENGRAVING_MAX_WORDS })}</span>}
            {touched.engraving && errors.engraving && <span className="ml-2 text-ink">{t(errors.engraving)}</span>}
          </p>
          {/* The no-return condition is shown as soon as the section opens, before anything is typed. */}
          {engravingShown && (
            <div className="mt-4 border border-ink p-4">
              <p className="text-small font-medium">{t('Un articolo con incisione è personalizzato: non può essere restituito né cambiato.')}</p>
              <label className="mt-3 flex items-start gap-3 text-small">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-ink"
                  required={!!engraving.trim()}
                  disabled={disabled || !engraving.trim()}
                  checked={!!line.engravingAccepted}
                  aria-invalid={touched.engravingAccepted && errors.engravingAccepted ? true : undefined}
                  aria-describedby={touched.engravingAccepted && errors.engravingAccepted ? `${id}-accepted-error` : undefined}
                  onChange={(e) => {
                    onTouch(['engravingAccepted'])
                    onChange({ engravingAccepted: e.target.checked })
                  }}
                />
                {t('Ho letto: l’articolo inciso non è restituibile.')}
              </label>
              {touched.engravingAccepted && errors.engravingAccepted && (
                <p id={`${id}-accepted-error`} className="mt-2 text-small text-ink">
                  {t(errors.engravingAccepted)}
                </p>
              )}
            </div>
          )}
          {engraving && (
            <button
              type="button"
              className="mt-4 underline text-small"
              disabled={disabled}
              onClick={() => {
                onChange({ engraving: null, engravingAccepted: false })
                setWordLimit(false)
                setEngravingOpen(false)
              }}
            >
              {t('Rimuovi incisione')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
/** Phones: a short confirmation under the header after "Acquista", so the buyer can keep browsing. */
function AddedPopup() {
  const { localizedCatalog: catalog, cart, added, setAdded, setCartOpen } = useShop()
  const [top, setTop] = useState(0)
  useEffect(() => {
    if (!added) return
    // Below the sticky header, wherever the preview banner has pushed it.
    setTop(Math.max(0, document.querySelector('header')?.getBoundingClientRect().bottom ?? 0))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAdded(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [added])
  if (!added) return null
  const perfume = added.kind === 'perfume' ? catalog.perfumes.find((p) => p.id === added.modelId) : null
  const model = perfume ? null : catalog.models.find((m) => m.id === added.modelId)
  const variant = added.variantId ? model?.variants?.find((v) => v.id === added.variantId) : null
  const image = perfume?.images[0] ?? variant?.images[0] ?? model?.images[0] ?? null
  const count = cart.reduce((sum, line) => sum + line.quantity, 0)
  return (
    <section
      aria-label={t('Aggiunto al carrello')}
      style={{ top }}
      className="fixed inset-x-0 z-40 border-b border-line bg-bg px-[var(--gutter)] pt-5 pb-6 shadow-[0_12px_32px_rgb(20_20_20/10%)] lg:hidden"
    >
      <div className="flex items-center justify-between gap-4">
        <p role="status" className="flex items-center gap-3 text-small">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          {t('Aggiunto al carrello')}
        </p>
        <button type="button" className="-mr-3 inline-flex h-11 w-11 items-center justify-center text-ink-2 hover:text-ink" aria-label={t('Chiudi')} onClick={() => setAdded(null)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-3 flex items-start gap-4">
        <div className="aspect-[4/5] w-20 shrink-0 overflow-hidden">
          {image && <Picture src={image.src} alt={image.alt} sizes="80px" pictureClassName="block h-full w-full" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="font-serif text-xl leading-snug">{perfume?.name ?? model?.name}</p>
          {variant && <p className="mt-1 text-small text-muted">{variant.label}</p>}
        </div>
      </div>
      <button
        type="button"
        className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink-2 px-6 text-base font-semibold text-bg transition-colors duration-200 hover:bg-ink"
        onClick={() => {
          setAdded(null)
          setCartOpen(true)
        }}
      >
        {t('Vai al carrello ({count})', { count })}
      </button>
      <button type="button" className="mx-auto mt-2 flex min-h-11 items-center px-2 text-small underline underline-offset-4" onClick={() => setAdded(null)}>
        {t('Continua gli acquisti')}
      </button>
    </section>
  )
}
export default function Cart() {
  const { localizedCatalog: catalog, cart, setCart, cartOpen, setCartOpen, setAdded, error: shopError, reload } = useShop()
  const ref = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [paid, setPaid] = useState(false)
  const [pendingToken, setPendingToken] = useState<string | null>(
    () => new URLSearchParams(location.search).get('token') ?? sessionStorage.getItem('zito-paypal-order'),
  )
  const [payments, setPayments] = useState<{ enabled: boolean; environment: string } | null>(null)
  const [orderUrl, setOrderUrl] = useState<string | null>(null)
  const lock = useRef(false)
  // Errors appear once a field is left or checkout is attempted, not while the buyer is still typing.
  const [touched, setTouched] = useState<Record<string, Touched>>({})
  const invalid = cart.some((line) => Object.values(lineErrors(line)).some(Boolean))
  const rows = cart.map((line) => {
    if (line.kind === 'perfume') {
      const perfume = catalog.perfumes.find((p) => p.id === line.modelId)
      return { line, name: perfume?.name, variant: null, image: perfume?.images[0] ?? null, available: perfume?.availability === 'buy', price: perfume?.priceCents ?? 0 }
    }
    const model = catalog.models.find((m) => m.id === line.modelId)
    const variant = line.variantId ? model?.variants?.find((v) => v.id === line.variantId) : null
    const available = !!model && availabilityOf(model) === 'buy' && (!model.variants?.length || !!variant)
    // The chosen variant's photo first, so the cart shows the finish the buyer picked.
    const image = variant?.images[0] ?? model?.images[0] ?? null
    return { line, name: model?.name, variant, image, available, price: variant?.priceCents ?? model?.priceCents ?? 0 }
  })
  const total = rows.reduce((sum, row) => sum + row.price * row.line.quantity, 0)
  const unavailable = rows.some((row) => !row.available)
  useEffect(() => {
    if (!cartOpen) return
    setPaid(false)
    setAdded(null)
    trigger.current = document.activeElement as HTMLElement
    ref.current?.showModal()
    // Start on the title, not the close icon, so the focus ring doesn't frame the X on open.
    document.getElementById('cart-title')?.focus()
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    // The GitHub Pages preview has no payment backend; the button stays visible but disabled.
    if (!STATIC_PREVIEW)
      void api<{ enabled: boolean; environment: string }>('/payments/config')
        .then(setPayments)
        .catch(() => setMessage('Pagamenti non disponibili. Il carrello è conservato.'))
    return () => {
      ref.current?.close()
      document.documentElement.style.overflow = previous
      trigger.current?.focus()
    }
  }, [cartOpen])
  useEffect(() => {
    const checkout = new URLSearchParams(location.search).get('checkout')
    if (checkout === 'cancel') {
      setMessage('Pagamento annullato. Il carrello è conservato.')
      setPendingToken(null)
      sessionStorage.removeItem('zito-paypal-order')
      sessionStorage.removeItem('zito-checkout-request')
      history.replaceState(null, '', location.pathname)
    }
    // Approval is not payment. Capture requires an explicit, same-origin confirmation.
    if (checkout === 'return') setMessage('PayPal ha autorizzato l’ordine. Conferma per completare il pagamento.')
  }, [])
  async function checkout() {
    // The pay button is disabled while a section is incomplete; this guards programmatic calls.
    if (lock.current || invalid) return
    lock.current = true
    setBusy(true)
    setMessage('Preparazione del pagamento…')
    try {
      const items = orderItems(cart)
      // Changed personalization is a different order request.
      const serialized = JSON.stringify(items)
      let request: { id: string; cart: string } | null = null
      try {
        request = JSON.parse(sessionStorage.getItem('zito-checkout-request') ?? 'null')
      } catch {
        /* Start a new request if storage is corrupted. */
      }
      if (!request || request.cart !== serialized) {
        request = { id: crypto.randomUUID(), cart: serialized }
        sessionStorage.setItem('zito-checkout-request', JSON.stringify(request))
      }
      const order = await api<{ id: string; approvalUrl: string }>('/payments/orders', 'POST', {
        items,
        requestId: request.id,
      })
      sessionStorage.setItem('zito-paypal-order', order.id)
      location.assign(order.approvalUrl)
    } catch (error) {
      setMessage((error as Error).message)
      setBusy(false)
      lock.current = false
    }
  }
  async function capture() {
    if (!pendingToken || lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('Verifica e completamento del pagamento… Non chiudere la pagina.')
    try {
      const result = await api<{ status: string; id: string; orderUrl?: string }>(
        `/payments/orders/${encodeURIComponent(pendingToken)}/capture`,
        'POST',
        {},
      )
      if (result.status !== 'COMPLETED') throw new Error('Pagamento non confermato.')
      setOrderUrl(result.orderUrl ? `${import.meta.env.BASE_URL}${result.orderUrl.replace(/^\//, '')}` : null)
      setPaid(true)
      setCart([])
      setPendingToken(null)
      sessionStorage.removeItem('zito-paypal-order')
      sessionStorage.removeItem('zito-checkout-request')
      history.replaceState(null, '', location.pathname)
      // Captures lower limited-edition counts; show the new numbers without a page reload.
      void reload()
      setMessage(t('Pagamento completato. Riferimento ordine: {id}. Conserva questo riferimento.', { id: result.id }))
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  const update = (line: CartLine, patch: Partial<CartLine>) =>
    setCart(
      cart.flatMap((item) => {
        if (lineKey(item) !== lineKey(line)) return [item]
        const next = { ...item, ...patch }
        if (!isPersonalized(next) || next.quantity === 1) return [next]
        // A personalized piece is one per line: extra pieces move to a plain line of the same product.
        const extra = { ...next, id: crypto.randomUUID(), quantity: next.quantity - 1, certificate: null, engraving: null, engravingAccepted: false }
        return [{ ...next, quantity: 1 }, extra]
      }),
    )
  const iconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink-2 transition-colors duration-200 hover:text-ink'
  const continueClass = 'inline-flex min-h-14 w-full items-center justify-center rounded-full border border-line px-6 text-base font-semibold text-ink transition-colors duration-200 hover:border-ink'
  // The PayPal block is on screen: phones put "continue shopping" inside it, under the pay button.
  const checkoutShown = !!cart.length && !paid && !pendingToken
  const stepButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] border border-line text-ink transition-colors duration-200 hover:border-ink'
  return (
    <>
    <AddedPopup />
    <dialog
        ref={ref}
        aria-labelledby="cart-title"
        className="shop-dialog"
        onCancel={(event) => {
          if (busy) event.preventDefault()
        }}
        onClose={() => setCartOpen(false)}
      >
        {/* As in the client's reference: logo centred on top. Phones also get the close icon at the edge. */}
        <div className="relative flex items-center justify-center px-[var(--gutter)] pt-8 pb-6 sm:pt-10">
          <img src={asset('logo.svg')} alt="ZITO 1950®" width={355} height={100} className="h-8 w-auto sm:h-10" />
          <button type="button" className={`${iconButton} absolute right-[calc(var(--gutter)-0.75rem)] top-1/2 -translate-y-1/2 lg:hidden`} disabled={busy} aria-label={t('Chiudi')} onClick={() => setCartOpen(false)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {/* Phones show only the logo; the title stays for screen readers and as the focus target. */}
        <h2 id="cart-title" tabIndex={-1} className="mt-4 text-center text-body font-semibold outline-none max-lg:sr-only sm:mt-8">
          {/* The brand name is set in the logo's typeface. */}
          <span className="font-brand">{BRAND}</span> <span className="font-normal text-muted">·</span> {t('Carrello')}
        </h2>
        <div className="mx-auto grid max-w-[1180px] gap-10 px-[var(--gutter)] pt-2 pb-16 sm:pt-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16 lg:pt-12">
        <div className="min-w-0">
        {!paid && rows.length === 0 && <p className="border-t border-line py-10">{t("Il carrello è vuoto. Scopri la nostra collezione.")}</p>}
        {!paid && !!rows.length && (
          <ul className="border-t border-line">
            {rows.map(({ line, name, variant, image, available, price }, index) => {
              const key = lineKey(line)
              const personalized = isPersonalized(line)
              const locked = busy || !!pendingToken
              return (
                <li key={key} className="border-b border-line py-6">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="flex items-start gap-4">
                      <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden sm:w-20">
                        {image && (
                          <Picture src={image.src} alt={image.alt} sizes="80px" pictureClassName="block h-full w-full" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-h3">
                          {name ?? t('Prodotto rimosso')}
                          {variant ? ` · ${variant.label}` : ''}
                        </h3>
                        <p className="text-small">{euro(price)}{' ' + t("/ pezzo")}</p>
                        {!available && <p className="text-small">{t("Non più acquistabile. Rimuovi l’articolo per procedere.")}</p>}
                      </div>
                    </div>
                    {/* On mobile the controls line up with the name, past the 64px photo and its 16px gap. */}
                    <div className="flex flex-col items-start gap-2 pl-20 sm:items-end sm:pl-0">
                      <div className="flex items-center gap-4">
                        {/* Stepper as in the client's reference: − and + in light outlined squares, the count framed in ink between them. */}
                        <div role="group" aria-label={t('Quantità')} className="flex items-center gap-2">
                          <button
                            type="button"
                            className={stepButton}
                            disabled={locked || line.quantity <= 1}
                            aria-label={t('Diminuisci quantità')}
                            onClick={() => update(line, { quantity: line.quantity - 1 })}
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M5 12h14" />
                            </svg>
                          </button>
                          <output
                            aria-live="polite"
                            aria-describedby={personalized ? `${key}-single` : undefined}
                            className="inline-flex h-11 w-11 items-center justify-center border border-ink text-base tabular-nums"
                          >
                            {line.quantity}
                          </output>
                          <button
                            type="button"
                            className={stepButton}
                            disabled={locked || line.quantity >= 10}
                            aria-label={t('Aumenta quantità')}
                            onClick={() => update(line, { quantity: line.quantity + 1 })}
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M5 12h14M12 5v14" />
                            </svg>
                          </button>
                        </div>
                        <button
                          type="button"
                          className={iconButton}
                          disabled={locked}
                          aria-label={`${t('Rimuovi')}: ${name ?? t('Prodotto rimosso')}`}
                          onClick={() => setCart(cart.filter((item) => lineKey(item) !== key))}
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8l1-12M9 7V4.5h6V7" />
                          </svg>
                        </button>
                      </div>
                      {personalized && (
                        <p id={`${key}-single`} className="text-small text-muted">
                          {t('Personalizzato: un pezzo per riga, gli altri restano senza personalizzazione.')}
                        </p>
                      )}
                    </div>
                  </div>
                  <Personalization
                    line={line}
                    index={index}
                    disabled={locked}
                    touched={touched[key] ?? {}}
                    onTouch={(fields) => setTouched((state) => ({ ...state, [key]: { ...state[key], ...Object.fromEntries(fields.map((f) => [f, true])) } }))}
                    onChange={(patch) => update(line, patch)}
                  />
                </li>
              )
            })}
          </ul>
        )}
        {!paid && !!rows.length && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 text-small text-ink-2 transition-colors duration-200 hover:text-ink"
              disabled={busy || !!pendingToken}
              onClick={() => setCart([])}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8l1-12M9 7V4.5h6V7" />
              </svg>
              {t('Svuota carrello')}
            </button>
          </div>
        )}
        </div>
        <aside aria-label={t('Riepilogo')} className="lg:pt-6">
        {!!cart.length && !paid && (
          <>
            <div className="flex justify-between gap-4 text-small">
              <span>{t('Subtotale')}</span>
              <span className="tabular-nums">{euro(total)}</span>
            </div>
            <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-line pt-5">
              <span className="text-xl">{t("Totale")}</span>
              <strong className="text-xl font-semibold tabular-nums">{euro(total)}</strong>
            </div>
            <p className="mt-3 text-right text-small text-muted">
              {t("Prezzi in EUR. Nessun costo di spedizione aggiunto. Indirizzo di consegna selezionato su PayPal.")}
            </p>
          </>
        )}
        {payments?.environment === 'sandbox' && payments.enabled && (
          <p className="mt-4 text-small">{t("Modalità test PayPal: nessun pagamento reale.")}</p>
        )}
        <p role="status" aria-live="polite" className="mt-5 text-small empty:mt-0">
          {t(shopError || message)}
        </p>
        {paid && orderUrl && (
          <a className="btn mt-4" href={orderUrl}>
            {t('Vai all’ordine')}
          </a>
        )}
        {pendingToken && !paid ? (
          <div className="mt-6 flex flex-wrap gap-4">
            <button type="button" className="btn" disabled={busy} onClick={() => void capture()}>
              {busy ? t('Verifica in corso…') : t('Conferma / verifica pagamento')}
            </button>
            <button
              type="button"
              className="underline text-small"
              disabled={busy}
              onClick={() => {
                setPendingToken(null)
                sessionStorage.removeItem('zito-paypal-order')
                sessionStorage.removeItem('zito-checkout-request')
                history.replaceState(null, '', location.pathname)
                setMessage('Carrello modificabile. Se hai già approvato PayPal, verifica prima l’ordine precedente.')
              }}
            >
              {t("Torna al carrello")}
            </button>
          </div>
        ) : (
          !!cart.length &&
          !paid && (
            <div className="mt-6">
              <button
                type="button"
                className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink-2 px-6 text-base font-semibold text-bg transition-colors duration-200 hover:bg-ink"
                aria-describedby={invalid ? 'cart-invalid' : STATIC_PREVIEW ? 'cart-preview' : undefined}
                disabled={STATIC_PREVIEW || busy || unavailable || invalid || !!shopError || !payments?.enabled}
                onClick={() => void checkout()}
              >
                {busy ? t('Connessione a PayPal…') : t('Paga con PayPal')}
              </button>
              {/* Phones: "continue shopping" sits right under PayPal, without the separator. */}
              <button type="button" className={`${continueClass} mt-3 lg:hidden`} disabled={busy} onClick={() => setCartOpen(false)}>
                {t('Continua gli acquisti')}
              </button>
              {invalid && (
                <p id="cart-invalid" className="mt-3 text-small">
                  {t('Completa o rimuovi la personalizzazione indicata per procedere.')}
                </p>
              )}
              {STATIC_PREVIEW && (
                <p id="cart-preview" className="mt-3 text-small text-muted">
                  {t('Anteprima: il pagamento PayPal è disattivato.')}
                </p>
              )}
            </div>
          )
        )}
        {payments && !payments.enabled && !!cart.length && (
          <p className="mt-4 text-small">{t("Pagamenti online non ancora attivi. Contattaci per acquistare.")}</p>
        )}
        {/* On desktop a hairline separates checkout from "continue shopping", as in the reference. */}
        {checkoutShown && <hr className="mt-8 hidden border-line lg:block" />}
        <button
          type="button"
          className={`${continueClass} mt-8 ${checkoutShown ? 'max-lg:hidden' : ''}`}
          disabled={busy}
          onClick={() => setCartOpen(false)}
        >
          {t('Continua gli acquisti')}
        </button>
        </aside>
        </div>
      </dialog>
    </>
  )
}
