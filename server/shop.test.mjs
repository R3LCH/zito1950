import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import sharp from 'sharp'
import { createApp } from './app.mjs'
import { hashPassword } from './password.mjs'

async function fixture(t, paypal = false, legacyBody = null) {
  const dir = mkdtempSync(join(tmpdir(), 'zito-test-'))
  const remoteOrders = new Map()
  const seen = { captures: 0, amounts: [], mismatch: false, lostCapture: false, declineCapture: false }
  const transport = async (url, init) => {
    if (url.endsWith('/token')) return Response.json({ access_token: 'test-token', expires_in: 3600 })
    if (url.endsWith('/v2/checkout/orders')) {
      const body = JSON.parse(init.body)
      seen.amounts.push(body.purchase_units[0].amount.value)
      const remote = {
        id: `PP-${remoteOrders.size + 1}`,
        status: 'CREATED',
        purchase_units: body.purchase_units,
        payer: { name: { given_name: 'Mario', surname: 'Rossi' }, email_address: 'mario@example.com' },
        links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST' }],
      }
      remoteOrders.set(remote.id, remote)
      return Response.json(remote)
    }
    const key = url.split('/orders/')[1].split('/')[0]
    const remote = remoteOrders.get(key)
    if (url.endsWith('/capture')) {
      // PayPal's real answer when the buyer's card or bank refuses the charge.
      if (seen.declineCapture)
        return Response.json(
          { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }], debug_id: 'TEST-DEBUG' },
          { status: 422 },
        )
      seen.captures++
      remote.status = 'COMPLETED'
      remote.purchase_units[0].payments = {
        captures: [
          {
            id: 'CAPTURE-1',
            status: 'COMPLETED',
            amount: { currency_code: 'EUR', value: seen.mismatch ? '0.01' : remote.purchase_units[0].amount.value },
          },
        ],
      }
      if (seen.lostCapture) {
        seen.lostCapture = false
        throw new Error('Connection lost after capture')
      }
      if (init.headers.Prefer !== 'return=representation') return Response.json({ id: remote.id, status: remote.status })
    }
    return Response.json(remote)
  }
  const env = {
    APP_ORIGIN: 'http://localhost:5173',
    ADMIN_PASSWORD_HASH: hashPassword('a-long-test-password'),
    ...(paypal ? { PAYPAL_CLIENT_ID: 'test', PAYPAL_CLIENT_SECRET: 'test' } : {}),
  }
  if (legacyBody) {
    // Pre-certificate schema and catalog body, as written by the previous release.
    const legacy = new DatabaseSync(join(dir, 'shop.sqlite'))
    legacy.exec(
      'CREATE TABLE catalog (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE orders (id TEXT PRIMARY KEY, session TEXT NOT NULL, fingerprint TEXT NOT NULL, paypal_id TEXT UNIQUE, status TEXT NOT NULL, total INTEGER NOT NULL, items TEXT NOT NULL, receipt TEXT, created INTEGER NOT NULL);',
    )
    legacy.prepare('INSERT INTO catalog VALUES (1, 1, ?)').run(JSON.stringify(legacyBody))
    legacy.close()
  }
  const translateFetch = async (url, init) =>
    Response.json([[[`[${new URL(url).searchParams.get('tl')}] ${new URLSearchParams(init.body).get('q')}`, 'x']]])
  // Never real SMTP in tests: the fake records every message, or throws while mail.fail is set.
  const mail = { sent: [], fail: false }
  const mailer = {
    configured: true,
    from: 'ZITO1950® <customer@zito1950.it>',
    owner: 'owner@example.com',
    async send(message) {
      if (mail.fail) throw new Error('SMTP down')
      mail.sent.push(message)
      return { skipped: false }
    },
  }
  const application = createApp({ env, dataDir: dir, fetch: transport, translateFetch, mailer })
  const server = application.app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    application.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const client = () => {
    let cookie = ''
    let csrf = ''
    return {
      async request(path, method = 'GET', body, overrides = {}) {
        const response = await fetch(`${base}/api${path}`, {
          method,
          headers: {
            Cookie: cookie,
            Origin: env.APP_ORIGIN,
            'X-CSRF-Token': csrf,
            ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...overrides,
          },
          ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
        })
        if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]
        const result = await response.json()
        if (result.csrf) csrf = result.csrf
        return { status: response.status, body: result, cookie, headers: response.headers }
      },
    }
  }
  const admin = client()
  await admin.request('/session')
  assert.equal((await admin.request('/admin/login', 'POST', { password: 'a-long-test-password' })).status, 200)
  const buyer = client()
  await buyer.request('/session')
  const enable = async (modelId = 'n7', availability = 'buy') => {
    const current = (await admin.request('/catalog')).body
    const product = current.models.find((m) => m.id === modelId)
    product.availability = availability
    const response = await admin.request(`/admin/products/${modelId}`, 'PUT', { product, revision: current.revision })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    return response.body
  }
  return { admin, buyer, client, enable, seen, application, dir, env, mail }
}

test('admin authorization, CSRF, session rotation and revocation', async (t) => {
  const { admin, buyer, client } = await fixture(t)
  const body = (await admin.request('/catalog')).body
  assert.equal((await buyer.request('/admin/products/n7', 'DELETE', { revision: body.revision })).status, 401)
  assert.equal(
    (
      await admin.request(
        '/admin/products/n7',
        'DELETE',
        { revision: body.revision },
        { Origin: 'https://attacker.example' },
      )
    ).status,
    403,
  )
  assert.equal(
    (await admin.request('/admin/products/n7', 'DELETE', { revision: body.revision }, { 'X-CSRF-Token': 'bad' }))
      .status,
    403,
  )
  const guest = client()
  const previous = await guest.request('/session')
  assert.match(previous.headers.get('set-cookie'), /HttpOnly/i)
  assert.match(previous.headers.get('set-cookie'), /SameSite=Strict/i)
  const login = await guest.request('/admin/login', 'POST', { password: 'a-long-test-password' })
  assert.notEqual(login.cookie, previous.cookie)
  assert.equal((await guest.request('/admin/orders', 'GET', undefined, { Cookie: previous.cookie })).status, 401)
  await admin.request('/admin/logout', 'POST', {})
  assert.equal((await admin.request('/admin/orders')).status, 401)
})

test('translation route requires admin session and CSRF, keeps blank lines', async (t) => {
  const { admin, buyer } = await fixture(t)
  const payload = { source: 'it', target: 'en', texts: ['Ciao', ''] }
  assert.equal((await buyer.request('/admin/translate', 'POST', payload)).status, 401)
  assert.equal((await admin.request('/admin/translate', 'POST', payload, { 'X-CSRF-Token': 'bad' })).status, 403)
  assert.equal((await admin.request('/admin/translate', 'POST', { ...payload, target: 'it' })).status, 400)
  const ok = await admin.request('/admin/translate', 'POST', payload)
  assert.equal(ok.status, 200)
  // MyMemory gets the Google-shaped fake body, rejects it, and the fallback answers.
  assert.deepEqual(ok.body.texts, ['[en] Ciao', ''])
})

test('catalog mutations persist, reject stale revisions, and protect used uploads', async (t) => {
  const { admin, enable, application } = await fixture(t)
  const catalog = await enable()
  const product = catalog.models.find((m) => m.id === 'n7')
  product.description = 'Descrizione aggiornata'
  product.variants[0].priceCents = 12345
  const saved = await admin.request('/admin/products/n7', 'PUT', { product, revision: catalog.revision })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.models.find((m) => m.id === 'n7').variants[0].price, '123,45 EUR')
  assert.equal((await admin.request('/admin/products/n7', 'PUT', { product, revision: catalog.revision })).status, 409)
  const stored = JSON.parse(application.db.prepare('SELECT body FROM catalog').get().body)
  assert.equal(stored.models.find((m) => m.id === 'n7').description, 'Descrizione aggiornata')
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } })
    .png()
    .toBuffer()
  const form = new FormData()
  form.append('photo', new Blob([png], { type: 'image/png' }), '../../bad.png')
  form.append('alt', 'Test photo')
  form.append('revision', String(saved.body.revision))
  const uploaded = await admin.request('/admin/photos', 'POST', form)
  assert.equal(uploaded.status, 200)
  const [image] = uploaded.body.images
  assert.equal(image.name, 'bad')
  assert.deepEqual(uploaded.body.catalog.photos.at(-1), image)
  const hero = await admin.request('/admin/hero', 'PUT', { image, revision: uploaded.body.catalog.revision })
  assert.equal(hero.status, 200)
  assert.equal(
    (
      await admin.request(`/admin/photos/${image.src.split('/')[1].replace('.webp', '')}`, 'DELETE', {
        revision: hero.body.revision,
      })
    ).status,
    409,
  )
  const invalid = new FormData()
  invalid.append('photo', new Blob(['<svg><script>alert(1)</script></svg>']), 'evil.svg')
  invalid.append('revision', String(hero.body.revision))
  assert.equal((await admin.request('/admin/photos', 'POST', invalid)).status, 400)
})

