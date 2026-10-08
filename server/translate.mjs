// Free machine translation for admin-entered copy: MyMemory first, Google's unofficial
// `translate_a/single` endpoint as fallback. Both are keyless public services with
// undocumented limits, so either may throttle or change without notice.
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get'
const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/single'
// MyMemory rejects queries above 500 bytes of UTF-8; longer texts go straight to Google.
const MYMEMORY_MAX_BYTES = 500
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

// MyMemory HTML-escapes its output (e.g. `it&#39;s`), but the admin stores plain text.
const decodeEntities = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, name) =>
    name[0] === '#' ? String.fromCodePoint(Number.parseInt(name.slice(name[1].toLowerCase() === 'x' ? 2 : 1), name[1].toLowerCase() === 'x' ? 16 : 10)) : ENTITIES[name.toLowerCase()] ?? match,
  )

/**
 * @param {{ fetch: typeof fetch, email?: string, timeoutMs?: number }} options
 * `email` raises MyMemory's anonymous daily quota (about 5k → 50k characters).
 * @returns {(text: string, source: string, target: string) => Promise<string>}
 */
export function createTranslator({ fetch, email, timeoutMs = 10000 }) {
  async function myMemory(text, source, target) {
    const query = new URLSearchParams({ q: text, langpair: `${source}|${target}` })
    if (email) query.set('de', email)
    const response = await fetch(`${MYMEMORY_URL}?${query}`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`)
    const body = await response.json()
    // Quota and input errors still arrive as HTTP 200 with a status field and a warning in place of the text.
    if (String(body?.responseStatus) !== '200' || body?.quotaFinished) throw new Error(`MyMemory status ${body?.responseStatus}`)
    // `responseData` is the top-ranked candidate, which can be a fuzzy translation-memory hit for a
    // different sentence (e.g. 0.86 match, unrelated text). Accept only exact memory hits or MyMemory's own MT.
    const candidate = (body?.matches ?? []).find((m) => Number(m?.match) >= 1 || m?.['created-by'] === 'MT!' || m?.['machine-translation'])
    const translated = candidate?.translation
    if (typeof translated !== 'string' || !translated.trim() || /^MYMEMORY WARNING/i.test(translated))
      throw new Error('MyMemory returned no exact or machine translation')
    return decodeEntities(translated)
  }
  async function google(text, source, target) {
    const query = new URLSearchParams({ client: 'gtx', sl: source, tl: target, dt: 't' })
    // POST keeps long Cyrillic paragraphs out of the URL length limit.
    const response = await fetch(`${GOOGLE_URL}?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ q: text }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`Google HTTP ${response.status}`)
    const body = await response.json()
    // Shape: [[["translated sentence", "source sentence", …], …], …]; sentences join back into the text.
    if (!Array.isArray(body?.[0])) throw new Error('Google response without sentences')
    const translated = body[0].map((sentence) => (Array.isArray(sentence) && typeof sentence[0] === 'string' ? sentence[0] : '')).join('')
    if (!translated.trim()) throw new Error('Google returned an empty translation')
    return translated
  }
  return async (text, source, target) => {
    if (Buffer.byteLength(text) <= MYMEMORY_MAX_BYTES) {
      try {
        return await myMemory(text, source, target)
      } catch {
        // Fall through to Google; MyMemory failures are routine (quota, throttling).
      }
    }
    return google(text, source, target)
  }
}
