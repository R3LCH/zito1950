import type { TranslationLocale } from './localization'

export interface TextTranslation {
  description?: string
  specs?: string[]
  quoteText?: string
  label?: string
  paragraphs?: string[]
}
export type TextTranslations = Partial<Record<TranslationLocale, TextTranslation>>

export interface Img {
  src: string
  alt: string
  altTranslations?: Partial<Record<TranslationLocale, string>>
  /** Original upload file name (without extension), shown only in the admin panel. */
  name?: string
}

export interface Quote {
  text: string
  author?: string
}

/** A colour or finish of the same model; overrides the model's codes, price, specs and photos. */
export interface Variant {
  id: string
  /** Colour/finish name, taken from the specs text. */
  label: string
  /** 1–2 CSS colours drawn as a split swatch (e.g. case + strap). */
  swatch: string[]
  codes: string[]
  /** Exactly as printed on the price card. */
  price: string
  priceCents?: number
  specs?: string[]
  images: Img[]
  translations?: TextTranslations
}

/** Public availability of a watch; set per product in the admin panel. */
export const AVAILABILITIES = ['buy', 'no-buy', 'out-of-stock', 'hidden'] as const
export type Availability = (typeof AVAILABILITIES)[number]

/** Who a watch is made for; set per product in the admin panel. Unisex models are listed under both Uomo and Donna. */
export const GENDERS = ['uomo', 'donna', 'unisex'] as const
export type Gender = (typeof GENDERS)[number]

export interface Model {
  id: string
  codes: string[]
  name: string
  /** Exactly as printed on the price card, e.g. "3.890 EUR". */
  price: string
  priceCents?: number
  /** buy: Acquista button · no-buy: showcase only · out-of-stock: Esaurito · hidden: not listed. Default no-buy. A limited edition with 0 pieces left reads as out-of-stock. */
  availability?: Availability
  /** Uomo, Donna or Unisex; seeded from the old site's Uomo/Donna menu. Default unisex. */
  gender?: Gender
  limitedEdition?: boolean
  /** Pieces still available for a limited edition; null/undefined = not shown, 0 = Esaurito and not purchasable. */
  piecesRemaining?: number | null
  /** Shown with a "Nuovo" tag and listed first; set in the admin panel. */
  isNew?: boolean
  /** Owner-chosen similar models (ids, in display order), shown first in "Scopri anche". */
  similar?: string[]
  quote?: Quote
  description?: string
  specs: string[]
  images: Img[]
  /** First variant is the default view. */
  variants?: Variant[]
  translations?: TextTranslations
}

/** Name on the ownership certificate (old site: nome, cognome, email). */
export interface CertificateHolder {
  firstName: string
  lastName: string
  email: string
}

/** Engraving on the back of a watch (or on a perfume): optional, at most 10 words. An engraved item is personalized and cannot be returned. */
export const ENGRAVING_MAX_WORDS = 10
export const ENGRAVING_MAX_CHARS = 120
export const engravingWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

/** Optional per cart line / order line: both fields null = not personalized. */
export interface LinePersonalization {
  /** "Certificato della proprietà e garanzia" holder; null = no personalized certificate. */
  certificate: CertificateHolder | null
  /** Trimmed engraving text, 1..10 words; null = no engraving. */
  engraving: string | null
}

/** Order readiness set by the owner in Admin -> Ordini; every change can email the customer. */
export const FULFILLMENT_STATUSES = ['ricevuto', 'in-lavorazione', 'pronto', 'spedito', 'consegnato'] as const
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number]
export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  ricevuto: 'Ordine ricevuto',
  'in-lavorazione': 'In lavorazione',
  pronto: 'Pronto',
  spedito: 'Spedito',
  consegnato: 'Consegnato',
}

/** One line of a paid order as shown on the order page, in emails and in admin. */
export interface OrderItemView extends LinePersonalization {
  kind: 'model' | 'perfume'
  name: string
  codes: string[]
  quantity: number
  priceCents: number
  /** Product photo at order time (public path such as img/models/n2.jpg or uploads/...); null if none. */
  image: Img | null
}

/** GET /api/orders/:token, the customer's order page. */
export interface PublicOrder {
  /** Order id (uuid) shown as the customer's reference. */
  reference: string
  created: number
  total: number
  status: FulfillmentStatus
  history: { status: FulfillmentStatus; at: number }[]
  items: OrderItemView[]
}

/**
 * Customer email for one readiness status; edited in Admin -> Email.
 * Placeholders in subject/heading/message: {nome} (customer first name), {ordine} (reference), {stato} (status label).
 */