test('multilingual products retain shared identity, reject unsupported locales and fall back to Italian', async (t) => {
  const { admin, application } = await fixture(t)
  const { localizeModel } = await import('../src/data/localization.ts')
  let catalog = (await admin.request('/catalog')).body
  const product = structuredClone(catalog.models[0])
  const originalName = product.name
  product.id = 'multilingual-new'
  product.description = 'Descrizione italiana personalizzata'
  delete product.quote
  product.translations = { en: { description: 'Custom English description', specs: ['English specification'], quoteText: 'English-only quotation' }, uk: { description: 'Український опис' } }
  product.images[0].altTranslations = { de: 'Deutsche Bildbeschreibung' }
  const created = await admin.request(`/admin/products/${product.id}`, 'PUT', { product, revision: catalog.revision })
  assert.equal(created.status, 200)
  catalog = created.body
  const saved = JSON.parse(application.db.prepare('SELECT body FROM catalog').get().body).models.find(model => model.id === product.id)
  assert.equal(localizeModel(saved, 'en').name, originalName)
  assert.equal(localizeModel(saved, 'en').description, 'Custom English description')
  assert.equal(localizeModel(saved, 'uk').description, 'Український опис')
  assert.equal(localizeModel(saved, 'pl').description, product.description)
  assert.equal(localizeModel(saved, 'de').images[0].alt, 'Deutsche Bildbeschreibung')
  assert.equal(localizeModel(saved, 'en').quote.text, 'English-only quotation')
  assert.equal(localizeModel(saved, 'it').quote, undefined)
  product.translations.fr = { description: 'Unsupported' }
  assert.equal((await admin.request(`/admin/products/${product.id}`, 'PUT', { product, revision: catalog.revision })).status, 400)
  delete product.translations.fr
  product.translations.en.name = 'Forbidden translated product name'
  assert.equal((await admin.request(`/admin/products/${product.id}`, 'PUT', { product, revision: catalog.revision })).status, 400)
  delete product.translations.en.name
  product.translations.en.description = 'Updated English only'
  const updated = await admin.request(`/admin/products/${product.id}`, 'PUT', { product, revision: catalog.revision })
  assert.equal(updated.status, 200)
  const result = updated.body.models.find(model => model.id === product.id)
  assert.equal(result.description, 'Descrizione italiana personalizzata')
  assert.equal(result.translations.uk.description, 'Український опис')
  assert.equal(result.translations.en.description, 'Updated English only')
})

test('checkout uses server variant price, rejects disabled products and foreign sessions', async (t) => {
  const { buyer, admin, enable, seen, client } = await fixture(t, true)
  const items = [{ modelId: 'n7', variantId: 'blu', quantity: 2, priceCents: 1 }]
  // Read variant IDs from the catalog rather than assuming incidental names.
  const catalog = await enable()
  items[0].variantId = catalog.models.find((m) => m.id === 'n7').variants[0].id
  const order = await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })
  assert.equal(order.status, 200, JSON.stringify(order.body))
  assert.deepEqual(seen.amounts, ['1260.00'])
  const stranger = client()
  await stranger.request('/session')
  assert.equal((await stranger.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).status, 404)
  const current = (await admin.request('/catalog')).body
  const product = current.models.find((m) => m.id === 'n7')
  product.availability = 'no-buy'
  await admin.request('/admin/products/n7', 'PUT', { product, revision: current.revision })
  assert.equal((await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).status, 409)
  assert.equal(seen.captures, 0)
  assert.equal((await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })).status, 409)
})

test('capture recovers a lost response and never charges again after completion', async (t) => {
  const { buyer, admin, enable, seen } = await fixture(t, true)
  await enable('takimo')
  const request = { items: [{ modelId: 'takimo', variantId: null, quantity: 1 }], requestId: randomUUID() }
  const order = await buyer.request('/payments/orders', 'POST', request)
  assert.equal((await buyer.request('/payments/orders', 'POST', request)).body.id, order.body.id)
  assert.equal(seen.amounts.length, 1)
  seen.lostCapture = true
  assert.equal((await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).status, 500)
  const recovered = await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})
  assert.equal(recovered.body.status, 'COMPLETED')
  assert.equal((await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).body.status, 'COMPLETED')
  assert.equal(seen.captures, 1)
  const orders = (await admin.request('/admin/orders')).body
  assert.equal(orders[0].status, 'COMPLETED')
  assert.equal(orders[0].total, 239000)
  assert.equal(orders[0].receipt.captureId, 'CAPTURE-1')
})

test('mismatched PayPal capture amount is never recorded as paid', async (t) => {
  const { buyer, admin, enable, seen } = await fixture(t, true)
  await enable('takimo')
  seen.mismatch = true
  const order = await buyer.request('/payments/orders', 'POST', {
    items: [{ modelId: 'takimo', variantId: null, quantity: 1 }],
    requestId: randomUUID(),
  })
  assert.equal((await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).status, 409)
  assert.notEqual((await admin.request('/admin/orders')).body[0].status, 'COMPLETED')
})

test('a declined PayPal capture tells the buyer to pick another method and can still be paid afterwards', async (t) => {
  const { buyer, admin, enable, seen } = await fixture(t, true)
  await enable('takimo')
  const order = await buyer.request('/payments/orders', 'POST', {
    items: [{ modelId: 'takimo', variantId: null, quantity: 1 }],
    requestId: randomUUID(),
  })
  seen.declineCapture = true
  const declined = await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})
  assert.equal(declined.status, 409)
  assert.match(declined.body.error, /rifiutato/)
  assert.notEqual((await admin.request('/admin/orders')).body[0].status, 'COMPLETED')
  // The held piece is released, so the same order completes once the buyer fixes the method.
  seen.declineCapture = false
  assert.equal((await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).body.status, 'COMPLETED')
  assert.equal(seen.captures, 1)
})

test('legacy catalog migrates buyEnabled, limited editions and default hero once', async (t) => {
  const { models, storia, officina, territorio } = await import('../src/data/content.ts')
  const legacyBody = {
    hero: { src: 'img/hero/new_hero.jpg', alt: 'Boutique' },
    models: models.map((m) => ({ ...m, priceCents: 100000, buyEnabled: m.id === 'n7', variants: m.variants?.map((v) => ({ ...v, priceCents: 100000 })) })),
    photos: [],
    imageOverrides: {},
    siteImages: [{ src: 'img/hero/new_hero.jpg', alt: 'Boutique' }],
  }
  const { admin, buyer, application, dir, env } = await fixture(t, true, legacyBody)
  const catalog = (await admin.request('/catalog')).body
  const n7 = catalog.models.find((m) => m.id === 'n7')
  assert.equal(catalog.catalogVersion, 8)
  assert.equal(Object.hasOwn(catalog, 'perfume'), false)
  assert.deepEqual(catalog.perfumes.map((p) => p.id), ['n7-oud', 'tesoro-di-alarico'])
  assert.deepEqual(catalog.featured, [])
  assert.equal(n7.availability, 'buy')
  assert.equal(n7.buyEnabled, undefined)
  assert.equal(n7.limitedEdition, false)
  assert.equal(n7.piecesRemaining, null)
  assert.equal(catalog.models.find((m) => m.id === 'takimo').availability, 'no-buy')
  for (const limited of ['tutus-ab-uno', 'takimo', 'bauletto'])
    assert.equal(catalog.models.find((m) => m.id === limited).limitedEdition, true)
  assert.equal(catalog.hero.src, 'img/models/tutus-ab-uno.jpg')
  assert.ok(catalog.hero.altTranslations)
  for (const src of [storia.image.src, officina.image.src, territorio.image.src]) assert.equal(catalog.siteImages.filter((s) => s.src === src).length, 1)
  for (const src of ['img/storia/scalea-borgo.jpg', 'img/storia/scalea-palazzo.jpg', 'img/profumo/coming-soon.jpg'])
    assert.ok(!catalog.siteImages.some((s) => s.src === src))
  const columns = application.db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name)
  assert.ok(columns.includes('certificate') && columns.includes('certificate_code'))
  const order = await buyer.request('/payments/orders', 'POST', {
    items: [{ modelId: 'n7', variantId: n7.variants[0].id, quantity: 1 }],
    requestId: randomUUID(),
  })
  assert.equal(order.status, 200, JSON.stringify(order.body))
  // Reopening the same database must not migrate again or bump the revision.
  const reopened = createApp({ env, dataDir: dir })
  const reopenedRevision = reopened.db.prepare('SELECT revision FROM catalog').get().revision
  reopened.close()
  assert.equal(reopenedRevision, catalog.revision)
})

