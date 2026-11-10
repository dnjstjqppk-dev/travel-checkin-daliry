import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp, eventHandler, toWebHandler } from 'h3'
import { testDatabase } from './sqlite-d1'
import { handleD1Api } from '../server/utils/d1-api'
import { cachedPublic, __clearResponseCache, __responseCacheSize } from '../server/utils/response-cache'
import { parseRssOrAtomXml } from '../server/utils/feed-parser'
import { calculateTitleSimilarity, isDuplicateOrClustered } from '../server/utils/text-similarity'
import { renderMarkdown, __clearMarkdownCache, __markdownCacheSize } from '../utils/render-markdown'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  __clearResponseCache()
  __clearMarkdownCache()
})

interface RunOptions {
  method?: string
  waitUntil?: (promise: Promise<unknown>) => void
}

async function runCached<T>(path: string, options: { ttlMs: number; swrMs: number }, loader: () => Promise<T>, init: RunOptions = {}): Promise<T> {
  let result: T | undefined
  const app = createApp()
  app.use(eventHandler(async (event) => {
    if (init.waitUntil) (event as unknown as { waitUntil: unknown }).waitUntil = init.waitUntil
    result = await cachedPublic(event, options, loader)
    return { ok: true }
  }))
  const response = await toWebHandler(app)(new Request(`https://local.test${path}`, { method: init.method ?? 'GET' }))
  await response.text()
  return result as T
}

test('response cache serves repeats without re-running the loader', async () => {
  let calls = 0
  const loader = async () => ({ n: ++calls })
  const first = await runCached('/probe/a?lang=ko', { ttlMs: 1000, swrMs: 1000 }, loader)
  const second = await runCached('/probe/a?lang=ko', { ttlMs: 1000, swrMs: 1000 }, loader)
  assert.equal(calls, 1)
  assert.deepEqual(second, first)
  assert.equal(__responseCacheSize(), 1)
  await runCached('/probe/a?lang=en', { ttlMs: 1000, swrMs: 1000 }, loader)
  assert.equal(calls, 2, 'distinct URLs are cached independently')
})

test('response cache bypasses admin paths and non-GET methods', async () => {
  let calls = 0
  const loader = async () => (++calls)
  await runCached('/api/admin/articles', { ttlMs: 1000, swrMs: 1000 }, loader)
  await runCached('/api/admin/articles', { ttlMs: 1000, swrMs: 1000 }, loader)
  await runCached('/probe/write', { ttlMs: 1000, swrMs: 1000 }, loader, { method: 'POST' })
  await runCached('/probe/write', { ttlMs: 1000, swrMs: 1000 }, loader, { method: 'POST' })
  assert.equal(calls, 4)
  assert.equal(__responseCacheSize(), 0)
})

test('response cache never stores misses or errors', async () => {
  let nullCalls = 0
  await runCached('/probe/miss', { ttlMs: 1000, swrMs: 1000 }, async () => { nullCalls++; return null })
  await runCached('/probe/miss', { ttlMs: 1000, swrMs: 1000 }, async () => { nullCalls++; return null })
  assert.equal(nullCalls, 2)
  let errorCalls = 0
  const failing = async () => { errorCalls++; throw new Error('boom') }
  // h3 converts the loader throw into a 500 response; the point is the error
  // is not cached, so the loader runs again on the next request.
  assert.equal(await runCached('/probe/err', { ttlMs: 1000, swrMs: 1000 }, failing), undefined)
  assert.equal(await runCached('/probe/err', { ttlMs: 1000, swrMs: 1000 }, failing), undefined)
  assert.equal(errorCalls, 2)
  assert.equal(__responseCacheSize(), 0)
})

test('response cache expires entries after TTL', async () => {
  let calls = 0
  const options = { ttlMs: 10, swrMs: 0 }
  assert.equal(await runCached('/probe/ttl', options, async () => (++calls)), 1)
  assert.equal(await runCached('/probe/ttl', options, async () => (++calls)), 1)
  await sleep(25)
  assert.equal(await runCached('/probe/ttl', options, async () => (++calls)), 2)
})

