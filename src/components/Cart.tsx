import { useEffect, useRef, useState } from 'react'
import { api, euro, isPersonalized, lineKey, STATIC_PREVIEW, useShop, type CartLine } from '../lib/shop'
import { t } from '../lib/i18n'
import { ENGRAVING_MAX_CHARS, ENGRAVING_MAX_WORDS, engravingWords, type CertificateHolder } from '../data/types'
import { availabilityOf } from '../lib/catalogFilters'
import Picture from './Picture'

const CERTIFICATE_IMAGES = [
  { src: 'img/certificato/fronte.jpg', alt: 'Certificato di proprietà ZITO 1950®, fronte' },
  { src: 'img/certificato/retro.jpg', alt: 'Certificato di proprietà ZITO 1950®, retro' },
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
          <div className="mt-1 flex items-start gap-4">
            <ul className="flex shrink-0 gap-2" aria-label={t('Certificato della proprietà e garanzia')}>
              {CERTIFICATE_IMAGES.map((image) => (
                <li key={image.src} className="w-16 overflow-hidden rounded-md border border-line sm:w-20">
                  <Picture src={image.src} alt={t(image.alt)} sizes="80px" className="h-auto w-full" />
                </li>
              ))}
            </ul>
            <p id={`${id}-certificate-help`} className="text-small text-muted">
              {perfume
                ? t('Il certificato è intestato a questo nome e viene consegnato insieme al profumo.')
                : t('Il certificato è intestato a questo nome e viene consegnato insieme all’orologio.')}
            </p>
          </div>
          <fieldset disabled={disabled} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-describedby={`${id}-certificate-help`}>
            <legend className="sr-only">{t('Intestatario del certificato')}</legend>
            {(
              [
                { field: 'firstName', label: 'Nome', autoComplete: 'given-name', type: 'text', maxLength: 80, wide: false },
                { field: 'lastName', label: 'Cognome', autoComplete: 'family-name', type: 'text', maxLength: 80, wide: false },
                { field: 'email', label: 'Email', autoComplete: 'email', type: 'email', maxLength: 254, wide: true },
              ] as const
            ).map(({ field, label, autoComplete, type, maxLength, wide }) => {
              const error = touched[field] ? errors[field] : null
              const errorId = `${id}-${field}-error`
              return (
                <label key={field} className={`shop-label${wide ? ' sm:col-span-2' : ''}`}>
                  {t(label)}
                  <input
                    className="shop-input"
                    type={type}
                    autoComplete={autoComplete}
                    required={!!line.certificate}
                    maxLength={maxLength}
                    value={holder[field]}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    onBlur={() => onTouch([field])}
                    onChange={(e) => {
                      const next = { ...holder, [field]: e.target.value }
                      // Emptying every field withdraws the certificate, so the section is optional again.
                      onChange({ certificate: next.firstName || next.lastName || next.email ? next : null })
                    }}
                  />
                  {error && (
                    <span id={errorId} className="text-small text-ink">
                      {t(error)}
                    </span>
                  )}
                </label>
              )
            })}
          </fieldset>
          {line.certificate && (
            <button
              type="button"
              className="mt-4 underline text-small"
              disabled={disabled}
              onClick={() => {
                onChange({ certificate: null })
                setCertificateOpen(false)
              }}
            >
              {t('Rimuovi certificato')}
            </button>
          )}
        </div>
      </div>
      <div className="border-b border-line">
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
export default function Cart() {
  const { localizedCatalog: catalog, cart, setCart, cartOpen, setCartOpen, error: shopError, reload } = useShop()
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
      return { line, name: perfume?.name, variant: null, available: perfume?.availability === 'buy', price: perfume?.priceCents ?? 0 }
    }
    const model = catalog.models.find((m) => m.id === line.modelId)
    const variant = line.variantId ? model?.variants?.find((v) => v.id === line.variantId) : null
    const available = !!model && availabilityOf(model) === 'buy' && (!model.variants?.length || !!variant)
    return { line, name: model?.name, variant, available, price: variant?.priceCents ?? model?.priceCents ?? 0 }
  })
  const total = rows.reduce((sum, row) => sum + row.price * row.line.quantity, 0)
  const unavailable = rows.some((row) => !row.available)
  useEffect(() => {
    if (!cartOpen) return
    setPaid(false)
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
  return (
    <dialog
        ref={ref}
        aria-labelledby="cart-title"
        className="shop-dialog"
        onCancel={(event) => {
          if (busy) event.preventDefault()
        }}
        onClose={() => setCartOpen(false)}
      >
        <div className="flex items-center justify-between gap-6 border-b border-line pb-5">
          <div>
            <p className="eyebrow">
              {/* The brand name is set in the logo's typeface; the rest of the eyebrow stays in the UI face. */}
              {t('ZITO 1950® · Boutique')
                .split(BRAND)
                .map((part, i) => (i ? [<span key={i} className="font-brand">{BRAND}</span>, part] : part))}
            </p>
            <h2 id="cart-title" tabIndex={-1} className="mt-2 text-h2 outline-none">
              {t("Il tuo carrello")}
            </h2>
          </div>
          <button type="button" className={iconButton} disabled={busy} aria-label={t('Chiudi')} onClick={() => setCartOpen(false)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {!paid && rows.length === 0 && <p className="py-10">{t("Il carrello è vuoto. Scopri la nostra collezione.")}</p>}
        {!paid && (
          <ul>
            {rows.map(({ line, name, variant, available, price }, index) => {
              const key = lineKey(line)
              const personalized = isPersonalized(line)
              const locked = busy || !!pendingToken
              return (
                <li key={key} className="border-b border-line py-6">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div>
                      <h3 className="text-h3">
                        {name ?? t('Prodotto rimosso')}
                        {variant ? ` · ${variant.label}` : ''}
                      </h3>
                      <p className="text-small">{euro(price)}{' ' + t("/ pezzo")}</p>
                      {!available && <p className="text-small">{t("Non più acquistabile. Rimuovi l’articolo per procedere.")}</p>}
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <div className="flex items-center gap-4">
                        <label className="text-small">
                          {t("Quantità")}
                          <select
                            className="shop-input ml-2"
                            disabled={locked}
                            value={line.quantity}
                            aria-describedby={personalized ? `${key}-single` : undefined}
                            onChange={(e) => update(line, { quantity: Number(e.target.value) })}
                          >
                            {Array.from({ length: 10 }, (_, i) => (
                              <option key={i + 1}>{i + 1}</option>
                            ))}
                          </select>
                        </label>
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
        {!!cart.length && !paid && (
          <div className="mt-6 flex justify-between text-xl">
            <span>{t("Totale")}</span>
            <strong className="font-medium">{euro(total)}</strong>
          </div>
        )}
        {!!cart.length && !paid && (
          <p className="mt-3 text-small text-muted">
            {t("Prezzi in EUR. Nessun costo di spedizione aggiunto. Indirizzo di consegna selezionato su PayPal.")}
          </p>
        )}
        {payments?.environment === 'sandbox' && payments.enabled && (
          <p className="mt-4 text-small">{t("Modalità test PayPal: nessun pagamento reale.")}</p>
        )}
        <p role="status" aria-live="polite" className="mt-5 text-small">
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
            <div className="mt-8 border-t border-line pt-6">
              <button
                type="button"
                className="btn w-full"
                aria-describedby={invalid ? 'cart-invalid' : STATIC_PREVIEW ? 'cart-preview' : undefined}
                disabled={STATIC_PREVIEW || busy || unavailable || invalid || !!shopError || !payments?.enabled}
                onClick={() => void checkout()}
              >
                {busy ? t('Connessione a PayPal…') : t('Paga con PayPal')}
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
      </dialog>
  )
}