test('owner-customized hero survives migration', async (t) => {
  const { models } = await import('../src/data/content.ts')
  const legacyBody = {
    hero: { src: 'img/models/takimo.jpg', alt: 'Takimo' },
    models: models.map((m) => ({ ...m, priceCents: 100000, buyEnabled: false, variants: m.variants?.map((v) => ({ ...v, priceCents: 100000 })) })),
    photos: [],
    imageOverrides: {},
    siteImages: [],
  }
  const { admin } = await fixture(t, false, legacyBody)
  assert.equal((await admin.request('/catalog')).body.hero.src, 'img/models/takimo.jpg')
})

test('hidden models are omitted from the public catalog but kept for admin', async (t) => {
  const { admin, buyer, enable } = await fixture(t)
  await enable('n7', 'hidden')
  assert.equal((await buyer.request('/catalog')).body.models.some((m) => m.id === 'n7'), false)
  assert.equal((await admin.request('/catalog')).body.models.find((m) => m.id === 'n7').availability, 'hidden')
})

test('similar picks keep owner order, drop self/unknown/duplicates, and lose deleted models', async (t) => {
  const { admin } = await fixture(t)
  const catalog = (await admin.request('/catalog')).body
  const product = catalog.models.find((m) => m.id === 'takimo')
  product.isNew = true
  product.similar = ['n7', 'takimo', 'missing-model', 'n2', 'n7']
  const saved = await admin.request('/admin/products/takimo', 'PUT', { product, revision: catalog.revision })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  const stored = saved.body.models.find((m) => m.id === 'takimo')
  assert.deepEqual(stored.similar, ['n7', 'n2'])
  assert.equal(stored.isNew, true)
  const deleted = await admin.request('/admin/products/n7', 'DELETE', { revision: saved.body.revision })
  assert.equal(deleted.status, 200)
  assert.deepEqual(deleted.body.models.find((m) => m.id === 'takimo').similar, ['n2'])
})

test('out-of-stock, showcase and hidden models are not purchasable; sold is no longer a state', async (t) => {
  const { admin, buyer, enable } = await fixture(t, true)
  const items = [{ modelId: 'takimo', variantId: null, quantity: 1 }]
  for (const availability of ['out-of-stock', 'no-buy', 'hidden']) {
    await enable('takimo', availability)
    const order = await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })
    assert.equal(order.status, 409, availability)
  }
  const current = (await admin.request('/catalog')).body
  const product = { ...current.models.find((m) => m.id === 'takimo'), availability: 'sold' }
  assert.equal((await admin.request('/admin/products/takimo', 'PUT', { product, revision: current.revision })).status, 400)
  await enable('takimo', 'buy')
  assert.equal((await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })).status, 200)
})

const holder = { firstName: 'Giulia', lastName: 'Neri', email: 'giulia@example.com' }
const line = (changes = {}) => ({ modelId: 'takimo', variantId: null, quantity: 1, certificate: null, engraving: null, engravingAccepted: false, ...changes })

test('per-line certificate and engraving are validated, stored per item and returned to admin', async (t) => {
  const { admin, buyer, enable } = await fixture(t, true)
  await enable('takimo')
  const order = (items) => buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })
  for (const certificate of [
    { firstName: 'Anna', lastName: 'Bianchi', email: 'not-an-email' },
    { firstName: '   ', lastName: 'Bianchi', email: 'anna@example.com' },
    { firstName: 'Anna', lastName: '', email: 'anna@example.com' },
    { firstName: 'x'.repeat(81), lastName: 'Bianchi', email: 'anna@example.com' },
    { firstName: 'Anna', lastName: 'Bianchi', email: 'anna@example.com', extra: true },
  ])
    assert.equal((await order([line({ certificate })])).status, 400)
  const eleven = await order([line({ engraving: 'uno due tre quattro cinque sei sette otto nove dieci undici', engravingAccepted: true })])
  assert.equal(eleven.status, 400)
  assert.match(eleven.body.error, /10 parole/)
  assert.equal((await order([line({ engraving: 'x'.repeat(121), engravingAccepted: true })])).status, 400)
  const unaccepted = await order([line({ engraving: 'Per sempre' })])
  assert.equal(unaccepted.status, 400)
  assert.match(unaccepted.body.error, /restituito/)
  const many = await order([line({ quantity: 2, certificate: holder })])
  assert.equal(many.status, 400)
  assert.match(many.body.error, /quantità 1/)
  assert.equal((await order([line({ quantity: 2, engraving: 'Per sempre', engravingAccepted: true })])).status, 400)
  // Unpersonalized duplicates and identical personalized lines stay rejected.
  assert.equal((await order([line(), line()])).status, 400)
  assert.equal((await order([line({ certificate: holder }), line({ certificate: holder })])).status, 400)
  // Rejected attempts never created a row.
  assert.equal((await admin.request('/admin/orders')).body.length, 0)
  // Blank engraving means none, so no acceptance is needed; the same watch may repeat with different personalization.
  const ok = await order([
    line({ quantity: 2, engraving: '   ' }),
    line({ engraving: ' Per sempre ', engravingAccepted: true, certificate: { ...holder, firstName: ' Giulia ' } }),
    line({ engraving: 'A Luca', engravingAccepted: true }),
  ])
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  const [row] = (await admin.request('/admin/orders')).body
  assert.equal(row.total, 239000 * 4)
  assert.equal(row.certificate, null)
  assert.deepEqual(
    row.items.map((i) => [i.quantity, i.certificate, i.engraving, i.engravingAccepted]),
    [
      [2, null, null, false],
      [1, holder, 'Per sempre', true],
      [1, null, 'A Luca', true],
    ],
  )
  assert.match(row.items[0].image.src, /^img\//)
  assert.equal(row.fulfillment, null)
  assert.equal(row.publicToken, null)
  assert.deepEqual(row.emails, [])
})

test('order fingerprint includes personalization', async (t) => {
  const { buyer, enable } = await fixture(t, true)
  await enable('takimo')
  const requestId = randomUUID()
  const first = await buyer.request('/payments/orders', 'POST', { items: [line({ engraving: 'Uno', engravingAccepted: true })], requestId })
  assert.equal(first.status, 200, JSON.stringify(first.body))
  const changed = await buyer.request('/payments/orders', 'POST', { items: [line({ engraving: 'Due', engravingAccepted: true })], requestId })
  assert.equal(changed.status, 409)
})

test('certificate code route requires admin and CSRF, sets and clears the code', async (t) => {
  const { admin, buyer, enable } = await fixture(t, true)
  await enable('takimo')
  const requestId = randomUUID()
  await buyer.request('/payments/orders', 'POST', { items: [{ modelId: 'takimo', variantId: null, quantity: 1 }], requestId })
  const path = `/admin/orders/${requestId}/certificate`
  assert.equal((await buyer.request(path, 'PUT', { code: 'ZT-001' })).status, 401)
  assert.equal((await admin.request(path, 'PUT', { code: 'ZT-001' }, { 'X-CSRF-Token': 'bad' })).status, 403)
  assert.equal((await admin.request(`/admin/orders/${randomUUID()}/certificate`, 'PUT', { code: 'ZT-001' })).status, 404)
  assert.equal((await admin.request(path, 'PUT', { code: 'x'.repeat(81) })).status, 400)
  const set = await admin.request(path, 'PUT', { code: '  ZT-001  ' })
  assert.equal(set.status, 200)
  assert.equal(set.body.id, requestId)
  assert.equal(set.body.certificateCode, 'ZT-001')
  assert.equal((await admin.request('/admin/orders')).body[0].certificateCode, 'ZT-001')
  const cleared = await admin.request(path, 'PUT', { code: '' })
  assert.equal(cleared.body.certificateCode, null)
})

const savePieces = async (admin, modelId, piecesRemaining) => {
  const current = (await admin.request('/catalog')).body
  const product = { ...current.models.find((m) => m.id === modelId), availability: 'buy', piecesRemaining }
  const response = await admin.request(`/admin/products/${modelId}`, 'PUT', { product, revision: current.revision })
  assert.equal(response.status, 200, JSON.stringify(response.body))
}