test('response cache serves stale while revalidating once in background', async () => {
  let calls = 0
  const background: Promise<unknown>[] = []
  const waitUntil = (promise: Promise<unknown>) => { background.push(promise) }
  const options = { ttlMs: 10, swrMs: 10_000 }
  const loader = async () => { calls++; await sleep(30); return calls }
  assert.equal(await runCached('/probe/swr', options, loader, { waitUntil }), 1)
  await sleep(25)
  const [staleA, staleB] = await Promise.all([
    runCached('/probe/swr', options, loader, { waitUntil }),
    runCached('/probe/swr', options, loader, { waitUntil }),
  ])
  assert.equal(staleA, 1)
  assert.equal(staleB, 1)
  assert.equal(calls, 2, 'concurrent stale hits trigger a single refresh')
  assert.equal(background.length, 1)
  await background[0]
  assert.equal(await runCached('/probe/swr', options, loader, { waitUntil }), 2)
})

test('response cache revalidates inline without waitUntil', async () => {
  let calls = 0
  const options = { ttlMs: 10, swrMs: 10_000 }
  assert.equal(await runCached('/probe/inline', options, async () => (++calls)), 1)
  await sleep(25)
  assert.equal(await runCached('/probe/inline', options, async () => (++calls)), 2)
})

test('response cache evicts oldest entries past capacity', async () => {
  let calls = 0
  const options = { ttlMs: 60_000, swrMs: 60_000 }
  for (let i = 0; i < 505; i++) {
    await runCached(`/probe/lru-${i}`, options, async () => (++calls))
  }
  assert.equal(calls, 505)
  assert.ok(__responseCacheSize() <= 500, `size ${__responseCacheSize()} exceeds capacity`)
  await runCached('/probe/lru-0', options, async () => (++calls))
  assert.equal(calls, 506, 'oldest entry was evicted and reloaded')
})

function apiFixture() {
  const fixture = testDatabase()
  const app = createApp()
  app.use(eventHandler(async (event) => {
    event.context.cloudflare = { env: { DB: fixture.database } }
    return handleD1Api(event, fixture.database)
  }))
  const fetch = (path: string, init?: RequestInit) => toWebHandler(app)(new Request(`https://local.test${path}`, init))
  return { ...fixture, fetch }
}

