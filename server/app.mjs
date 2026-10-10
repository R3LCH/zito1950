import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'
import sharp from 'sharp'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, createHash, timingSafeEqual, randomUUID } from 'node:crypto'
import { mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { z } from 'zod'
import { models, site, storia, profumo } from '../src/data/content.ts'
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
  availability: z.enum(['buy', 'no-buy', 'sold', 'out-of-stock', 'hidden']),
  limitedEdition: z.boolean().optional(),
  piecesRemaining: z.number().int().min(0).max(9999).nullable().optional(),
  description: text.optional(),
  quote: z.object({ text, author: text.optional() }).optional(),
  specs: z.array(text).max(50),
  images: z.array(image).max(30),
  variants: z.array(variantSchema).max(20).optional(),
  translations,
})
const perfumeSchema = z.object({
  name: text.min(1).max(120),
  code: text.max(80),
  priceCents: cents,
  paragraphs: z.array(text).max(50),
  specs: z.array(text).max(50),
  ingredients: z.array(text).max(100),
  quote: z.object({ text, author: text.optional() }),
  images: z.array(image).max(30),
  translations,
})
const cartSchema = z
  .array(z.object({ modelId: id, variantId: id.nullable(), quantity: z.number().int().min(1).max(10) }))
  .min(1)
  .max(30)
const certificateSchema = z
  .object({ firstName: text.min(1).max(80), lastName: text.min(1).max(80), email: z.string().trim().email().max(254) })
  .strict()
  .nullable()
  .optional()