test('version-2 catalog migrates sold models to out-of-stock once', async (t) => {
  const { models, profumo } = await import('../src/data/content.ts')
  const legacyBody = {
    hero: { src: 'img/models/takimo.jpg', alt: 'Takimo' },
    models: models.map((m) => ({
      ...m,
      priceCents: 100000,
      availability: m.id === 'takimo' ? 'sold' : 'buy',
      limitedEdition: false,
      piecesRemaining: null,
      variants: m.variants?.map((v) => ({ ...v, priceCents: 100000 })),
    })),
    perfume: { ...profumo, priceCents: 100000 },
    photos: [],
    imageOverrides: {},
    siteImages: [],
    localizationVersion: 1,
    catalogVersion: 2,
  }
  const { admin, dir, env } = await fixture(t, false, legacyBody)
  const catalog = (await admin.request('/catalog')).body
  assert.equal(catalog.catalogVersion, 8)
  assert.equal(catalog.revision, 7)
  assert.equal(catalog.models.find((m) => m.id === 'takimo').availability, 'out-of-stock')
  assert.equal(catalog.models.find((m) => m.id === 'n7').availability, 'buy')
  const reopened = createApp({ env, dataDir: dir })
  const reopenedRevision = reopened.db.prepare('SELECT revision FROM catalog').get().revision
  reopened.close()
  assert.equal(reopenedRevision, 7)
})

test('limited edition with zero pieces is sold out; unknown or positive pieces stay purchasable', async (t) => {
  const { admin, buyer } = await fixture(t, true)
  const items = [{ modelId: 'takimo', variantId: null, quantity: 1 }]
  await savePieces(admin, 'takimo', 0)
  const refused = await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })
  assert.equal(refused.status, 409)
  assert.equal(refused.body.error, 'Un prodotto non è più acquistabile. Aggiorna il carrello.')
  await savePieces(admin, 'takimo', 1)
  assert.equal((await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })).status, 200)
  await savePieces(admin, 'takimo', null)
  const order = await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })
  assert.equal(order.status, 200)
  // Capture re-resolves the cart, so pieces reaching zero after checkout also refuse payment.
  await savePieces(admin, 'takimo', 0)
  assert.equal((await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).status, 409)
})

test('paid captures consume limited pieces once, reserve the last piece, and leave uncounted models alone', async (t) => {
  const { admin, buyer, client, seen } = await fixture(t, true)
  const one = [{ modelId: 'takimo', variantId: null, quantity: 1 }]
  const pieces = async () => (await admin.request('/catalog')).body.models.find((m) => m.id === 'takimo').piecesRemaining
  await savePieces(admin, 'takimo', 2)
  const tooMany = await buyer.request('/payments/orders', 'POST', { items: [{ ...one[0], quantity: 3 }], requestId: randomUUID() })
  assert.equal(tooMany.status, 409)
  assert.equal(tooMany.body.error, 'Pezzi disponibili insufficienti. Aggiorna il carrello.')

  // A recovered capture response counts the sale exactly once.
  const stale = (await admin.request('/catalog')).body
  const first = await buyer.request('/payments/orders', 'POST', { items: one, requestId: randomUUID() })
  seen.lostCapture = true
  assert.equal((await buyer.request(`/payments/orders/${first.body.id}/capture`, 'POST', {})).status, 500)
  assert.equal(await pieces(), 2)
  assert.equal((await buyer.request(`/payments/orders/${first.body.id}/capture`, 'POST', {})).body.status, 'COMPLETED')
  assert.equal((await buyer.request(`/payments/orders/${first.body.id}/capture`, 'POST', {})).body.status, 'COMPLETED')
  assert.equal(await pieces(), 1)
  // The decrement bumps the revision, so an admin tab opened before the sale cannot restore the old count.
  const staleProduct = stale.models.find((m) => m.id === 'takimo')
  assert.equal((await admin.request('/admin/products/takimo', 'PUT', { product: staleProduct, revision: stale.revision })).status, 409)

  // Two shoppers race for the last piece: one is charged, the other is refused before capture.
  const other = client()
  await other.request('/session')
  const a = await buyer.request('/payments/orders', 'POST', { items: one, requestId: randomUUID() })
  const b = await other.request('/payments/orders', 'POST', { items: one, requestId: randomUUID() })
  assert.equal(a.status, 200)
  assert.equal(b.status, 200)
  const capturesBefore = seen.captures
  const results = await Promise.all([
    buyer.request(`/payments/orders/${a.body.id}/capture`, 'POST', {}),
    other.request(`/payments/orders/${b.body.id}/capture`, 'POST', {}),
  ])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
  assert.equal(seen.captures - capturesBefore, 1)
  assert.equal(await pieces(), 0)
  assert.equal((await buyer.request('/payments/orders', 'POST', { items: one, requestId: randomUUID() })).status, 409)

  // Without a count, sales never invent one.
  await savePieces(admin, 'takimo', null)
  const open = await buyer.request('/payments/orders', 'POST', { items: one, requestId: randomUUID() })
  assert.equal((await buyer.request(`/payments/orders/${open.body.id}/capture`, 'POST', {})).body.status, 'COMPLETED')
  assert.equal(await pieces(), null)
})

const pngFile = async (background) =>
  new Blob([await sharp({ create: { width: 20, height: 20, channels: 3, background } }).png().toBuffer()], {
    type: 'image/png',
  })

test('multi-file upload saves once, keeps order and UTF-8 names, and cleans up on failure', async (t) => {
  const { admin, dir } = await fixture(t)
  const catalog = (await admin.request('/catalog')).body
  const form = new FormData()
  form.append('photo', await pngFile('#fff'), 'Prima foto.png')
  form.append('photo', await pngFile('#000'), 'Ünïcode città.jpeg')
  form.append('photo', await pngFile('#f00'), 'terza')
  form.append('revision', String(catalog.revision))
  const uploaded = await admin.request('/admin/photos', 'POST', form)
  assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body))
  assert.deepEqual(
    uploaded.body.images.map((im) => im.name),
    ['Prima foto', 'Ünïcode città', 'terza'],
  )
  assert.ok(uploaded.body.images.every((im) => im.alt === '' && /^uploads\/[a-f0-9-]+\.webp$/.test(im.src)))
  assert.equal(uploaded.body.catalog.revision, catalog.revision + 1)
  assert.deepEqual(uploaded.body.catalog.photos, uploaded.body.images)
  assert.equal(readdirSync(join(dir, 'uploads')).length, 3)
  const broken = new FormData()
  broken.append('photo', await pngFile('#0f0'), 'buona.png')
  broken.append('photo', new Blob(['not an image']), 'rotta.png')
  broken.append('revision', String(uploaded.body.catalog.revision))
  assert.equal((await admin.request('/admin/photos', 'POST', broken)).status, 400)
  assert.equal(readdirSync(join(dir, 'uploads')).length, 3)
  const stale = new FormData()
  stale.append('photo', await pngFile('#00f'), 'vecchia.png')
  stale.append('revision', String(catalog.revision))
  assert.equal((await admin.request('/admin/photos', 'POST', stale)).status, 409)
  assert.equal(readdirSync(join(dir, 'uploads')).length, 3)
  const empty = new FormData()
  empty.append('revision', String(uploaded.body.catalog.revision))
  assert.equal((await admin.request('/admin/photos', 'POST', empty)).status, 400)
})

