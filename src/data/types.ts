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
export const AVAILABILITIES = ['buy', 'no-buy', 'sold', 'out-of-stock', 'hidden'] as const
export type Availability = (typeof AVAILABILITIES)[number]

export interface Model {
  id: string
  codes: string[]
  name: string
  /** Exactly as printed on the price card, e.g. "3.890 EUR". */
  price: string
  priceCents?: number
  /** buy: Acquista button · no-buy: showcase only · sold: Venduto · out-of-stock: Esaurito · hidden: not listed. Default no-buy. */
  availability?: Availability
  limitedEdition?: boolean
  /** Pieces still available for a limited edition; null/undefined = not shown. */
  piecesRemaining?: number | null
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

export interface Site {
  name: string
  tagline: string
  description: string
  nav: { href: string; label: string }[]
  cta: {
    /** Hero button to #storia. */
    story: string
    /** Hero button to #edizioni-limitate. */
    limited: string
    /** Hero button to #social. */
    social: string
    info: string
    whereToFind: string
    visit: string
  }
  hero: { image: Img }
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

/** Opening setting of the story: the town where the business started and still is. */
export interface StoriaPlace {
  eyebrow: string
  title: string
  paragraphs: string[]
  images: (Img & { caption: string })[]
}

export interface Storia {
  eyebrow: string
  title: string
  intro: string
  place: StoriaPlace
  chapters: StoriaChapter[]
  closing: Quote
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
  intro: string
  company: string
  address: string
  city: string
  pec: string
  piva: string
  website: string
  instagram: string
  facebook: string
  mapsUrl: string
  labels: {
    address: string
    pec: string
    social: string
    piva: string
    maps: string
    mapTitle: string
    instagram: string
    facebook: string
    newTab: string
  }
}
