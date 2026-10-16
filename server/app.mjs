import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'
import sharp from 'sharp'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, createHash, timingSafeEqual, randomUUID } from 'node:crypto'
import { mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { z } from 'zod'
import { models, site, storia, profumo, tesoroDiAlarico, officina, territorio } from '../src/data/content.ts'
import { GENDERS, PERFUME_AVAILABILITIES } from '../src/data/types.ts'
import { LOCALES, TRANSLATION_LOCALES, seedImageTranslations, seedModelTranslations, seedPerfumeTranslations } from '../src/data/localization.ts'
import { createTranslator } from './translate.mjs'

const digest = (value) => createHash('sha256').update(value).digest('hex')
const money = (cents) => (cents / 100).toFixed(2)
const displayPrice = (cents) =>
  `${new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} EUR`
const initialPrice = (price) => Math.round(Number(price.replace(/\./g, '').replace(',', '.').replace(' EUR', '')) * 100)
const HttpError = class extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message)
}
const text = z.string().trim().max(12000)
const id = z.string().regex(/^[a-z0-9-]{1,80}$/)
const cents = z.number().int().min(1).max(100000000)
const textTranslation = z.object({
  description: text.optional(),
  specs: z.array(text).max(50).optional(),
  quoteText: text.optional(),
  label: text.max(120).optional(),
  paragraphs: z.array(text).max(50).optional(),
}).strict()
const translations = z.partialRecord(z.enum(TRANSLATION_LOCALES), textTranslation).optional()
const image = z.object({
  src: z.string().regex(/^(img\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)|uploads\/[a-f0-9-]+\.webp)$/),
  alt: text.max(500),
  altTranslations: z.partialRecord(z.enum(TRANSLATION_LOCALES), text.max(500)).optional(),
  name: text.max(200).optional(),
})
const variantSchema = z.object({
  id,
  label: text.min(1).max(120),
  swatch: z
    .array(z.string().regex(/^#[a-fA-F0-9]{6}$/))
    .min(1)
    .max(2),
  codes: z.array(text.max(80)).max(20),
  priceCents: cents,
  images: z.array(image).max(30),
  specs: z.array(text).max(50).optional(),
  translations,
})
const modelSchema = z.object({
  id,
  name: text.min(1).max(120),
  codes: z.array(text.max(80)).max(20),
  priceCents: cents,
  availability: z.enum(['buy', 'no-buy', 'out-of-stock', 'hidden']),
  gender: z.enum(GENDERS).default('unisex'),
  limitedEdition: z.boolean().optional(),
  piecesRemaining: z.number().int().min(0).max(9999).nullable().optional(),
  isNew: z.boolean().optional(),
  similar: z.array(id).max(50).optional(),
  description: text.optional(),
  quote: z.object({ text, author: text.optional() }).optional(),
  specs: z.array(text).max(50),
  images: z.array(image).max(30),
  variants: z.array(variantSchema).max(20).optional(),
  translations,
})
const perfumeSchema = z.object({
  id,
  name: text.min(1).max(120),
  code: text.max(80),
  // 0 = no price yet (e.g. a coming-soon perfume); selling needs a price, checked on save.
  priceCents: z.number().int().min(0).max(100000000),
  availability: z.enum(PERFUME_AVAILABILITIES).default('no-buy'),
  line: text.max(120).optional(),
  paragraphs: z.array(text).max(50),
  specs: z.array(text).max(50),
  ingredients: z.array(text).max(100),
  quote: z.object({ text, author: text.optional() }),
  images: z.array(image).max(30),
  translations,
})
const cartSchema = z
  .array(
    z.object({
      kind: z.enum(['model', 'perfume']).default('model'),
      modelId: id,
      variantId: id.nullable(),
      quantity: z.number().int().min(1).max(10),
    }),
  )
  .min(1)
  .max(30)
// The warranty certificate holder; required whenever the cart holds a watch, null for perfume-only orders. No PayPal-name fallback.
const certificateSchema = z
  .object({ firstName: text.min(1).max(80), lastName: text.min(1).max(80), email: z.string().trim().email().max(254) })
  .strict()
  .nullable()
const limitedEditions = new Set(['tutus-ab-uno', 'takimo', 'bauletto'])
// Site photos shown outside the catalog that v5 ensures: the Storia main photo, the workshop portrait and the territory view.
const pageImages = [storia.image, officina.image, territorio.image].map(({ src, alt }) => ({ src, alt }))
// The coming-soon box was a site photo until v6; it is now Tesoro di Alarico's own image.
const comingSoonImage = 'img/profumo/coming-soon.jpg'
// Seeded perfumes carry cents from their display price (0 while unpriced) and an explicit availability.
const seedPerfume = (p) => ({ ...p, priceCents: p.price ? initialPrice(p.price) : 0, availability: p.availability ?? 'no-buy' })
// Photos of the retired Scalea section; v5 drops their slots.
const retiredImages = ['img/storia/scalea-borgo.jpg', 'img/storia/scalea-palazzo.jpg']
// N°7 Oud's original bottle photo; v7 swaps it, in the perfume and the site slots, for the client's new one.
const retiredOudImage = 'img/profumo/n7-oud.jpg'
const oudImage = (({ src, alt }) => ({ src, alt }))(profumo.images[0])
// Blank quote parts are dropped: no author key without an author.
const cleanQuote = ({ text, author }) => (author ? { text, author } : { text })

export function createApp(options = {}) {
  const env = options.env ?? process.env
  const root = resolve(import.meta.dirname, '..')
  const dataDir = resolve(options.dataDir ?? env.DATA_DIR ?? join(root, 'data'))
  mkdirSync(join(dataDir, 'uploads'), { recursive: true })
  const db = new DatabaseSync(join(dataDir, 'shop.sqlite'))
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS catalog (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, csrf TEXT NOT NULL, admin INTEGER NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, session TEXT NOT NULL, fingerprint TEXT NOT NULL, paypal_id TEXT UNIQUE, status TEXT NOT NULL, total INTEGER NOT NULL, items TEXT NOT NULL, receipt TEXT, created INTEGER NOT NULL, certificate TEXT, certificate_code TEXT);',
  )
  const orderColumns = new Set(db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name))
  for (const column of ['certificate', 'certificate_code'])
    if (!orderColumns.has(column)) db.exec(`ALTER TABLE orders ADD COLUMN ${column} TEXT`)
  if (!db.prepare('SELECT id FROM catalog').get()) {
    const seed = {
      hero: site.hero.image,
      models: models.map((m) => ({
        ...m,
        priceCents: initialPrice(m.price),
        availability: 'no-buy',
        limitedEdition: limitedEditions.has(m.id),
        piecesRemaining: null,
        variants: m.variants?.map((v) => ({ ...v, priceCents: initialPrice(v.price) })),
      })),
      photos: [],
      imageOverrides: {},
      siteImages: [
        site.hero.image,
        storia.image,
        ...storia.chapters.flatMap((c) => (c.image ? [c.image] : [])),
        officina.image,
        territorio.image,
        ...profumo.images,
      ],
      perfumes: [profumo, tesoroDiAlarico].map(seedPerfume),
      featured: [],
      catalogVersion: 8,
    }
    db.prepare('INSERT INTO catalog VALUES (1, 1, ?)').run(JSON.stringify(seed))
  }
  const storedCatalog = db.prepare('SELECT body FROM catalog WHERE id=1').get()
  const existing = JSON.parse(storedCatalog.body)
  // Pre-v4 catalogs held one optional perfume; a missing key means it predates the perfume editor.
  if (!Object.hasOwn(existing, 'perfume') && !Object.hasOwn(existing, 'perfumes')) {
    existing.perfume = { ...profumo, priceCents: initialPrice(profumo.price) }
    db.prepare('UPDATE catalog SET body=? WHERE id=1').run(JSON.stringify(existing))
  }
  if (existing.localizationVersion !== 1) {
    existing.models = existing.models.map(seedModelTranslations)
    if (existing.perfume) existing.perfume = seedPerfumeTranslations(existing.perfume)
    if (existing.perfumes) existing.perfumes = existing.perfumes.map(seedPerfumeTranslations)
    existing.hero = seedImageTranslations(existing.hero)
    existing.photos = existing.photos.map(seedImageTranslations)
    existing.siteImages = existing.siteImages.map(seedImageTranslations)
    existing.imageOverrides = Object.fromEntries(Object.entries(existing.imageOverrides).map(([source, image]) => [source, seedImageTranslations(image)]))
    existing.localizationVersion = 1
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(existing))
  }
  if ((existing.catalogVersion ?? 1) < 2) {
    // Legacy buyEnabled flag becomes the availability state; owner-chosen heroes are kept.
    existing.models = existing.models.map(({ buyEnabled, ...m }) => ({
      ...m,
      availability: m.availability ?? (buyEnabled ? 'buy' : 'no-buy'),
      limitedEdition: m.limitedEdition ?? limitedEditions.has(m.id),
      piecesRemaining: m.piecesRemaining ?? null,
    }))
    if (existing.hero?.src === 'img/hero/new_hero.jpg') existing.hero = seedImageTranslations(site.hero.image)
    if (!existing.siteImages.some((im) => im.src === site.hero.image.src)) existing.siteImages.push(seedImageTranslations(site.hero.image))
    existing.catalogVersion = 2
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(existing))
  }
  if (existing.catalogVersion < 3) {
    // The retired sold state reads as out of stock.
    existing.models = existing.models.map((m) => (m.availability === 'sold' ? { ...m, availability: 'out-of-stock' } : m))
    existing.catalogVersion = 3
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(existing))
  }
  if (existing.catalogVersion < 4) {
    // One optional perfume becomes a list; the homepage watch picks start empty.
    existing.perfumes = existing.perfume ? [{ id: profumo.id, ...existing.perfume }] : []
    delete existing.perfume
    existing.featured ??= []
    existing.catalogVersion = 4
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(existing))
  }
  if (existing.catalogVersion < 5) {
    // The redesigned page: Storia main photo and territory view join, the workshop portrait stays; Scalea photos leave.
    // Uploaded library files stay; only the slots and their replacements go.
    existing.siteImages = existing.siteImages.filter((im) => !retiredImages.includes(im.src))
    for (const src of retiredImages) delete existing.imageOverrides[src]
    for (const im of pageImages)
      if (!existing.siteImages.some((s) => s.src === im.src)) existing.siteImages.push(seedImageTranslations(im))
    existing.catalogVersion = 5
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(existing))
  }
  if (existing.catalogVersion < 6) {
    // Perfumes gain an availability state; Tesoro di Alarico is announced and takes over the coming-soon photo, which leaves the site slots.
    // Uploaded library files stay; only the slot and its replacement go.
    existing.perfumes = existing.perfumes.map((p) => ({ ...p, availability: p.availability ?? 'no-buy' }))
    if (!existing.perfumes.some((p) => p.id === tesoroDiAlarico.id))
      existing.perfumes.push(seedPerfumeTranslations(seedPerfume(tesoroDiAlarico)))
    existing.siteImages = existing.siteImages.filter((im) => im.src !== comingSoonImage)
    delete existing.imageOverrides[comingSoonImage]
    existing.catalogVersion = 6
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(existing))
  }
  if (existing.catalogVersion < 7) {
    // N°7 Oud gets the client's new bottle photo; other photos and owner uploads stay, and an owner replacement of the old slot moves to the new one.
    const swapOud = (im) => (im.src === retiredOudImage ? seedImageTranslations(oudImage) : im)
    existing.perfumes = existing.perfumes.map((p) => (p.id === profumo.id ? { ...p, images: p.images.map(swapOud) } : p))
    existing.siteImages = existing.siteImages.map(swapOud)
    if (Object.hasOwn(existing.imageOverrides, retiredOudImage)) {
      existing.imageOverrides[oudImage.src] = existing.imageOverrides[retiredOudImage]
      delete existing.imageOverrides[retiredOudImage]
    }
    existing.catalogVersion = 7
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(existing))
  }
  if (existing.catalogVersion < 8) {
    // Watches gain a line (Uomo/Donna/Unisex): seed watches take the old site's menu, owner-added ones are unisex.
    const seedGender = new Map(models.map((m) => [m.id, m.gender]))
    existing.models = existing.models.map((m) =>
      GENDERS.includes(m.gender) ? m : { ...m, gender: seedGender.get(m.id) ?? 'unisex' },
    )
    existing.catalogVersion = 8
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(existing))
  }
  const catalog = () => {
    const row = db.prepare('SELECT * FROM catalog WHERE id=1').get()
    return { ...JSON.parse(row.body), revision: row.revision }
  }
  const save = (body, revision) => {
    delete body.revision
    const result = db
      .prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1 AND revision=?')
      .run(JSON.stringify(body), revision)
    if (!result.changes) fail(409, 'Il catalogo è cambiato. Ricarica prima di salvare.')
    return catalog()
  }
  const app = express()
  app.disable('x-powered-by')
  if (env.TRUST_PROXY === '1') app.set('trust proxy', 1)
  const origin = new URL(env.APP_ORIGIN ?? 'http://localhost:5173').origin
  const production = env.NODE_ENV === 'production'
  if (production && !origin.startsWith('https://')) throw new Error('Production requires an HTTPS APP_ORIGIN')
  if (production && !/^[a-f0-9]{64}:[a-f0-9]{128}$/.test(env.ADMIN_PASSWORD_HASH ?? ''))
    throw new Error('Set ADMIN_PASSWORD_HASH before production startup')
  const cookieName = production ? '__Host-zito_session' : 'zito_session'
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  )
  app.use('/api', rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }))
  app.use('/api', express.json({ limit: '512kb' }))
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    const token = req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1)
    req.session =
      token && /^[a-f0-9]{64}$/.test(token)
        ? db.prepare('SELECT * FROM sessions WHERE id=? AND expires>?').get(digest(token), Date.now())
        : null
    next()
  })
  const issueSession = (res, admin) => {
    db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now())
    const token = randomBytes(32).toString('hex')
    const session = {
      id: digest(token),
      csrf: randomBytes(32).toString('hex'),
      admin: admin ? 1 : 0,
      expires: Date.now() + (admin ? 3600000 : 86400000),
    }
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(session.id, session.csrf, session.admin, session.expires)
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: production,
      sameSite: 'strict',
      path: '/',
      maxAge: admin ? 3600000 : 86400000,
    })
    return session
  }
  const csrf = (req, res, next) => {
    if (req.headers.origin !== origin || !req.session || req.headers['x-csrf-token'] !== req.session.csrf)
      return next(new HttpError(403, 'Sessione non valida. Ricarica la pagina.'))
    next()
  }
  const admin = (req, res, next) =>
    req.session?.admin ? next() : next(new HttpError(401, 'Accesso amministratore richiesto.'))
  app.get('/api/session', (req, res) => {
    const session = req.session ?? issueSession(res, false)
    res.json({ csrf: session.csrf, admin: !!session.admin })
  })
  const loginLimit = rateLimit({ windowMs: 900000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false })
  app.post('/api/admin/login', loginLimit, csrf, async (req, res) => {
    const password = z.string().min(1).max(256).parse(req.body.password)
    const hash = env.ADMIN_PASSWORD_HASH
    if (!hash) fail(503, 'Accesso non configurato sul server.')
    const [salt, expected] = hash.split(':')
    if (!/^[a-f0-9]{64}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(expected ?? ''))
      fail(503, 'Accesso non configurato sul server.')
    // Asynchronous scrypt keeps expensive password checks off the HTTP event loop.
    const { scrypt } = await import('node:crypto')
    const actual = await new Promise((resolve, reject) =>
      scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key))),
    )
    if (!timingSafeEqual(actual, Buffer.from(expected, 'hex'))) fail(401, 'Credenziali non valide.')
    db.prepare('DELETE FROM sessions WHERE id=?').run(req.session.id)
    const session = issueSession(res, true)
    res.json({ csrf: session.csrf, admin: true })
  })
  app.post('/api/admin/logout', csrf, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id=?').run(req.session.id)
    res.clearCookie(cookieName, { path: '/', httpOnly: true, secure: production, sameSite: 'strict' })
    res.json({ ok: true })
  })
  app.get('/api/catalog', (req, res) => {
    const body = catalog()
    if (!req.session?.admin) {
      body.models = body.models.filter((m) => m.availability !== 'hidden')
      body.perfumes = body.perfumes.filter((p) => p.availability !== 'hidden')
    }
    res.json(body)
  })
  const translateText = createTranslator({ fetch: options.translateFetch ?? fetch, email: env.MYMEMORY_EMAIL })
  const translateRequest = z.object({
    source: z.enum(LOCALES),
    target: z.enum(LOCALES),
    texts: z.array(z.string().max(5000)).min(1).max(50),
  }).strict()
  app.post('/api/admin/translate', admin, csrf, async (req, res) => {
    const { source, target, texts } = translateRequest.parse(req.body)
    if (source === target) fail(400, 'Lingue di traduzione non valide.')
    try {
      // Blank lines stay blank so line/paragraph structure survives the round trip.
      res.json({ texts: await Promise.all(texts.map((text) => (text.trim() ? translateText(text, source, target) : text))) })
    } catch {
      fail(502, 'Servizio di traduzione non disponibile. Riprova più tardi.')
    }
  })
  const revision = (req) => z.number().int().positive().parse(req.body.revision)
  const validImage = (im) => {
    if (!existsSync(join(im.src.startsWith('uploads/') ? dataDir : join(root, 'public'), im.src)))
      fail(400, 'Foto non trovata. Carica una foto dalla libreria.')
    return im
  }
  app.put('/api/admin/products/:id', admin, csrf, (req, res) => {
    const product = modelSchema.parse(req.body.product)
    if (product.id !== req.params.id) fail(400, 'Identificativo non valido.')
    product.images.forEach(validImage)
    product.variants?.forEach((v) => v.images.forEach(validImage))
    if (new Set(product.variants?.map((v) => v.id)).size !== (product.variants?.length ?? 0))
      fail(400, 'Identificativi variante duplicati.')
    if (product.quote && !product.quote.text && !product.quote.author) delete product.quote
    else if (product.quote) product.quote = cleanQuote(product.quote)
    const body = catalog()
    // Similar picks: known, distinct, never the product itself; order is the owner's.
    const known = new Set(body.models.map((m) => m.id))
    const similar = [...new Set(product.similar ?? [])].filter((s) => s !== product.id && known.has(s))
    const complete = {
      ...product,
      isNew: product.isNew ?? false,
      similar,
      price: displayPrice(product.priceCents),
      variants: product.variants?.map((v) => ({ ...v, price: displayPrice(v.priceCents) })),
    }
    const index = body.models.findIndex((m) => m.id === product.id)
    if (index < 0) body.models.push(complete)
    else body.models[index] = complete
    res.json(save(body, revision(req)))
  })
  app.delete('/api/admin/products/:id', admin, csrf, (req, res) => {
    const body = catalog()
    body.models = body.models
      .filter((m) => m.id !== req.params.id)
      .map((m) => (m.similar?.includes(req.params.id) ? { ...m, similar: m.similar.filter((s) => s !== req.params.id) } : m))
    body.featured = (body.featured ?? []).filter((f) => f !== req.params.id)
    res.json(save(body, revision(req)))
  })
  app.put('/api/admin/featured', admin, csrf, (req, res) => {
    const ids = z.array(id).max(50).parse(req.body.ids)
    const body = catalog()
    // Homepage picks: known, distinct; order is the owner's.
    const known = new Set(body.models.map((m) => m.id))
    const featured = [...new Set(ids)].filter((f) => known.has(f))
    if (featured.length > 4) fail(400, 'Massimo 4 orologi in evidenza.')
    body.featured = featured
    res.json(save(body, revision(req)))
  })
  app.put('/api/admin/hero', admin, csrf, (req, res) => {
    const body = catalog()
    body.hero = validImage(image.parse(req.body.image))
    res.json(save(body, revision(req)))
  })
  const replaceRequest = z.object({
    replacements: z.array(z.object({ source: image.shape.src, image })).min(1).max(50),
  })
  // A replaced slot keeps its own description; only a blank one takes the replacement's.
  const swap = ({ name, alt, altTranslations, ...slot }, next) => ({
    ...slot,
    src: next.src,
    ...(alt?.trim() ? { alt, altTranslations } : { alt: next.alt, altTranslations: next.altTranslations }),
    ...(next.name ? { name: next.name } : {}),
  })
  app.put('/api/admin/images/replace', admin, csrf, (req, res) => {
    const { replacements } = replaceRequest.parse(req.body)
    const bySource = new Map(replacements.map((r) => [r.source, r.image]))
    if (bySource.size !== replacements.length) fail(400, 'Foto duplicate nella sostituzione.')
    replacements.forEach((r) => validImage(r.image))
    const body = catalog()
    // One pass over the original state, so a replacement never chains into another.
    const used = new Set()
    const replace = (im) => {
      const next = bySource.get(im.src)
      if (!next) return im
      used.add(im.src)
      return swap(im, next)
    }
    if (body.hero) body.hero = replace(body.hero)
    body.models = body.models.map((m) => ({
      ...m,
      images: m.images.map(replace),
      ...(m.variants ? { variants: m.variants.map((v) => ({ ...v, images: v.images.map(replace) })) } : {}),
    }))
    body.perfumes = body.perfumes.map((p) => ({ ...p, images: p.images.map(replace) }))
    const shown = body.siteImages.map((s) => body.imageOverrides[s.src] ?? s)
    body.siteImages.forEach((s, index) => {
      const next = bySource.get(shown[index].src)
      if (!next) return
      used.add(shown[index].src)
      if (next.src === s.src) delete body.imageOverrides[s.src]
      else body.imageOverrides[s.src] = swap(shown[index], next)
    })
    if (used.size !== bySource.size) fail(400, 'Foto non trovata nel sito.')
    res.json(save(body, revision(req)))
  })
  app.put('/api/admin/perfumes/:id', admin, csrf, (req, res) => {
    const product = perfumeSchema.parse(req.body.product)
    if (product.id !== req.params.id) fail(400, 'Identificativo non valido.')
    product.images.forEach(validImage)
    if (product.availability === 'buy' && product.priceCents <= 0) fail(400, 'Prezzo richiesto per vendere il profumo.')
    product.quote = cleanQuote(product.quote)
    const body = catalog()
    // An unpriced perfume shows no price, as seeded.
    const price = product.priceCents ? displayPrice(product.priceCents) : ''
    const complete = { eyebrow: profumo.eyebrow, labels: profumo.labels, ...product, price }
    const index = body.perfumes.findIndex((p) => p.id === product.id)
    if (index < 0) body.perfumes.push(complete)
    else body.perfumes[index] = complete
    res.json(save(body, revision(req)))
  })
  app.delete('/api/admin/perfumes/:id', admin, csrf, (req, res) => {
    const body = catalog()
    body.perfumes = body.perfumes.filter((p) => p.id !== req.params.id)
    res.json(save(body, revision(req)))
  })
  // Browsers send filenames as raw UTF-8; busboy would otherwise read them as latin1.
  const upload = multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8',
    limits: { fileSize: 12 * 1024 * 1024, files: 20 },
  })
  app.post('/api/admin/photos', admin, csrf, upload.array('photo', 20), async (req, res) => {
    if (!req.files?.length) fail(400, 'Seleziona una foto JPG, PNG o WebP.')
    const rev = Number(req.body.revision)
    z.number().int().positive().parse(rev)
    const alt = text.max(500).parse(req.body.alt ?? '')
    const written = []
    try {
      const images = []
      for (const part of req.files) {
        const file = `${randomUUID()}.webp`
        written.push(file)
        try {
          const decoded = sharp(part.buffer, { limitInputPixels: 40000000, animated: false })
          const metadata = await decoded.metadata()
          if (!['jpeg', 'png', 'webp'].includes(metadata.format)) fail(400, 'Formato non consentito.')
          await decoded
            .rotate()
            .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 88 })
            .toFile(join(dataDir, 'uploads', file))
        } catch {
          fail(400, 'Immagine non valida o troppo grande.')
        }
        const name = part.originalname.replace(/\.[^.]*$/, '').trim().slice(0, 200)
        images.push({ src: `uploads/${file}`, alt, name })
      }
      const body = catalog()
      body.photos.push(...images)
      res.json({ catalog: save(body, rev), images })
    } catch (error) {
      for (const file of written) rmSync(join(dataDir, 'uploads', file), { force: true })
      throw error
    }
  })
  app.delete('/api/admin/photos/:id', admin, csrf, (req, res) => {
    const filename = z.string().uuid().parse(req.params.id)
    const src = `uploads/${filename}.webp`
    const body = catalog()
    const references = [
      body.hero,
      ...Object.values(body.imageOverrides),
      ...body.perfumes.flatMap((p) => p.images),
      ...body.models.flatMap((m) => [...m.images, ...(m.variants ?? []).flatMap((v) => v.images)]),
    ]
    if (references.some((im) => im.src === src)) fail(409, 'Foto in uso. Rimuovila dai prodotti o sostituiscila prima.')
    body.photos = body.photos.filter((im) => im.src !== src)
    res.json(save(body, revision(req)))
    // Keep the immutable file for in-flight customers and order history; prune offline after backup.
  })
  const orderFields = 'id, paypal_id, status, total, items, receipt, created, certificate, certificate_code'
  const orderRow = ({ certificate, certificate_code, ...o }) => ({
    ...o,
    items: JSON.parse(o.items),
    receipt: o.receipt ? JSON.parse(o.receipt) : null,
    certificate: certificate ? JSON.parse(certificate) : null,
    certificateCode: certificate_code,
  })
  app.get('/api/admin/orders', admin, (req, res) =>
    res.json(
      db.prepare(`SELECT ${orderFields} FROM orders ORDER BY created DESC LIMIT 200`).all().map(orderRow),
    ),
  )
  app.put('/api/admin/orders/:id/certificate', admin, csrf, (req, res) => {
    const code = z.string().trim().max(80).parse(req.body.code)
    const result = db.prepare('UPDATE orders SET certificate_code=? WHERE id=?').run(code || null, req.params.id)
    if (!result.changes) fail(404, 'Ordine non trovato.')
    res.json(orderRow(db.prepare(`SELECT ${orderFields} FROM orders WHERE id=?`).get(req.params.id)))
  })

  const paypalReady = !!env.PAYPAL_CLIENT_ID && !!env.PAYPAL_CLIENT_SECRET
  const paypalBase = env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  const fetcher = options.fetch ?? fetch
  let accessToken = null
  async function paypal(path, method = 'GET', body, requestId) {
    if (!paypalReady) fail(503, 'Pagamenti non ancora configurati. Contattaci per acquistare.')
    if (!accessToken || accessToken.expires < Date.now()) {
      const response = await fetcher(`${paypalBase}/v1/oauth2/token`, {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      })
      if (!response.ok) fail(502, 'PayPal non disponibile. Il carrello è conservato.')
      const token = await response.json()
      accessToken = { value: token.access_token, expires: Date.now() + token.expires_in * 1000 - 60000 }
    }
    const response = await fetcher(`${paypalBase}${path}`, {
      method,
      signal: AbortSignal.timeout(25000),
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const result = await response.json()
    if (!response.ok) fail(502, 'PayPal non ha completato la richiesta. Riprova con lo stesso ordine.')
    return result
  }
  // Limited-edition units held by captures awaiting PayPal. One app instance owns the SQLite catalog, so memory suffices.
  const reserved = new Map()
  // Only watches have counted pieces; stored lines from before perfume sales have no kind and are watches.
  const unitsByModel = (rows) => {
    const units = new Map()
    for (const row of rows)
      if ((row.kind ?? 'model') === 'model') units.set(row.modelId, (units.get(row.modelId) ?? 0) + row.quantity)
    return units
  }
  const hold = (rows) => {
    const units = unitsByModel(rows)
    for (const [id, n] of units) reserved.set(id, (reserved.get(id) ?? 0) + n)
    return units
  }
  const release = (units) => {
    for (const [id, n] of units ?? []) {
      const left = (reserved.get(id) ?? 0) - n
      if (left > 0) reserved.set(id, left)
      else reserved.delete(id)
    }
  }
  /** Lowers counted limited editions by the units sold; caller holds the transaction. */
  function consumePieces(rows) {
    const body = catalog()
    let changed = false
    for (const [id, n] of unitsByModel(rows)) {
      const m = body.models.find((m) => m.id === id)
      if (!m?.limitedEdition || m.piecesRemaining == null) continue
      m.piecesRemaining = Math.max(0, m.piecesRemaining - n)
      changed = true
    }
    if (!changed) return
    delete body.revision
    // Unconditional bump: stale admin tabs then get a revision conflict instead of restoring the old count.
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(body))
  }
  function resolveCart(input) {
    const rows = cartSchema.parse(input)
    const current = catalog()
    const keys = new Set()
    const items = rows.map((row) => {
      const key = `${row.kind}:${row.modelId}:${row.variantId ?? ''}`
      if (keys.has(key)) fail(400, 'Articolo duplicato nel carrello.')
      keys.add(key)
      if (row.kind === 'perfume') {
        const p = current.perfumes.find((p) => p.id === row.modelId)
        if (p?.availability !== 'buy' || row.variantId !== null)
          fail(409, 'Un prodotto non è più acquistabile. Aggiorna il carrello.')
        return { ...row, name: p.name, priceCents: p.priceCents, codes: p.code ? [p.code] : [] }
      }
      const m = current.models.find((m) => m.id === row.modelId)
      if (m?.availability !== 'buy' || (m.limitedEdition === true && m.piecesRemaining === 0))
        fail(409, 'Un prodotto non è più acquistabile. Aggiorna il carrello.')
      const v = row.variantId === null ? null : m.variants?.find((v) => v.id === row.variantId)
      if ((m.variants?.length && !v) || (row.variantId && !v)) fail(409, 'Variante non disponibile.')
      return {
        ...row,
        name: `${m.name}${v ? ` · ${v.label}` : ''}`,
        priceCents: v?.priceCents ?? m.priceCents,
        codes: v?.codes ?? m.codes,
      }
    })
    // Pieces are per model, so variants of one limited edition share the count.
    for (const [id, n] of unitsByModel(rows)) {
      const m = current.models.find((m) => m.id === id)
      if (m.limitedEdition === true && m.piecesRemaining != null && n + (reserved.get(id) ?? 0) > m.piecesRemaining)
        fail(409, 'Pezzi disponibili insufficienti. Aggiorna il carrello.')
    }
    return items
  }
  app.get('/api/payments/config', (req, res) =>
    res.json({ enabled: paypalReady, environment: env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox', currency: 'EUR' }),
  )
  const locks = new Map()
  async function single(key, fn) {
    if (locks.has(key)) fail(409, 'Richiesta già in corso. Attendi e riprova.')
    locks.set(key, true)
    try {
      return await fn()
    } finally {
      locks.delete(key)
    }
  }
  app.post('/api/payments/orders', csrf, async (req, res) =>
    single(req.session.id, async () => {
      const items = resolveCart(req.body.items)
      const total = items.reduce((sum, row) => sum + row.priceCents * row.quantity, 0)
      if (total > 100000000) fail(400, 'Importo ordine troppo alto.')
      const requestId = z.string().uuid().parse(req.body.requestId)
      // The warranty certificate belongs to watches: required when the cart holds one, null for perfume-only orders.
      const holderSchema = items.some((row) => row.kind === 'model') ? certificateSchema.unwrap() : certificateSchema
      const holder = holderSchema.parse(req.body.certificate)
      const certificateJson = holder ? JSON.stringify(holder) : null
      const fingerprint = digest(JSON.stringify(items))
      let order = db.prepare('SELECT * FROM orders WHERE id=?').get(requestId)
      if (order && (order.session !== req.session.id || order.fingerprint !== fingerprint))
        fail(409, 'Carrello cambiato. Avvia un nuovo ordine.')
      if (order?.status === 'COMPLETED') fail(409, 'Ordine già pagato.')
      if (order) db.prepare('UPDATE orders SET certificate=? WHERE id=?').run(certificateJson, requestId)
      else {
        db.prepare(
          'INSERT INTO orders (id,session,fingerprint,status,total,items,created,certificate) VALUES (?,?,?,?,?,?,?,?)',
        ).run(requestId, req.session.id, fingerprint, 'CREATING', total, JSON.stringify(items), Date.now(), certificateJson)
        order = db.prepare('SELECT * FROM orders WHERE id=?').get(requestId)
      }
      if (order.paypal_id) {
        const remote = await paypal(`/v2/checkout/orders/${order.paypal_id}`)
        const link = remote.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action')?.href
        if (link) return res.json({ id: order.paypal_id, approvalUrl: link, requestId })
        fail(409, 'Ordine già approvato. Torna alla conferma del pagamento.')
      }
      const remote = await paypal(
        '/v2/checkout/orders',
        'POST',
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: requestId,
              custom_id: requestId,
              amount: {
                currency_code: 'EUR',
                value: money(total),
                breakdown: { item_total: { currency_code: 'EUR', value: money(total) } },
              },
              items: items.map((row) => ({
                name: row.name.slice(0, 127),
                ...(row.codes.length ? { sku: row.codes.join(',').slice(0, 127) } : {}),
                quantity: String(row.quantity),
                unit_amount: { currency_code: 'EUR', value: money(row.priceCents) },
                category: 'PHYSICAL_GOODS',
              })),
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: 'ZITO 1950®',
                user_action: 'PAY_NOW',
                shipping_preference: 'GET_FROM_FILE',
                return_url: `${origin}/?checkout=return`,
                cancel_url: `${origin}/?checkout=cancel`,
              },
            },
          },
        },
        requestId,
      )
      const approvalUrl = remote.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href
      if (
        !remote.id ||
        !approvalUrl ||
        !/^https:\/\/(www\.paypal\.com|www\.sandbox\.paypal\.com|sandbox\.paypal\.com)\/checkoutnow\?/.test(approvalUrl)
      )
        fail(502, 'Risposta PayPal non valida.')
      db.prepare('UPDATE orders SET paypal_id=?, status=? WHERE id=?').run(remote.id, remote.status, requestId)
      res.json({ id: remote.id, approvalUrl, requestId })
    }),
  )
  app.post('/api/payments/orders/:id/capture', csrf, async (req, res) =>
    single(req.params.id, async () => {
      const order = db
        .prepare('SELECT * FROM orders WHERE paypal_id=? AND session=?')
        .get(req.params.id, req.session.id)
      if (!order) fail(404, 'Ordine non trovato in questa sessione.')
      if (order.status === 'COMPLETED') return res.json({ status: 'COMPLETED', id: order.id })
      let remote = await paypal(`/v2/checkout/orders/${order.paypal_id}`)
      let held = null
      try {
        if (remote.status !== 'COMPLETED') {
          const currentItems = resolveCart(JSON.parse(order.items))
          if (digest(JSON.stringify(currentItems)) !== order.fingerprint)
            fail(409, 'Prezzi o disponibilità cambiati. Avvia un nuovo ordine.')
          // Synchronous with the stock check, so a concurrent capture sees these units as taken.
          held = hold(currentItems)
          remote = await paypal(`/v2/checkout/orders/${order.paypal_id}/capture`, 'POST', {}, `capture-${order.id}`)
        }
        const units = remote.purchase_units ?? []
        const captures = units.flatMap((u) => u.payments?.captures ?? [])
        if (
          remote.status !== 'COMPLETED' ||
          captures.length !== 1 ||
          captures[0].status !== 'COMPLETED' ||
          captures[0].amount?.currency_code !== 'EUR' ||
          captures[0].amount?.value !== money(order.total) ||
          units[0]?.custom_id !== order.id
        )
          fail(409, 'Pagamento non confermato. Non ripetere l’acquisto: riprova la verifica o contattaci.')
        const email = remote.payer?.email_address ?? remote.payment_source?.paypal?.email_address
        const receipt = {
          captureId: captures[0].id,
          email,
          shipping: units[0]?.shipping,
          payer: remote.payer
            ? { firstName: remote.payer.name?.given_name ?? '', lastName: remote.payer.name?.surname ?? '', email }
            : null,
        }
        // Completion and stock decrement commit together; the status guard keeps a recovered capture from counting twice.
        db.exec('BEGIN IMMEDIATE')
        try {
          const done = db
            .prepare("UPDATE orders SET status='COMPLETED', receipt=? WHERE id=? AND status!='COMPLETED'")
            .run(JSON.stringify(receipt), order.id)
          if (done.changes) consumePieces(JSON.parse(order.items))
          db.exec('COMMIT')
        } catch (error) {
          db.exec('ROLLBACK')
          throw error
        }
      } finally {
        release(held)
      }
      res.json({ status: 'COMPLETED', id: order.id })
    }),
  )
  app.use('/uploads', express.static(join(dataDir, 'uploads'), { immutable: true, maxAge: '1y', dotfiles: 'deny' }))
  const dist = join(root, 'dist')
  app.use(express.static(dist, { index: false }))
  app.get(['/', '/admin'], (req, res) => res.sendFile(join(dist, 'index.html')))
  app.use((req, res) => res.status(404).json({ error: 'Risorsa non trovata.' }))
  app.use((error, req, res, next) => {
    const status =
      error instanceof z.ZodError || error instanceof multer.MulterError || error.type === 'entity.parse.failed'
        ? 400
        : (error.status ?? 500)
    if (status >= 500) console.error('Request failed:', error.name, error.message)
    res
      .status(status)
      .json({
        error:
          status === 400
            ? 'Dati non validi. Controlla i campi e le dimensioni della foto.'
            : status === 500
              ? 'Errore del server. Riprova.'
              : error.message,
      })
  })
  return { app, db, close: () => db.close() }
}