test('image replacement rewrites products and site slots, keeps slot alt, and restores originals', async (t) => {
  const { admin } = await fixture(t)
  const form = new FormData()
  form.append('photo', await pngFile('#fff'), 'Nuova.png')
  form.append('alt', 'Descrizione libreria')
  form.append('revision', String((await admin.request('/catalog')).body.revision))
  const { catalog, images: [photo] } = (await admin.request('/admin/photos', 'POST', form)).body
  // N°7 keeps its photographs on the variants, not the model.
  const n7Photo = (body) => body.models.find((m) => m.id === 'n7').variants[0].images[0]
  const n7Image = n7Photo(catalog)
  const slot = catalog.siteImages.find(
    (s) =>
      s.alt.trim() &&
      s.src !== catalog.hero.src &&
      !catalog.models.some((m) => [...m.images, ...(m.variants ?? []).flatMap((v) => v.images)].some((im) => im.src === s.src)) &&
      !catalog.perfumes.some((p) => p.images.some((im) => im.src === s.src)),
  )
  assert.ok(slot)
  assert.equal((await admin.request('/admin/image', 'PUT', { source: slot.src, image: photo, revision: catalog.revision })).status, 404)
  const replacements = [
    { source: n7Image.src, image: photo },
    { source: slot.src, image: photo },
  ]
  assert.equal(
    (await admin.request('/admin/images/replace', 'PUT', { replacements: [replacements[0], replacements[0]], revision: catalog.revision })).status,
    400,
  )
  const unknown = await admin.request('/admin/images/replace', 'PUT', {
    replacements: [{ source: 'img/models/missing.jpg', image: photo }],
    revision: catalog.revision,
  })
  assert.equal(unknown.status, 400)
  const replaced = await admin.request('/admin/images/replace', 'PUT', { replacements, revision: catalog.revision })
  assert.equal(replaced.status, 200, JSON.stringify(replaced.body))
  const model = n7Photo(replaced.body)
  assert.equal(model.src, photo.src)
  assert.equal(model.alt, n7Image.alt)
  assert.equal(model.name, 'Nuova')
  const override = replaced.body.imageOverrides[slot.src]
  assert.equal(override.src, photo.src)
  assert.equal(override.alt, slot.alt)
  assert.equal(override.name, 'Nuova')
  const restored = await admin.request('/admin/images/replace', 'PUT', {
    replacements: [{ source: photo.src, image: { src: slot.src, alt: slot.alt } }],
    revision: replaced.body.revision,
  })
  assert.equal(restored.status, 200, JSON.stringify(restored.body))
  assert.equal(Object.hasOwn(restored.body.imageOverrides, slot.src), false)
  const back = n7Photo(restored.body)
  assert.equal(back.src, slot.src)
  assert.equal(back.alt, n7Image.alt)
  assert.equal(back.name, undefined)
  assert.equal(
    (await admin.request('/admin/images/replace', 'PUT', { replacements, revision: catalog.revision })).status,
    400,
  )
})

test('product quotes drop blank parts', async (t) => {
  const { admin } = await fixture(t)
  const quoteAfterSave = async (quote) => {
    const current = (await admin.request('/catalog')).body
    const product = { ...current.models.find((m) => m.id === 'n7'), quote }
    const saved = await admin.request('/admin/products/n7', 'PUT', { product, revision: current.revision })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    return saved.body.models.find((m) => m.id === 'n7')
  }
  assert.equal(Object.hasOwn(await quoteAfterSave({ text: '  ', author: '' }), 'quote'), false)
  assert.deepEqual((await quoteAfterSave({ text: ' Testo ', author: ' ' })).quote, { text: 'Testo' })
  assert.deepEqual((await quoteAfterSave({ text: '', author: 'Autore' })).quote, { text: '', author: 'Autore' })
  const current = (await admin.request('/catalog')).body
  const perfume = await admin.request(`/admin/perfumes/${current.perfumes[0].id}`, 'PUT', {
    product: { ...current.perfumes[0], quote: { text: '', author: '' } },
    revision: current.revision,
  })
  assert.equal(perfume.status, 200, JSON.stringify(perfume.body))
  assert.deepEqual(perfume.body.perfumes[0].quote, { text: '' })
})

test('perfumes are added, edited, protect their photos and are removed by id', async (t) => {
  const { admin } = await fixture(t)
  const form = new FormData()
  form.append('photo', await pngFile('#000'), 'Flacone.png')
  form.append('revision', String((await admin.request('/catalog')).body.revision))
  const { catalog, images: [photo] } = (await admin.request('/admin/photos', 'POST', form)).body
  const product = {
    id: 'ambra',
    name: 'Ambra',
    code: 'ZPR08',
    priceCents: 9500,
    paragraphs: ['Calda.'],
    specs: [],
    ingredients: ['Ambra'],
    quote: { text: 'Citazione', author: '' },
    images: [photo],
  }
  const mismatch = await admin.request('/admin/perfumes/other', 'PUT', { product, revision: catalog.revision })
  assert.equal(mismatch.status, 400)
  const missingPhoto = await admin.request('/admin/perfumes/ambra', 'PUT', {
    product: { ...product, images: [{ src: 'uploads/missing.webp', alt: '' }] },
    revision: catalog.revision,
  })
  assert.equal(missingPhoto.status, 400)
  const added = await admin.request('/admin/perfumes/ambra', 'PUT', { product, revision: catalog.revision })
  assert.equal(added.status, 200, JSON.stringify(added.body))
  assert.deepEqual(added.body.perfumes.map((p) => p.id), ['n7-oud', 'tesoro-di-alarico', 'ambra'])
  const stored = added.body.perfumes[2]
  assert.equal(stored.price, '95,00 EUR')
  assert.deepEqual(stored.quote, { text: 'Citazione' })
  assert.ok(stored.eyebrow && stored.labels.ingredients && stored.labels.mailSubject)
  const fileId = photo.src.slice('uploads/'.length, -'.webp'.length)
  assert.equal((await admin.request(`/admin/photos/${fileId}`, 'DELETE', { revision: added.body.revision })).status, 409)
  const edited = await admin.request('/admin/perfumes/ambra', 'PUT', {
    product: { ...stored, name: 'Ambra Nera' },
    revision: added.body.revision,
  })
  assert.equal(edited.status, 200, JSON.stringify(edited.body))
  assert.equal(edited.body.perfumes.length, 3)
  assert.equal(edited.body.perfumes[2].name, 'Ambra Nera')
  const stale = await admin.request('/admin/perfumes/ambra', 'DELETE', { revision: added.body.revision })
  assert.equal(stale.status, 409)
  const removed = await admin.request('/admin/perfumes/ambra', 'DELETE', { revision: edited.body.revision })
  assert.equal(removed.status, 200)
  assert.deepEqual(removed.body.perfumes.map((p) => p.id), ['n7-oud', 'tesoro-di-alarico'])
  assert.equal((await admin.request(`/admin/photos/${fileId}`, 'DELETE', { revision: removed.body.revision })).status, 200)
  assert.equal((await admin.request('/admin/perfume', 'PUT', { product: null, revision: removed.body.revision })).status, 404)
})

test('featured picks keep owner order, drop unknown/duplicates, reject more than 4 and lose deleted models', async (t) => {
  const { admin, buyer } = await fixture(t)
  const catalog = (await admin.request('/catalog')).body
  assert.deepEqual(catalog.featured, [])
  const [a, b, c, d, e] = catalog.models.map((m) => m.id)
  assert.equal((await buyer.request('/admin/featured', 'PUT', { ids: [a], revision: catalog.revision })).status, 401)
  const tooMany = await admin.request('/admin/featured', 'PUT', { ids: [a, b, c, d, e], revision: catalog.revision })
  assert.equal(tooMany.status, 400)
  const saved = await admin.request('/admin/featured', 'PUT', {
    ids: [c, 'missing-model', a, c, b, d],
    revision: catalog.revision,
  })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.deepEqual(saved.body.featured, [c, a, b, d])
  const deleted = await admin.request(`/admin/products/${a}`, 'DELETE', { revision: saved.body.revision })
  assert.equal(deleted.status, 200)
  assert.deepEqual(deleted.body.featured, [c, b, d])
  assert.deepEqual((await buyer.request('/catalog')).body.featured, [c, b, d])
})

test('version-3 catalog turns the single perfume into a list once, and a removed perfume stays removed', async (t) => {
  const { models, profumo, tesoroDiAlarico, officina, storia, territorio } = await import('../src/data/content.ts')
  const v3 = (perfume) => ({
    hero: { src: 'img/models/takimo.jpg', alt: 'Takimo' },
    models: models.map((m) => ({
      ...m,
      priceCents: 100000,
      availability: 'buy',
      limitedEdition: false,
      piecesRemaining: null,
      variants: m.variants?.map((v) => ({ ...v, priceCents: 100000 })),
    })),
    perfume,
    imageOverrides: { 'img/storia/owner.jpg': { src: 'uploads/00000000-0000-0000-0000-000000000000.webp', alt: 'Ritratto caricato' } },
    siteImages: [
      { src: 'img/storia/scalea-borgo.jpg', alt: 'Borgo' },
      { src: 'img/storia/scalea-palazzo.jpg', alt: 'Palazzo' },
      { src: territorio.image.src, alt: 'Mare già presente' },
    ],
    photos: [{ src: 'uploads/00000000-0000-0000-0000-000000000000.webp', alt: 'Ritratto caricato' }],
    localizationVersion: 1,
    catalogVersion: 3,
  })
  const kept = await fixture(t, false, v3({ ...profumo, name: 'Oud del titolare', priceCents: 15000 }))
  const catalog = (await kept.admin.request('/catalog')).body
  assert.equal(catalog.catalogVersion, 8)
  assert.equal(catalog.revision, 6)
  assert.equal(Object.hasOwn(catalog, 'perfume'), false)
  assert.deepEqual(catalog.perfumes.map((p) => [p.id, p.name, p.priceCents]), [
    [profumo.id, 'Oud del titolare', 15000],
    [tesoroDiAlarico.id, tesoroDiAlarico.name, 0],
  ])
  assert.deepEqual(catalog.featured, [])
  // v5 drops the Scalea slots and adds the missing page photos; the workshop portrait keeps its replacement and the uploaded file stays in the library.
  assert.deepEqual(catalog.siteImages.map((im) => im.src), [territorio.image.src, storia.image.src, officina.image.src])
  assert.equal(catalog.siteImages[0].alt, 'Mare già presente')
  assert.deepEqual(Object.keys(catalog.imageOverrides), [officina.image.src])
  assert.equal(catalog.imageOverrides[officina.image.src].src, 'uploads/00000000-0000-0000-0000-000000000000.webp')
  assert.deepEqual(catalog.photos.map((p) => p.src), ['uploads/00000000-0000-0000-0000-000000000000.webp'])
  const reopened = createApp({ env: kept.env, dataDir: kept.dir })
  const reopenedBody = reopened.db.prepare('SELECT revision, body FROM catalog').get()
  reopened.close()
  assert.equal(reopenedBody.revision, 6)
  assert.equal(JSON.parse(reopenedBody.body).perfumes.length, 2)
  const removed = await fixture(t, false, v3(null))
  const empty = (await removed.admin.request('/catalog')).body
  assert.deepEqual(empty.perfumes.map((p) => p.id), [tesoroDiAlarico.id])
  const again = createApp({ env: removed.env, dataDir: removed.dir })
  const body = JSON.parse(again.db.prepare('SELECT body FROM catalog').get().body)
  again.close()
  assert.deepEqual(body.perfumes.map((p) => p.id), [tesoroDiAlarico.id])
  assert.equal(Object.hasOwn(body, 'perfume'), false)
})