export interface EmailTemplate {
  enabled: boolean
  subject: string
  heading: string
  /** Plain text; blank lines separate paragraphs. */
  message: string
}
export type EmailTemplates = Record<FulfillmentStatus, EmailTemplate>
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  ricevuto: {
    enabled: true,
    subject: 'Grazie per il tuo ordine {ordine}',
    heading: 'Grazie, {nome}',
    message:
      'Abbiamo ricevuto il tuo ordine e il pagamento è andato a buon fine.\n\nTi scriveremo di nuovo quando sarà pronto. Qui sotto trovi il riepilogo, con i dati del certificato e l’incisione che hai scelto.',
  },
  'in-lavorazione': {
    enabled: true,
    subject: 'Il tuo ordine {ordine} è in lavorazione',
    heading: 'Ci stiamo lavorando',
    message: 'Il tuo ordine è in lavorazione nel nostro laboratorio. Ti avviseremo appena sarà pronto.',
  },
  pronto: {
    enabled: true,
    subject: 'Il tuo ordine {ordine} è pronto',
    heading: 'Il tuo ordine è pronto',
    message: 'Abbiamo completato il tuo ordine con cura. A breve partirà la spedizione.',
  },
  spedito: {
    enabled: true,
    subject: 'Il tuo ordine {ordine} è stato spedito',
    heading: 'In viaggio verso di te',
    message: 'Il tuo ordine è stato spedito. Puoi seguirne lo stato dalla pagina dell’ordine.',
  },
  consegnato: {
    enabled: true,
    subject: 'Il tuo ordine {ordine} è stato consegnato',
    heading: 'Buon tempo, {nome}',
    message: 'Il tuo ordine risulta consegnato. Grazie per aver scelto ZITO 1950®.',
  },
}

export interface Site {
  name: string
  tagline: string
  description: string
  nav: { href: string; label: string }[]
  /** Rounded jump buttons under the hero; `icon` picks the line icon drawn on the button. */
  sections: { href: string; label: string; hint: string; icon: SectionIcon }[]
  /** Shared labels of the expandable sections. */
  panel: { more: string; less: string; fullCatalog: string }
  cta: {
    /** Hero button to #orologi. */
    collection: string
    info: string
    whereToFind: string
  }
  hero: { image: Img; motto: string; lead: string; text: string }
  labels: {
    code: string
    codes: string
    price: string
    specs: string
    backToTop: string
    menu: string
    close: string
    skipToContent: string
    mainNav: string
    footerNav: string
    home: string
  }
  footer: { copyright: string }
}

export interface StoriaChapter {
  eyebrow: string
  title: string
  paragraphs: string[]
  image?: Img & { caption: string }
}

export interface Storia {
  eyebrow: string
  title: string
  intro: string
  /** Second preview paragraph, under the intro. */
  introMore: string
  /** Label of the button that opens the full story. */
  more: string
  image: Img & { caption: string }
  chapters: StoriaChapter[]
  closing: Quote
}

export type SectionIcon = 'storia' | 'limited' | 'perche'

/** Heading copy of a section whose items come from the catalog (e.g. the perfumes). */
export interface SectionCopy {
  eyebrow: string
  title: string
  intro: string
}

/** Perfume section heading; `soon` labels perfumes announced before release. */
export interface ProfumiSection extends SectionCopy {
  soon: string
}

/** Public state of a perfume, set in admin. coming-soon: shown as «Prossimamente», no price, not purchasable. */
export const PERFUME_AVAILABILITIES = ['buy', 'no-buy', 'coming-soon', 'out-of-stock', 'hidden'] as const
export type PerfumeAvailability = (typeof PERFUME_AVAILABILITIES)[number]

/** The owner at the workbench: photo plus the craft notes (the former watch pillars). */
export interface Officina {
  eyebrow: string
  title: string
  paragraphs: string[]
  /** Label of the toggle that opens the craft notes. */
  more: string
  image: Img & { caption: string }
}

/** «Perché scegliere ZITO1950»: serif lead, reasons, closing brand line. */
export interface Perche {
  title: string
  lead: string
  paragraphs: string[]
  closing: string
}

/** «Scopri il territorio»: Scalea and the Calabrian coast. */
export interface Territorio {
  eyebrow: string
  title: string
  paragraphs: string[]
  closing: string
  image: Img
}

export interface Pillar {
  title: string
  text: string
}

export interface Orologi {
  eyebrow: string
  title: string
  intro: string
  pillars: Pillar[]
  catalog: {
    eyebrow: string
    title: string
    details: string
    viewImage: string
    prevImage: string
    nextImage: string
    /** Label of the colour picker radio group. */
    colors: string
    mailSubject: string
  }
}

export interface Profumo {
  id: string
  eyebrow: string
  code: string
  name: string
  price: string
  priceCents?: number
  /** Default no-buy. Only buy can be added to the cart; hidden is omitted from the public catalog. */
  availability?: PerfumeAvailability
  /** Short line under the name, e.g. «Pepe Nero». */
  line?: string
  /** Blank text = no quotation shown. */
  quote: Quote
  paragraphs: string[]
  specs: string[]
  ingredients: string[]
  images: Img[]
  labels: {
    ingredients: string
    /** Prefix of the mailto subject; name and code are appended. */
    mailSubject: string
  }
  translations?: TextTranslations
}

export interface Contatti {
  eyebrow: string
  title: string
  /** Map query only; never rendered. */
  address: string
  city: string
  email: string
  instagram: string
  facebook: string
  labels: {
    email: string
    social: string
    mapTitle: string
    instagram: string
    facebook: string
    newTab: string
  }
}
