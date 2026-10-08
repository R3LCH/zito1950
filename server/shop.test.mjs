import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { createApp } from './app.mjs'
import { hashPassword } from './password.mjs'

async function fixture(t, paypal = false) {
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
  const enable = async (modelId = 'n7') => {
    const current = (await admin.request('/catalog')).body
    const product = current.models.find((m) => m.id === modelId)
    product.buyEnabled = true
    const response = await admin.request(`/admin/products/${modelId}`, 'PUT', { product, revision: current.revision })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    return response.body
  }
  return { admin, buyer, client, enable, seen, application, dir }
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
  const image = uploaded.body.photos[0]
  assert.match(image.src, /^uploads\/[a-f0-9-]+\.webp$/)
  const hero = await admin.request('/admin/hero', 'PUT', { image, revision: uploaded.body.revision })
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
  product.buyEnabled = false
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