const savePerfume = async (admin, perfumeId, changes) => {
  const current = (await admin.request('/catalog')).body
  const product = { ...current.perfumes.find((p) => p.id === perfumeId), ...changes }
  return admin.request(`/admin/perfumes/${perfumeId}`, 'PUT', { product, revision: current.revision })
}
const perfumeLine = (modelId, quantity = 1) => ({ kind: 'perfume', modelId, variantId: null, quantity })

test('a perfume set to buy is sold at the server price and needs no certificate', async (t) => {
  const { admin, buyer, enable, seen } = await fixture(t, true)
  const saved = await savePerfume(admin, 'tesoro-di-alarico', { availability: 'buy', priceCents: 13500, code: 'ZPR09' })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.equal(saved.body.perfumes.find((p) => p.id === 'tesoro-di-alarico').price, '135,00 EUR')
  const items = [{ ...perfumeLine('tesoro-di-alarico', 2), priceCents: 1 }]
  const order = await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })
  assert.equal(order.status, 200, JSON.stringify(order.body))
  assert.deepEqual(seen.amounts, ['270.00'])
  assert.equal((await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).body.status, 'COMPLETED')
  const [row] = (await admin.request('/admin/orders')).body
  assert.equal(row.status, 'COMPLETED')
  assert.equal(row.total, 27000)
  assert.equal(row.certificate, null)
  assert.deepEqual(
    row.items.map((i) => [i.kind, i.modelId, i.name, i.priceCents, i.codes]),
    [['perfume', 'tesoro-di-alarico', 'Tesoro di Alarico', 13500, ['ZPR09']]],
  )
  // A perfume never takes a variant.
  const variant = await buyer.request('/payments/orders', 'POST', {
    items: [{ ...perfumeLine('tesoro-di-alarico'), variantId: 'blu' }],
    requestId: randomUUID(),
  })
  assert.equal(variant.status, 409)
  // The certificate is optional per line, for watches too.
  await enable('takimo')
  const mixed = await buyer.request('/payments/orders', 'POST', {
    items: [{ modelId: 'takimo', variantId: null, quantity: 1 }, perfumeLine('tesoro-di-alarico')],
    requestId: randomUUID(),
  })
  assert.equal(mixed.status, 200, JSON.stringify(mixed.body))
  // Takimo at 2.390,00 EUR plus the perfume at 135,00 EUR.
  assert.equal(seen.amounts.at(-1), '2525.00')
})

test('coming-soon, showcase, out-of-stock and hidden perfumes are not purchasable', async (t) => {
  const { admin, buyer } = await fixture(t, true)
  const seeded = (await admin.request('/catalog')).body.perfumes
  assert.deepEqual(seeded.map((p) => [p.id, p.availability]), [['n7-oud', 'no-buy'], ['tesoro-di-alarico', 'coming-soon']])
  const order = (perfumeId) =>
    buyer.request('/payments/orders', 'POST', { items: [perfumeLine(perfumeId)], certificate: null, requestId: randomUUID() })
  for (const perfumeId of ['n7-oud', 'tesoro-di-alarico', 'missing-perfume']) {
    const refused = await order(perfumeId)
    assert.equal(refused.status, 409, perfumeId)
    assert.equal(refused.body.error, 'Un prodotto non è più acquistabile. Aggiorna il carrello.')
  }
  for (const availability of ['out-of-stock', 'hidden']) {
    assert.equal((await savePerfume(admin, 'n7-oud', { availability })).status, 200)
    assert.equal((await order('n7-oud')).status, 409, availability)
  }
  assert.equal((await savePerfume(admin, 'n7-oud', { availability: 'buy' })).status, 200)
  assert.equal((await order('n7-oud')).status, 200)
})

test('a perfume without a price cannot be set to buy', async (t) => {
  const { admin } = await fixture(t)
  assert.equal((await savePerfume(admin, 'tesoro-di-alarico', { availability: 'buy' })).status, 400)
  assert.equal((await savePerfume(admin, 'tesoro-di-alarico', { availability: 'buy', priceCents: -1 })).status, 400)
  const kept = await savePerfume(admin, 'tesoro-di-alarico', { availability: 'coming-soon', line: 'Pepe Nero' })
  assert.equal(kept.status, 200, JSON.stringify(kept.body))
  const stored = kept.body.perfumes.find((p) => p.id === 'tesoro-di-alarico')
  assert.deepEqual([stored.priceCents, stored.price, stored.code, stored.line], [0, '', '', 'Pepe Nero'])
  // A missing availability reads as showcase.
  const { availability, ...noState } = stored
  const current = (await admin.request('/catalog')).body
  const defaulted = await admin.request('/admin/perfumes/tesoro-di-alarico', 'PUT', { product: noState, revision: current.revision })
  assert.equal(defaulted.status, 200, JSON.stringify(defaulted.body))
  assert.equal(defaulted.body.perfumes.find((p) => p.id === 'tesoro-di-alarico').availability, 'no-buy')
})

test('hidden perfumes are omitted from the public catalog but kept for admin', async (t) => {
  const { admin, buyer } = await fixture(t)
  assert.equal((await savePerfume(admin, 'n7-oud', { availability: 'hidden' })).status, 200)
  assert.deepEqual((await buyer.request('/catalog')).body.perfumes.map((p) => p.id), ['tesoro-di-alarico'])
  assert.equal((await admin.request('/catalog')).body.perfumes.find((p) => p.id === 'n7-oud').availability, 'hidden')
})

test('version-5 catalog adds Tesoro di Alarico once, defaults perfume availability and drops the coming-soon slot', async (t) => {
  const { models, profumo, tesoroDiAlarico, officina } = await import('../src/data/content.ts')
  const upload = 'uploads/00000000-0000-0000-0000-000000000000.webp'
  const v5 = (perfumes) => ({
    hero: { src: 'img/models/takimo.jpg', alt: 'Takimo' },
    models: models.map((m) => ({
      ...m,
      priceCents: 100000,
      availability: 'buy',
      limitedEdition: false,
      piecesRemaining: null,
      variants: m.variants?.map((v) => ({ ...v, priceCents: 100000 })),
    })),
    perfumes,
    imageOverrides: { 'img/profumo/coming-soon.jpg': { src: upload, alt: 'Scatola caricata' } },
    siteImages: [
      { src: 'img/profumo/coming-soon.jpg', alt: 'Prossimamente' },
      { src: officina.image.src, alt: officina.image.alt },
    ],
    photos: [{ src: upload, alt: 'Scatola caricata' }],
    featured: [],
    localizationVersion: 1,
    catalogVersion: 5,
  })
  const legacyOud = { ...profumo, priceCents: 12000 }
  const migrated = await fixture(t, false, v5([legacyOud]))
  const catalog = (await migrated.admin.request('/catalog')).body
  assert.equal(catalog.catalogVersion, 8)
  assert.equal(catalog.revision, 4)
  assert.deepEqual(catalog.perfumes.map((p) => [p.id, p.availability, p.priceCents]), [
    [profumo.id, 'no-buy', 12000],
    [tesoroDiAlarico.id, 'coming-soon', 0],
  ])
  const tesoro = catalog.perfumes[1]
  assert.equal(tesoro.line, 'Pepe Nero')
  assert.ok(tesoro.translations && tesoro.images[0].altTranslations)
  assert.deepEqual(catalog.siteImages.map((im) => im.src), [officina.image.src])
  assert.deepEqual(catalog.imageOverrides, {})
  assert.deepEqual(catalog.photos.map((p) => p.src), [upload])
  const reopened = createApp({ env: migrated.env, dataDir: migrated.dir })
  const reopenedBody = reopened.db.prepare('SELECT revision, body FROM catalog').get()
  reopened.close()
  assert.equal(reopenedBody.revision, 4)
  assert.equal(JSON.parse(reopenedBody.body).perfumes.length, 2)
  // An owner who already added Tesoro keeps their entry; no duplicate is appended.
  const owned = await fixture(t, false, v5([legacyOud, { ...tesoroDiAlarico, availability: 'buy', priceCents: 9000 }]))
  const ownedPerfumes = (await owned.admin.request('/catalog')).body.perfumes
  assert.deepEqual(ownedPerfumes.map((p) => [p.id, p.availability, p.priceCents]), [
    [profumo.id, 'no-buy', 12000],
    [tesoroDiAlarico.id, 'buy', 9000],
  ])
})