const limitedEditions = new Set(['tutus-ab-uno', 'takimo', 'bauletto'])
const placeImages = (storia.place?.images ?? []).map(({ src, alt }) => ({ src, alt }))

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
        ...storia.chapters.flatMap((c) => (c.image ? [c.image] : [])),
        ...placeImages,
        ...profumo.images,
      ],
      catalogVersion: 2,
    }
    db.prepare('INSERT INTO catalog VALUES (1, 1, ?)').run(JSON.stringify(seed))
  }
  const storedCatalog = db.prepare('SELECT body FROM catalog WHERE id=1').get()
  const existing = JSON.parse(storedCatalog.body)
  if (!Object.hasOwn(existing, 'perfume')) {
    existing.perfume = { ...profumo, priceCents: initialPrice(profumo.price) }
    db.prepare('UPDATE catalog SET body=? WHERE id=1').run(JSON.stringify(existing))
  }
  if (existing.localizationVersion !== 1) {
    existing.models = existing.models.map(seedModelTranslations)
    if (existing.perfume) existing.perfume = seedPerfumeTranslations(existing.perfume)
    existing.hero = seedImageTranslations(existing.hero)
    existing.photos = existing.photos.map(seedImageTranslations)
    existing.siteImages = existing.siteImages.map(seedImageTranslations)
    existing.imageOverrides = Object.fromEntries(Object.entries(existing.imageOverrides).map(([source, image]) => [source, seedImageTranslations(image)]))
    existing.localizationVersion = 1
    db.prepare('UPDATE catalog SET body=?, revision=revision+1 WHERE id=1').run(JSON.stringify(existing))
  }
  if (existing.catalogVersion !== 2) {
    // Legacy buyEnabled flag becomes the availability state; owner-chosen heroes are kept.
    existing.models = existing.models.map(({ buyEnabled, ...m }) => ({
      ...m,
      availability: m.availability ?? (buyEnabled ? 'buy' : 'no-buy'),
      limitedEdition: m.limitedEdition ?? limitedEditions.has(m.id),
      piecesRemaining: m.piecesRemaining ?? null,
    }))
    if (existing.hero?.src === 'img/hero/new_hero.jpg') existing.hero = seedImageTranslations(site.hero.image)
    const known = new Set(existing.siteImages.map((im) => im.src))
    for (const im of [site.hero.image, ...placeImages])
      if (!known.has(im.src)) {
        known.add(im.src)
        existing.siteImages.push(seedImageTranslations(im))
      }
    existing.catalogVersion = 2
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
    if (!req.session?.admin) body.models = body.models.filter((m) => m.availability !== 'hidden')
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
    const complete = {
      ...product,
      price: displayPrice(product.priceCents),
      variants: product.variants?.map((v) => ({ ...v, price: displayPrice(v.priceCents) })),
    }
    const body = catalog()
    const index = body.models.findIndex((m) => m.id === product.id)
    if (index < 0) body.models.push(complete)
    else body.models[index] = complete
    res.json(save(body, revision(req)))
  })
  app.delete('/api/admin/products/:id', admin, csrf, (req, res) => {
    const body = catalog()
    body.models = body.models.filter((m) => m.id !== req.params.id)
    res.json(save(body, revision(req)))
  })
  app.put('/api/admin/hero', admin, csrf, (req, res) => {
    const body = catalog()
    body.hero = validImage(image.parse(req.body.image))
    res.json(save(body, revision(req)))
  })
  app.put('/api/admin/image', admin, csrf, (req, res) => {
    const body = catalog()
    const source = image.shape.src.parse(req.body.source)
    if (!body.siteImages.some((im) => im.src === source)) fail(400, 'Foto del sito non valida.')
    body.imageOverrides[source] = validImage(image.parse(req.body.image))
    res.json(save(body, revision(req)))
  })
  app.put('/api/admin/perfume', admin, csrf, (req, res) => {
    const body = catalog()
    const product = req.body.product === null ? null : perfumeSchema.parse(req.body.product)
    product?.images.forEach(validImage)
    body.perfume = product ? { ...profumo, ...product, price: displayPrice(product.priceCents) } : null
    res.json(save(body, revision(req)))
  })
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1 } })
  app.post('/api/admin/photos', admin, csrf, upload.single('photo'), async (req, res) => {
    if (!req.file) fail(400, 'Seleziona una foto JPG, PNG o WebP.')
    const rev = Number(req.body.revision)
    z.number().int().positive().parse(rev)
    const alt = text.max(500).parse(req.body.alt ?? '')
    const file = `${randomUUID()}.webp`
    try {
      const decoded = sharp(req.file.buffer, { limitInputPixels: 40000000, animated: false })
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
    const body = catalog()
    body.photos.push({ src: `uploads/${file}`, alt })
    try {
      res.json(save(body, rev))
    } catch (error) {
      const { unlinkSync } = await import('node:fs')
      unlinkSync(join(dataDir, 'uploads', file))
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
      ...(body.perfume?.images ?? []),
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
  function resolveCart(input) {
    const rows = cartSchema.parse(input)
    const current = catalog()
    const keys = new Set()
    return rows.map((row) => {
      const key = `${row.modelId}:${row.variantId}`
      if (keys.has(key)) fail(400, 'Articolo duplicato nel carrello.')
      keys.add(key)
      const m = current.models.find((m) => m.id === row.modelId)
      if (m?.availability !== 'buy') fail(409, 'Un prodotto non è più acquistabile. Aggiorna il carrello.')
      const v = row.variantId === null ? null : m.variants?.find((v) => v.id === row.variantId)
      if ((m.variants?.length && !v) || (row.variantId && !v)) fail(409, 'Variante non disponibile.')
      return {
        ...row,
        name: `${m.name}${v ? ` · ${v.label}` : ''}`,
        priceCents: v?.priceCents ?? m.priceCents,
        codes: v?.codes ?? m.codes,
      }
    })
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
      const certificate = certificateSchema.parse(req.body.certificate)
      const certificateJson = certificate ? JSON.stringify(certificate) : null
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
                brand_name: 'ZITO 1950',
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
      if (remote.status !== 'COMPLETED') {
        const currentItems = resolveCart(JSON.parse(order.items))
        if (digest(JSON.stringify(currentItems)) !== order.fingerprint)
          fail(409, 'Prezzi o disponibilità cambiati. Avvia un nuovo ordine.')
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
      db.prepare('UPDATE orders SET status=?, receipt=? WHERE id=?').run('COMPLETED', JSON.stringify(receipt), order.id)
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
