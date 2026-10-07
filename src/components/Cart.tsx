import { useEffect, useRef, useState } from 'react'
import { api, euro, lineKey, useShop, type CartLine } from '../lib/shop'
import { t } from '../lib/i18n'

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
  if (!model?.buyEnabled || error) return null
  return (
    <button type="button"
    className="btn mt-3 w-full"
    onClick={() => {
      beforeOpen?.()
      add(model, variant)
    }}>{t('Acquista')}</button>
  )
}
export default function Cart() {
  const { localizedCatalog: catalog, cart, setCart, cartOpen, setCartOpen, error: shopError } = useShop()
  const ref = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [paid, setPaid] = useState(false)
  const [pendingToken, setPendingToken] = useState<string | null>(
    () => new URLSearchParams(location.search).get('token') ?? sessionStorage.getItem('zito-paypal-order'),
  )
  const [payments, setPayments] = useState<{ enabled: boolean; environment: string } | null>(null)
  const lock = useRef(false)
  const rows = cart.map((line) => {
    const model = catalog.models.find((m) => m.id === line.modelId)
    const variant = line.variantId ? model?.variants?.find((v) => v.id === line.variantId) : null
    const available = !!model?.buyEnabled && (!model.variants?.length || !!variant)
    return { line, model, variant, available, price: variant?.priceCents ?? model?.priceCents ?? 0 }
  })
  const total = rows.reduce((sum, row) => sum + row.price * row.line.quantity, 0)
  const unavailable = rows.some((row) => !row.available)
  useEffect(() => {
    if (!cartOpen) return
    trigger.current = document.activeElement as HTMLElement
    ref.current?.showModal()
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
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
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('Preparazione del pagamento…')
    try {
      const serialized = JSON.stringify(cart)
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
        items: cart,
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
      const result = await api<{ status: string; id: string }>(
        `/payments/orders/${encodeURIComponent(pendingToken)}/capture`,
        'POST',
        {},
      )
      if (result.status !== 'COMPLETED') throw new Error('Pagamento non confermato.')
      setPaid(true)
      setCart([])
      setPendingToken(null)
      sessionStorage.removeItem('zito-paypal-order')
      sessionStorage.removeItem('zito-checkout-request')
      history.replaceState(null, '', location.pathname)
      setMessage(t('Pagamento completato. Riferimento ordine: {id}. Conserva questo riferimento.', { id: result.id }))
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  const update = (line: CartLine, quantity: number) =>
    setCart(cart.map((item) => (lineKey(item) === lineKey(line) ? { ...item, quantity } : item)))
  return (
    <>
      <button
        type="button"
        className="cart-trigger btn"
        onClick={() => {
          setPaid(false)
          setCartOpen(true)
        }}
        aria-haspopup="dialog"
      >
        {t('Carrello ({count})', { count: cart.reduce((sum, line) => sum + line.quantity, 0) })}
      </button>
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
            <p className="eyebrow">{t("ZITO 1950 · Boutique")}</p>
            <h2 id="cart-title" className="mt-2 text-h2">
              {t("Il tuo carrello")}
            </h2>
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => setCartOpen(false)}>
            {t("Chiudi")}
          </button>
        </div>
        {!paid && rows.length === 0 && <p className="py-10">{t("Il carrello è vuoto. Scopri la nostra collezione.")}</p>}
        {!paid && (
          <ul>
            {rows.map(({ line, model, variant, available, price }) => (
              <li key={lineKey(line)} className="grid gap-4 border-b border-line py-6 sm:grid-cols-[1fr_auto]">
                <div>
                  <h3 className="text-h3">
                    {model?.name ?? t('Prodotto rimosso')}
                    {variant ? ` · ${variant.label}` : ''}
                  </h3>
                  <p className="text-small">{euro(price)}{' ' + t("/ pezzo")}</p>
                  {!available && <p className="text-small">{t("Non più acquistabile. Rimuovi l’articolo per procedere.")}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-small">
                    {t("Quantità")}
                    <select
                      className="shop-input ml-2"
                      disabled={busy || !!pendingToken}
                      value={line.quantity}
                      onChange={(e) => update(line, Number(e.target.value))}
                    >
                      {Array.from({ length: 10 }, (_, i) => (
                        <option key={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="underline text-small"
                    disabled={busy || !!pendingToken}
                    onClick={() => setCart(cart.filter((item) => lineKey(item) !== lineKey(line)))}
                  >
                    {t("Rimuovi")}
                  </button>
                </div>
              </li>
            ))}
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
            <button
              type="button"
              className="btn mt-6 w-full"
              disabled={busy || unavailable || !!shopError || !payments?.enabled}
              onClick={() => void checkout()}
            >
              {busy ? t('Connessione a PayPal…') : t('Paga con PayPal')}
            </button>
          )
        )}
        {payments && !payments.enabled && !!cart.length && (
          <p className="mt-4 text-small">{t("Pagamenti online non ancora attivi. Contattaci per acquistare.")}</p>
        )}
      </dialog>
    </>
  )
}