test('version-6 catalog swaps the old N°7 Oud photo for the new one once, keeping owner replacements', async (t) => {
  const { models, profumo, tesoroDiAlarico, officina } = await import('../src/data/content.ts')
  const upload = 'uploads/00000000-0000-0000-0000-000000000000.webp'
  const oldSrc = 'img/profumo/n7-oud.jpg'
  const newSrc = 'img/profumo/nuovo.jpg'
  const journal = { src: 'img/profumo/n7-oud-journal.jpg', alt: 'Diario' }
  const v6 = (imageOverrides) => ({
    hero: { src: 'img/models/takimo.jpg', alt: 'Takimo' },
    models: models.map((m) => ({
      ...m,
      priceCents: 100000,
      availability: 'buy',
      limitedEdition: false,
      piecesRemaining: null,
      variants: m.variants?.map((v) => ({ ...v, priceCents: 100000 })),
    })),
    perfumes: [
      { ...profumo, priceCents: 12000, availability: 'no-buy', images: [{ src: oldSrc, alt: 'Flacone vecchio' }, journal] },
      { ...tesoroDiAlarico, priceCents: 0, availability: 'coming-soon' },
    ],
    imageOverrides,
    siteImages: [
      { src: officina.image.src, alt: officina.image.alt },
      { src: oldSrc, alt: 'Flacone vecchio' },
      journal,
    ],
    photos: [{ src: upload, alt: 'Flacone caricato' }],
    featured: [],
    localizationVersion: 1,
    catalogVersion: 6,
  })
  const migrated = await fixture(t, false, v6({}))
  const catalog = (await migrated.admin.request('/catalog')).body
  assert.equal(catalog.catalogVersion, 8)
  assert.equal(catalog.revision, 3)
  const oud = catalog.perfumes.find((p) => p.id === profumo.id)
  assert.deepEqual(oud.images.map((im) => im.src), [newSrc, journal.src])
  assert.equal(oud.images[0].alt, profumo.images[0].alt)
  assert.ok(oud.images[0].altTranslations)
  assert.equal(oud.images[1].alt, journal.alt)
  assert.deepEqual(catalog.siteImages.map((im) => im.src), [officina.image.src, newSrc, journal.src])
  assert.deepEqual(catalog.imageOverrides, {})
  assert.deepEqual(catalog.photos.map((p) => p.src), [upload])
  const reopened = createApp({ env: migrated.env, dataDir: migrated.dir })
  const reopenedBody = reopened.db.prepare('SELECT revision, body FROM catalog').get()
  reopened.close()
  assert.equal(reopenedBody.revision, 3)
  assert.equal(JSON.parse(reopenedBody.body).catalogVersion, 8)
  // The owner's replacement of the old slot moves to the new slot.
  const replaced = await fixture(t, false, v6({ [oldSrc]: { src: upload, alt: 'Flacone caricato' } }))
  const owned = (await replaced.admin.request('/catalog')).body
  assert.deepEqual(Object.keys(owned.imageOverrides), [newSrc])
  assert.equal(owned.imageOverrides[newSrc].src, upload)
  assert.ok(owned.siteImages.some((im) => im.src === newSrc))
  assert.ok(!owned.siteImages.some((im) => im.src === oldSrc))
})

test('version-7 catalog gives every watch a line once: seed watches by id, owner-added ones unisex', async (t) => {
  const { models, profumo, tesoroDiAlarico } = await import('../src/data/content.ts')
  const watch = ({ gender, ...m }) => ({
    ...m,
    priceCents: 100000,
    availability: 'buy',
    limitedEdition: false,
    piecesRemaining: null,
    variants: m.variants?.map((v) => ({ ...v, priceCents: 100000 })),
  })
  const n2 = models.find((m) => m.id === 'n2')
  const v7 = {
    hero: { src: 'img/models/takimo.jpg', alt: 'Takimo' },
    models: [...models.map(watch), watch({ ...n2, id: 'del-titolare', name: 'Del titolare' })],
    perfumes: [
      { ...profumo, priceCents: 12000, availability: 'no-buy' },
      { ...tesoroDiAlarico, priceCents: 0, availability: 'coming-soon' },
    ],
    imageOverrides: {},
    siteImages: [],
    photos: [],
    featured: [],
    localizationVersion: 1,
    catalogVersion: 7,
  }
  assert.ok(v7.models.every((m) => !Object.hasOwn(m, 'gender')))
  const migrated = await fixture(t, false, v7)
  const catalog = (await migrated.admin.request('/catalog')).body
  assert.equal(catalog.catalogVersion, 8)
  assert.equal(catalog.revision, 2)
  const gender = (id) => catalog.models.find((m) => m.id === id).gender
  assert.equal(gender('n9'), 'donna')
  assert.equal(gender('n2'), 'uomo')
  assert.equal(gender('takimo'), 'unisex')
  assert.equal(gender('del-titolare'), 'unisex')
  for (const m of models) assert.equal(gender(m.id), m.gender)
  const reopened = createApp({ env: migrated.env, dataDir: migrated.dir })
  const reopenedBody = reopened.db.prepare('SELECT revision, body FROM catalog').get()
  reopened.close()
  assert.equal(reopenedBody.revision, 2)
  assert.equal(JSON.parse(reopenedBody.body).catalogVersion, 8)
})

test('watch line is validated on save and shared with the public catalog', async (t) => {
  const { admin, buyer } = await fixture(t)
  const saveGender = async (gender) => {
    const current = (await admin.request('/catalog')).body
    const product = { ...current.models.find((m) => m.id === 'takimo'), gender }
    return admin.request('/admin/products/takimo', 'PUT', { product, revision: current.revision })
  }
  const before = (await admin.request('/catalog')).body.revision
  assert.equal((await saveGender('altro')).status, 400)
  assert.equal((await admin.request('/catalog')).body.revision, before)
  const saved = await saveGender('donna')
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.equal(saved.body.models.find((m) => m.id === 'takimo').gender, 'donna')
  assert.equal((await buyer.request('/catalog')).body.models.find((m) => m.id === 'takimo').gender, 'donna')
  // A product saved without a line defaults to unisex.
  const current = (await admin.request('/catalog')).body
  const { gender, ...product } = current.models.find((m) => m.id === 'n9')
  const defaulted = await admin.request('/admin/products/n9', 'PUT', { product, revision: current.revision })
  assert.equal(defaulted.status, 200, JSON.stringify(defaulted.body))
  assert.equal(defaulted.body.models.find((m) => m.id === 'n9').gender, 'unisex')
})

// Order emails are fire-and-forget; wait until the emails table holds the expected attempts.
const emailLog = async (application, count) => {
  for (let i = 0; i < 200; i++) {
    const rows = application.db.prepare('SELECT * FROM emails ORDER BY id').all()
    if (rows.length >= count) return rows
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.fail(`expected ${count} email attempts`)
}
const paidOrder = async ({ buyer, enable }, items = [line({ certificate: holder, engraving: 'Per <sempre>', engravingAccepted: true })]) => {
  await enable('takimo')
  const order = await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID() })
  assert.equal(order.status, 200, JSON.stringify(order.body))
  const capture = await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})
  assert.equal(capture.status, 200, JSON.stringify(capture.body))
  return { order, capture }
}

