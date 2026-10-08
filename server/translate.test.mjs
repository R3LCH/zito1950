import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTranslator } from './translate.mjs'

const google = (text) => Response.json([[[text, 'x', null, null]], null, 'it'])
const memory = (translation, responseStatus = 200, extra = {}) =>
  Response.json({ responseData: { translatedText: translation }, responseStatus, matches: [{ translation, match: 1 }], ...extra })

function recorder(handlers) {
  const calls = []
  const fetch = async (url, init) => {
    const host = new URL(url).host
    calls.push({ host, url, init })
    return handlers[host](new URL(url), init)
  }
  return { calls, fetch }
}

test('MyMemory result is used and HTML entities are decoded', async () => {
  const { calls, fetch } = recorder({ 'api.mymemory.translated.net': () => memory('it&#39;s &amp; &quot;ok&quot;') })
  const translate = createTranslator({ fetch, email: 'admin@example.com' })
  assert.equal(await translate('ciao', 'it', 'en'), `it's & "ok"`)
  assert.equal(calls.length, 1)
  assert.equal(new URL(calls[0].url).searchParams.get('langpair'), 'it|en')
  assert.equal(new URL(calls[0].url).searchParams.get('de'), 'admin@example.com')
})

test('fuzzy translation-memory hits are skipped in favour of MyMemory MT', async () => {
  const { calls, fetch } = recorder({
    'api.mymemory.translated.net': () => Response.json({
      responseStatus: 200,
      responseData: { translatedText: 'Unrelated sentence', match: 0.86 },
      matches: [
        { translation: 'Unrelated sentence', match: 0.86, 'created-by': 'MateCat' },
        { translation: 'Happiness depends on us', match: 0.85, 'created-by': 'MT!' },
      ],
    }),
  })
  assert.equal(await createTranslator({ fetch })('La felicità dipende da noi', 'it', 'en'), 'Happiness depends on us')
  assert.equal(calls.length, 1)
})

test('only fuzzy memory hits fall back to Google', async () => {
  const { calls, fetch } = recorder({
    'api.mymemory.translated.net': () => Response.json({
      responseStatus: 200,
      responseData: { translatedText: 'Unrelated', match: 0.7 },
      matches: [{ translation: 'Unrelated', match: 0.7, 'created-by': 'MateCat' }],
    }),
    'translate.googleapis.com': () => google('Happiness depends on us'),
  })
  assert.equal(await createTranslator({ fetch })('La felicità dipende da noi', 'it', 'en'), 'Happiness depends on us')
  assert.deepEqual(calls.map((c) => c.host), ['api.mymemory.translated.net', 'translate.googleapis.com'])
})

test('falls back to Google on MyMemory quota warnings, HTTP errors and network failures', async (t) => {
  const failures = {
    quota: () => memory('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY', 429),
    status200Warning: () => memory('MYMEMORY WARNING: quota', 200, { quotaFinished: true }),
    http: () => new Response('down', { status: 503 }),
    network: () => { throw new TypeError('fetch failed') },
  }
  for (const [name, failure] of Object.entries(failures)) {
    await t.test(name, async () => {
      const { calls, fetch } = recorder({
        'api.mymemory.translated.net': failure,
        'translate.googleapis.com': (_url, init) => google(`G:${new URLSearchParams(init.body).get('q')}`),
      })
      assert.equal(await createTranslator({ fetch })('ciao', 'it', 'de'), 'G:ciao')
      assert.deepEqual(calls.map((c) => c.host), ['api.mymemory.translated.net', 'translate.googleapis.com'])
      const query = new URL(calls[1].url).searchParams
      assert.equal(query.get('sl'), 'it')
      assert.equal(query.get('tl'), 'de')
    })
  }
})

test('texts over MyMemory 500-byte limit go straight to Google; multi-sentence output is joined', async () => {
  const long = 'Ж'.repeat(251) // 502 UTF-8 bytes
  const { calls, fetch } = recorder({
    'translate.googleapis.com': () => Response.json([[['One. ', 'a'], ['Two.', 'b']]]),
  })
  assert.equal(await createTranslator({ fetch })(long, 'ru', 'en'), 'One. Two.')
  assert.deepEqual(calls.map((c) => c.host), ['translate.googleapis.com'])
})

test('rejects when both services fail', async () => {
  const { fetch } = recorder({
    'api.mymemory.translated.net': () => new Response('x', { status: 500 }),
    'translate.googleapis.com': () => Response.json(null),
  })
  await assert.rejects(createTranslator({ fetch })('ciao', 'it', 'en'))
})