function seedPublished(sqlite: { prepare: (sql: string) => { run: (...values: unknown[]) => { lastInsertRowid: unknown } } }, overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  const row = {
    title: 'Cache probe story', slug: `cache-probe-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    summary: 'summary', content: '## Section\n\nBody text for the probe story.', category: 'major',
    status: 'published', review_status: 'approved', published_at: now, updated_at: now, ...overrides,
  }
  const id = Number(sqlite.prepare(`INSERT INTO articles (title, slug, summary, content, category, status, review_status, published_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(row.title, row.slug, row.summary, row.content, row.category, row.status, row.review_status, row.published_at, row.updated_at).lastInsertRowid)
  return { id, ...row }
}

test('article list responses are cached per URL and refresh after clear', async () => {
  const { sqlite, fetch } = apiFixture()
  const article = seedPublished(sqlite as never)
  const first = await (await fetch(`/api/articles?limit=5&lang=ko&seed=${article.id}`)).json() as Array<{ id: number; title: string }>
  assert.ok(first.some(item => item.id === article.id && item.title === 'Cache probe story'))
  sqlite.prepare('UPDATE articles SET title = ? WHERE id = ?').run('Updated title', article.id)
  const stale = await (await fetch(`/api/articles?limit=5&lang=ko&seed=${article.id}`)).json() as Array<{ id: number; title: string }>
  assert.ok(stale.some(item => item.id === article.id && item.title === 'Cache probe story'), 'TTL hit serves the cached list')
  __clearResponseCache()
  const fresh = await (await fetch(`/api/articles?limit=5&lang=ko&seed=${article.id}`)).json() as Array<{ id: number; title: string }>
  assert.ok(fresh.some(item => item.id === article.id && item.title === 'Updated title'))
  sqlite.close()
})

test('article reads still record analytics and human view counts', async () => {
  const { sqlite, fetch } = apiFixture()
  const article = seedPublished(sqlite as never)
  const response = await fetch(`/api/articles/id/${article.id}?category=major&lang=ko`)
  assert.equal(response.status, 200)
  const bot = await fetch(`/api/articles/id/${article.id}?category=major&lang=ko`, { headers: { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' } })
  assert.equal(bot.status, 200)
  const events = sqlite.prepare('SELECT bot_classification AS cls, COUNT(*) AS n FROM analytics_events WHERE article_id = ? GROUP BY bot_classification')
    .all(article.id) as Array<{ cls: string; n: number }>
  const byClass = Object.fromEntries(events.map(row => [row.cls, row.n]))
  assert.equal(byClass.human, 1)
  assert.equal(byClass.crawler, 1)
  const views = sqlite.prepare('SELECT view_count AS n FROM articles WHERE id = ?').get(article.id) as { n: number }
  assert.equal(views.n, 1, 'only human reads bump the public view count')
  sqlite.close()
})

function buildFeed(kind: 'rss' | 'atom', count: number): string {
  const items = Array.from({ length: count }, (_, i) => kind === 'rss'
    ? `<item><title>Story ${i}</title><link>https://example.org/s${i}</link><guid>g-${i}</guid><description>Summary ${i}</description></item>`
    : `<entry><title>Story ${i}</title><link href="https://example.org/s${i}"/><id>g-${i}</id><summary>Summary ${i}</summary></entry>`)
  return kind === 'rss'
    ? `<rss version="2.0"><channel>${items.join('')}</channel></rss>`
    : `<feed xmlns="http://www.w3.org/2005/Atom">${items.join('')}</feed>`
}

test('feed parser caps oversized feeds but preserves order', async () => {
  const rss = await parseRssOrAtomXml(buildFeed('rss', 100))
  assert.equal(rss.length, 30)
  assert.equal(rss[0]!.title, 'Story 0')
  assert.equal(rss[29]!.title, 'Story 29')
  const atom = await parseRssOrAtomXml(buildFeed('atom', 100))
  assert.equal(atom.length, 30)
  const explicit = await parseRssOrAtomXml(buildFeed('rss', 100), 5)
  assert.equal(explicit.length, 5)
  const fallback = await parseRssOrAtomXml(buildFeed('rss', 100), 0)
  assert.equal(fallback.length, 30)
  const small = await parseRssOrAtomXml(buildFeed('rss', 3))
  assert.equal(small.length, 3)
})

test('duplicate gate matches the full similarity blend on every threshold', () => {
  const pairs: Array<[string, string]> = [
    ['태국 방콕 수완나품 공항 스마트 게이트 전면 도입 발표', '방콕 수완나품 공항, 스마트 게이트 전면 도입으로 출국 시간 단축'],
    ['태국 방콕 수완나품 공항 스마트 게이트 전면 도입 발표', '프랑스 파리 루브르 박물관 야간 특별 관람권 오픈'],
    ['Qantas adds Perth to Paris nonstop flights', 'Qantas adds Perth-Paris nonstop flight'],
    ['Singapore opens new Changi terminal', 'Lisbon tightens short-term rental rules'],
    ['Same headline here', 'Same headline here'],
    ['Same Headline Here!', 'same headline here'],
    ['', 'non-empty title'],
    ['', ''],
    ['a', 'b'],
    ['대한항공 인천 파리 노선 증편', '대한항공 인천-파리 노선 증편 결정'],
    ['Hotel rates surge in Bangkok this winter season forecast', 'Bangkok hotel rates to surge this winter, forecast says'],
  ]
  for (const threshold of [0, 0.5, 0.55, 0.6, 0.65, 0.9, 1]) {
    for (const [a, b] of pairs) {
      assert.equal(
        isDuplicateOrClustered(a, b, threshold),
        calculateTitleSimilarity(a, b) >= threshold,
        `pair ${JSON.stringify(a)} / ${JSON.stringify(b)} at ${threshold}`,
      )
    }
  }
})

test('markdown renderer memoizes by content and still sanitizes', () => {
  const raw = '## Headline here\n\nBody with an ![alt text](https://example.org/img.jpg "caption") image.\n\n<script>alert(1)</script>'
  const first = renderMarkdown(raw)
  const second = renderMarkdown(raw)
  assert.equal(first, second)
  assert.equal(__markdownCacheSize(), 1)
  assert.match(first, /<h2 id="sec-headline-here">/)
  assert.match(first, /<figure class="body-figure">/)
  assert.doesNotMatch(first, /<script/)
  renderMarkdown('## Different\n\nOther body.')
  assert.equal(__markdownCacheSize(), 2)
  renderMarkdown(raw)
  assert.equal(__markdownCacheSize(), 2, 'repeat renders do not grow the cache')
})