test('capture creates the order page and sends one owner and one customer email', async (t) => {
  const context = await fixture(t, true)
  const { admin, buyer, mail, application } = context
  const { order, capture } = await paidOrder(context)
  assert.match(capture.body.orderUrl, /^\/ordine\/[A-Za-z0-9_-]{43}$/)
  const log = await emailLog(application, 2)
  assert.deepEqual(
    log.map((e) => [e.kind, e.status, e.recipient, e.state]).sort(),
    [
      ['customer', 'ricevuto', 'giulia@example.com', 'sent'],
      ['owner', 'ricevuto', 'owner@example.com', 'sent'],
    ],
  )
  assert.equal(mail.sent.length, 2)
  for (const message of mail.sent) {
    // User text is escaped in the HTML.
    assert.match(message.html, /Per &lt;sempre&gt;/)
    assert.match(message.html, /Neri/)
  }
  const owner = mail.sent.find((m) => m.to === 'owner@example.com')
  assert.match(owner.html, /ZPTAK15/)
  assert.match(owner.html, /mario@example\.com/)
  const [row] = (await admin.request('/admin/orders')).body
  assert.equal(row.fulfillment, 'ricevuto')
  assert.equal(row.history.length, 1)
  assert.equal(row.history[0].status, 'ricevuto')
  assert.equal(row.customerEmail, 'giulia@example.com')
  assert.equal(`/ordine/${row.publicToken}`, capture.body.orderUrl)
  assert.deepEqual(row.emails.map((e) => e.to).sort(), ['giulia@example.com', 'owner@example.com'])
  // A repeated capture answers with the same page and sends nothing more.
  const again = await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})
  assert.equal(again.body.orderUrl, capture.body.orderUrl)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(mail.sent.length, 2)
})

test('recovered capture sends once, falls back to the payer email, and mail failures never fail capture', async (t) => {
  const context = await fixture(t, true)
  const { buyer, enable, seen, mail, application } = context
  await enable('takimo')
  const order = await buyer.request('/payments/orders', 'POST', { items: [line()], requestId: randomUUID() })
  seen.lostCapture = true
  assert.equal((await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).status, 500)
  assert.equal((await application.db.prepare('SELECT COUNT(*) AS n FROM emails').get()).n, 0)
  mail.fail = true
  const recovered = await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})
  assert.equal(recovered.status, 200)
  assert.ok(recovered.body.orderUrl)
  const log = await emailLog(application, 2)
  assert.deepEqual(log.map((e) => e.state), ['failed', 'failed'])
  assert.ok(log.every((e) => e.error === 'SMTP down'))
  assert.ok(log.some((e) => e.kind === 'customer' && e.recipient === 'mario@example.com'))
  mail.fail = false
  await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(application.db.prepare('SELECT COUNT(*) AS n FROM emails').get().n, 2)
  assert.equal(mail.sent.length, 0)
})

test('public order page shows items and status only, and 404s for unknown tokens', async (t) => {
  const context = await fixture(t, true)
  const { client } = context
  const { order, capture } = await paidOrder(context)
  const guest = client()
  const page = await guest.request(capture.body.orderUrl.replace('/ordine/', '/orders/'))
  assert.equal(page.status, 200)
  assert.deepEqual(Object.keys(page.body).sort(), ['created', 'history', 'items', 'reference', 'status', 'total'])
  assert.equal(page.body.reference, order.body.requestId)
  assert.equal(page.body.status, 'ricevuto')
  assert.deepEqual(Object.keys(page.body.items[0]).sort(), ['certificate', 'codes', 'engraving', 'image', 'kind', 'name', 'priceCents', 'quantity'])
  assert.deepEqual(page.body.items[0].certificate, holder)
  assert.equal(page.body.items[0].engraving, 'Per <sempre>')
  const raw = JSON.stringify(page.body)
  for (const secret of ['mario@example.com', 'CAPTURE-1', 'PP-1', 'session', 'fingerprint']) assert.ok(!raw.includes(secret), secret)
  for (const token of ['x'.repeat(43), 'short', `${'a'.repeat(42)}!`])
    assert.equal((await guest.request(`/orders/${encodeURIComponent(token)}`)).status, 404)
})

test('status changes need admin and CSRF, append history and email the matching template', async (t) => {
  const context = await fixture(t, true)
  const { admin, buyer, mail, application } = context
  const { order } = await paidOrder(context)
  await emailLog(application, 2)
  const id = order.body.requestId
  const path = `/admin/orders/${id}/status`
  assert.equal((await buyer.request(path, 'PUT', { status: 'pronto', notify: true })).status, 401)
  assert.equal((await admin.request(path, 'PUT', { status: 'pronto', notify: true }, { 'X-CSRF-Token': 'bad' })).status, 403)
  assert.equal((await admin.request(path, 'PUT', { status: 'perso', notify: true })).status, 400)
  assert.equal((await admin.request(`/admin/orders/${randomUUID()}/status`, 'PUT', { status: 'pronto', notify: false })).status, 404)
  const quiet = await admin.request(path, 'PUT', { status: 'in-lavorazione', notify: false })
  assert.equal(quiet.status, 200)
  assert.equal(quiet.body.fulfillment, 'in-lavorazione')
  const ready = await admin.request(path, 'PUT', { status: 'pronto', notify: true })
  assert.deepEqual(ready.body.history.map((h) => h.status), ['ricevuto', 'in-lavorazione', 'pronto'])
  const log = await emailLog(application, 3)
  assert.deepEqual([log[2].kind, log[2].status, log[2].recipient, log[2].state], ['customer', 'pronto', 'giulia@example.com', 'sent'])
  assert.equal(mail.sent.length, 3)
  assert.match(mail.sent[2].subject, /è pronto/)
  // A disabled template skips the email even when notify is set.
  const templates = (await admin.request('/admin/email-templates')).body
  templates.spedito.enabled = false
  assert.equal((await admin.request('/admin/email-templates', 'PUT', templates)).status, 200)
  assert.equal((await admin.request(path, 'PUT', { status: 'spedito', notify: true })).status, 200)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(mail.sent.length, 3)
  // An unpaid order has no readiness yet.
  const unpaid = await buyer.request('/payments/orders', 'POST', { items: [line({ engraving: 'Altro', engravingAccepted: true })], requestId: randomUUID() })
  assert.equal((await admin.request(`/admin/orders/${unpaid.body.requestId}/status`, 'PUT', { status: 'pronto', notify: true })).status, 409)
})

test('email templates merge over defaults, round-trip and are validated', async (t) => {
  const { admin, buyer } = await fixture(t)
  const { DEFAULT_EMAIL_TEMPLATES } = await import('../src/data/types.ts')
  assert.equal((await buyer.request('/admin/email-templates')).status, 401)
  const defaults = await admin.request('/admin/email-templates')
  assert.deepEqual(defaults.body, DEFAULT_EMAIL_TEMPLATES)
  const next = structuredClone(defaults.body)
  next.pronto = { enabled: false, subject: 'Pronto {ordine}', heading: 'Ciao {nome}', message: 'Riga uno.\n\nRiga due.' }
  assert.equal((await admin.request('/admin/email-templates', 'PUT', next, { 'X-CSRF-Token': 'bad' })).status, 403)
  const saved = await admin.request('/admin/email-templates', 'PUT', next)
  assert.equal(saved.status, 200)
  assert.deepEqual(saved.body, next)
  assert.deepEqual((await admin.request('/admin/email-templates')).body, next)
  const { consegnato, ...missing } = next
  for (const invalid of [
    missing,
    { ...next, pronto: { ...next.pronto, subject: 'x'.repeat(201) } },
    { ...next, pronto: { ...next.pronto, heading: 'x'.repeat(201) } },
    { ...next, pronto: { ...next.pronto, message: 'x'.repeat(4001) } },
    { ...next, perso: next.pronto },
  ])
    assert.equal((await admin.request('/admin/email-templates', 'PUT', invalid)).status, 400)
  const mailInfo = await admin.request('/admin/mail')
  assert.deepEqual(mailInfo.body, { configured: true, from: 'ZITO1950® <customer@zito1950.it>', owner: 'owner@example.com' })
})

test('mailer without SMTP is not configured and skips sending', async () => {
  const { createMailer } = await import('./mail.mjs')
  const mailer = createMailer({})
  assert.equal(mailer.configured, false)
  assert.equal(mailer.from, 'ZITO1950® <customer@zito1950.it>')
  assert.equal(mailer.owner, 'customer@zito1950.it')
  assert.deepEqual(await mailer.send({ to: 'a@example.com', subject: 's', html: '<p>h</p>', text: 'h' }), { skipped: true })
})
