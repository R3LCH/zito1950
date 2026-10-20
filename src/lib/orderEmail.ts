/**
 * Order emails (owner + customer), rendered as table-based HTML with inline styles plus a plain-text
 * alternative. Pure TS (no React, no DOM): imported by server/app.mjs through Node type stripping and by
 * the Admin email preview. Every dynamic value is escaped.
 */
import { contatti } from '../data/content.ts'
import { FULFILLMENT_LABELS } from '../data/types.ts'
import type { EmailTemplate, OrderItemView, PublicOrder } from '../data/types.ts'

export interface EmailBrand {
  /** Absolute site origin, e.g. https://www.zito1950.it (no trailing slash). */
  origin: string
}

interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const INK = '#1a1a1a'
const MUTED = '#6b6b6b'
const HAIRLINE = '#e5e5e5'
const SERIF = "Georgia, 'EB Garamond', 'Times New Roman', serif"
const SANS = 'Helvetica, Arial, sans-serif'
const SHOP_EMAIL = 'customer@zito1950.it'
const MOTTO = 'Officine del tempo'
const NOT_RETURNABLE = 'Articolo personalizzato: non restituibile.'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const formatPrice = (cents: number) => euro.format(cents / 100)
const formatDate = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(new Date(ms))

const absolute = (origin: string, path: string) =>
  /^https?:\/\//i.test(path) ? path : `${origin.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

/** Replaces {nome}, {ordine} and {stato}; unknown braces are left as written. */
export function fillPlaceholders(text: string, values: { nome: string; ordine: string; stato: string }): string {
  return text.replace(/\{(nome|ordine|stato)\}/g, (_, key: 'nome' | 'ordine' | 'stato') => values[key])
}

const paragraphs = (message: string) =>
  message
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

const certificateLine = (item: OrderItemView) => {
  const c = item.certificate
  return c ? `Certificato della proprietà e garanzia: ${`${c.firstName} ${c.lastName}`.trim()} · ${c.email}` : null
}
const engravingLine = (item: OrderItemView) => (item.engraving ? `Incisione: «${item.engraving}»` : null)

// ---- HTML building blocks ----

function itemHtml(item: OrderItemView, origin: string) {
  const image = item.image
    ? `<img src="${escapeHtml(absolute(origin, item.image.src))}" alt="${escapeHtml(item.image.alt || item.name)}" width="120" style="display:block;width:120px;max-width:120px;height:auto;border:0;" />`
    : ''
  const certificate = certificateLine(item)
  const engraving = engravingLine(item)
  const meta = (text: string, color = MUTED) =>
    `<p style="margin:4px 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${color};">${escapeHtml(text)}</p>`
  const details = [
    `<p style="margin:0;font-family:${SERIF};font-size:18px;line-height:1.3;color:${INK};">${escapeHtml(item.name)}</p>`,
    item.codes.length ? meta(item.codes.join(' · ')) : '',
    meta(`Quantità: ${item.quantity}`),
    meta(formatPrice(item.priceCents * item.quantity), INK),
    certificate ? meta(certificate, INK) : '',
    engraving ? meta(engraving, INK) : '',
    engraving ? meta(NOT_RETURNABLE) : '',
  ].join('')
  return `<tr><td style="padding:20px 0;border-top:1px solid ${HAIRLINE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${image ? `<td width="120" valign="top" style="width:120px;padding-right:20px;">${image}</td>` : ''}
<td valign="top">${details}</td>
</tr></table>
</td></tr>`
}

function headerHtml(origin: string) {
  return `<tr><td align="center" style="padding:40px 32px 32px;">
<img src="${escapeHtml(absolute(origin, 'email/logo.png'))}" alt="ZITO 1950®" width="180" style="display:block;width:180px;max-width:180px;height:auto;border:0;" />
</td></tr>`
}

