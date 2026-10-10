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
  const seen = { captures: 0, amounts: [], mismatch: false, lostCapture: false }
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
  const application = createApp({ env, dataDir: dir, fetch: transport, translateFetch })
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
  return { admin, buyer, client, enable, seen, application, dir, env }
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

test('legacy catalog migrates buyEnabled, limited editions and default hero once', async (t) => {
  const { models, storia } = await import('../src/data/content.ts')
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
  assert.equal(catalog.catalogVersion, 3)
  assert.equal(n7.availability, 'buy')
  assert.equal(n7.buyEnabled, undefined)
  assert.equal(n7.limitedEdition, false)
  assert.equal(n7.piecesRemaining, null)
  assert.equal(catalog.models.find((m) => m.id === 'takimo').availability, 'no-buy')
  for (const limited of ['tutus-ab-uno', 'takimo', 'bauletto'])
    assert.equal(catalog.models.find((m) => m.id === limited).limitedEdition, true)
  assert.equal(catalog.hero.src, 'img/models/tutus-ab-uno.jpg')
  assert.ok(catalog.hero.altTranslations)
  for (const im of storia.place?.images ?? []) assert.ok(catalog.siteImages.some((s) => s.src === im.src))
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

test('custom certificate holder is stored, replaceable on retry and returned to admin', async (t) => {
  const { admin, buyer, enable } = await fixture(t, true)
  await enable('takimo')
  const items = [{ modelId: 'takimo', variantId: null, quantity: 1 }]
  const requestId = randomUUID()
  const invalid = { firstName: 'Anna', lastName: 'Bianchi', email: 'not-an-email' }
  assert.equal((await buyer.request('/payments/orders', 'POST', { items, requestId, certificate: invalid })).status, 400)
  const first = { firstName: 'Anna', lastName: 'Bianchi', email: 'anna@example.com' }
  const order = await buyer.request('/payments/orders', 'POST', { items, requestId, certificate: first })
  assert.equal(order.status, 200, JSON.stringify(order.body))
  const second = { firstName: ' Luca ', lastName: 'Verdi', email: 'luca@example.com' }
  const retried = await buyer.request('/payments/orders', 'POST', { items, requestId, certificate: second })
  assert.equal(retried.body.id, order.body.id)
  assert.equal((await buyer.request(`/payments/orders/${order.body.id}/capture`, 'POST', {})).body.status, 'COMPLETED')
  const [row] = (await admin.request('/admin/orders')).body
  assert.deepEqual(row.certificate, { firstName: 'Luca', lastName: 'Verdi', email: 'luca@example.com' })
  assert.equal(row.certificateCode, null)
  assert.deepEqual(row.receipt.payer, { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com' })
  const plain = await buyer.request('/payments/orders', 'POST', { items, requestId: randomUUID(), certificate: null })
  assert.equal(plain.status, 200)
  assert.equal((await admin.request('/admin/orders')).body.find((o) => o.paypal_id === plain.body.id).certificate, null)
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
  assert.equal(catalog.catalogVersion, 3)
  assert.equal(catalog.revision, 2)
  assert.equal(catalog.models.find((m) => m.id === 'takimo').availability, 'out-of-stock')
  assert.equal(catalog.models.find((m) => m.id === 'n7').availability, 'buy')
  const reopened = createApp({ env, dataDir: dir })
  const reopenedRevision = reopened.db.prepare('SELECT revision FROM catalog').get().revision
  reopened.close()
  assert.equal(reopenedRevision, 2)
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
      !(catalog.perfume?.images ?? []).some((im) => im.src === s.src),
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
  const perfume = await admin.request('/admin/perfume', 'PUT', {
    product: { ...current.perfume, quote: { text: '', author: '' } },
    revision: current.revision,
  })
  assert.equal(perfume.status, 200, JSON.stringify(perfume.body))
  assert.deepEqual(perfume.body.perfume.quote, { text: '' })
})