function footerHtml(origin: string) {
  const icon = (href: string, file: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 6px;text-decoration:none;"><img src="${escapeHtml(absolute(origin, `email/${file}`))}" alt="${escapeHtml(label)}" width="24" height="24" style="display:block;width:24px;height:24px;border:0;" /></a>`
  return `<tr><td align="center" style="padding:32px;border-top:1px solid ${HAIRLINE};">
<img src="${escapeHtml(absolute(origin, 'email/logo.png'))}" alt="ZITO 1950®" width="110" style="display:block;width:110px;max-width:110px;height:auto;border:0;margin:0 auto;" />
<p style="margin:12px 0 16px;font-family:${SERIF};font-style:italic;font-size:15px;color:${MUTED};">${escapeHtml(MOTTO)}</p>
<p style="margin:0 0 12px;">${icon(contatti.instagram, 'instagram.png', contatti.labels.instagram)}${icon(contatti.facebook, 'facebook.png', contatti.labels.facebook)}</p>
<p style="margin:0;font-family:${SANS};font-size:13px;"><a href="mailto:${SHOP_EMAIL}" style="color:${MUTED};text-decoration:underline;">${SHOP_EMAIL}</a></p>
</td></tr>`
}

interface LayoutInput {
  origin: string
  title: string
  heading: string
  /** Raw paragraphs, escaped here. */
  paragraphs: string[]
  /** Raw label/value rows shown above the items (owner email), escaped here. */
  facts?: [string, string][]
  order: PublicOrder
  orderUrl: string
}

function layoutHtml({ origin, title, heading, paragraphs: body, facts = [], order, orderUrl }: LayoutInput) {
  const text = (value: string, style = '') =>
    `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK};${style}">${escapeHtml(value)}</p>`
  const factRows = facts
    .map(
      ([label, value]) =>
        `<tr><td valign="top" style="padding:4px 16px 4px 0;font-family:${SANS};font-size:13px;color:${MUTED};white-space:nowrap;">${escapeHtml(label)}</td><td valign="top" style="padding:4px 0;font-family:${SANS};font-size:13px;color:${INK};">${escapeHtml(value)}</td></tr>`,
    )
    .join('')
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;color:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;"><tr><td align="center" style="padding:0 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;">
${headerHtml(origin)}
<tr><td style="padding:0 32px 8px;">
<h1 style="margin:0 0 20px;font-family:${SERIF};font-weight:normal;font-size:28px;line-height:1.25;color:${INK};">${escapeHtml(heading)}</h1>
${body.map((p) => text(p)).join('\n')}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;"><tr><td style="border-radius:999px;background:${INK};">
<a href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:13px 28px;border-radius:999px;font-family:${SANS};font-size:15px;color:#ffffff;text-decoration:none;">Vai all’ordine</a>
</td></tr></table>
<p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};">Ordine ${escapeHtml(order.reference)} · ${escapeHtml(formatDate(order.created))}</p>
${factRows ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;">${factRows}</table>` : ''}
</td></tr>
<tr><td style="padding:16px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${order.items.map((item) => itemHtml(item, origin)).join('\n')}
<tr><td style="padding:20px 0 32px;border-top:1px solid ${HAIRLINE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${SANS};font-size:15px;color:${MUTED};">Totale</td>
<td align="right" style="font-family:${SERIF};font-size:20px;color:${INK};">${escapeHtml(formatPrice(order.total))}</td>
</tr></table>
</td></tr>
</table>
</td></tr>
${footerHtml(origin)}
</table>
</td></tr></table>
</body></html>`
}

function layoutText({ heading, paragraphs: body, facts = [], order, orderUrl }: LayoutInput) {
  const items = order.items.map((item) =>
    [
      `- ${item.name}`,
      item.codes.length ? `  ${item.codes.join(' · ')}` : '',
      `  Quantità: ${item.quantity}`,
      `  ${formatPrice(item.priceCents * item.quantity)}`,
      certificateLine(item) ? `  ${certificateLine(item)}` : '',
      engravingLine(item) ? `  ${engravingLine(item)}\n  ${NOT_RETURNABLE}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  )
  return [
    'ZITO 1950®',
    heading,
    ...body,
    `Vai all’ordine: ${orderUrl}`,
    [`Ordine ${order.reference} · ${formatDate(order.created)}`, ...facts.map(([label, value]) => `${label}: ${value}`)].join('\n'),
    items.join('\n\n'),
    `Totale: ${formatPrice(order.total)}`,
    `--\nZITO 1950® · ${MOTTO}\nInstagram: ${contatti.instagram}\nFacebook: ${contatti.facebook}\n${SHOP_EMAIL}`,
  ].join('\n\n')
}

export function renderCustomerEmail(
  template: EmailTemplate,
  order: PublicOrder,
  opts: { origin: string; customerName: string; orderUrl: string },
): RenderedEmail {
  const values = { nome: opts.customerName, ordine: order.reference, stato: FULFILLMENT_LABELS[order.status] }
  // Placeholders are filled into the raw text; escaping happens once, when the HTML is built.
  const input: LayoutInput = {
    origin: opts.origin,
    title: fillPlaceholders(template.subject, values),
    heading: fillPlaceholders(template.heading, values),
    paragraphs: paragraphs(fillPlaceholders(template.message, values)),
    order,
    orderUrl: opts.orderUrl,
  }
  return { subject: input.title.replace(/[\r\n]+/g, ' '), html: layoutHtml(input), text: layoutText(input) }
}

export function renderOwnerEmail(
  order: PublicOrder,
  opts: { origin: string; orderUrl: string; customerEmail: string | null; payer: { name?: string; email?: string } | null; shipping: string | null },
): RenderedEmail {
  const subject = `Nuovo ordine ${order.reference} · ${formatPrice(order.total)}`
  const facts: [string, string][] = [
    ['Stato', FULFILLMENT_LABELS[order.status]],
    ['Pagante', [opts.payer?.name, opts.payer?.email].filter(Boolean).join(' · ') || 'Non indicato'],
    ['Email cliente', opts.customerEmail || 'Non indicata'],
    ['Spedizione', opts.shipping || 'Non indicata'],
    ['Pagina ordine', opts.orderUrl],
  ]
  const input: LayoutInput = {
    origin: opts.origin,
    title: subject,
    heading: 'Nuovo ordine pagato',
    paragraphs: [`È arrivato un nuovo ordine da ${formatPrice(order.total)}, pagato con PayPal. Qui sotto trovi articoli, certificati e incisioni da preparare.`],
    facts,
    order,
    orderUrl: opts.orderUrl,
  }
  return { subject, html: layoutHtml(input), text: layoutText(input) }
}
