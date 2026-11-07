import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testDatabase } from './sqlite-d1'
import { callGeminiJson, GenerationError, parseGeminiArticle, safeParseArticleJson } from '../server/utils/gemini-client'
import { assessArticleQuality, runArticlePipeline, loadPipelinePolicies, normalizeSourceUrl, weaveImages } from '../server/utils/article-pipeline'
import { extractMediaUrl } from '../server/utils/feed-parser'
import { executeCronTasks } from '../server/utils/cron-runner'
import { articleSitemap, publicArticleSql } from '../server/utils/sitemap-data'
import { extractArticleText } from '../server/utils/source-extractor'

const SENTENCES = [
  '일본정부관광국은 2026년 11월부터 주요 공항의 전자 입국 신고 절차를 단일 앱으로 통합한다고 밝혔다.',
  '발표에 따르면 기존에 따로 제출하던 검역과 세관 정보가 하나의 QR 코드로 묶인다.',
  '관광국은 이번 조치가 입국 심사 대기 시간을 줄이기 위한 것이라고 설명했다.',
  '대상 공항은 나리타, 하네다, 간사이 등 국제선 이용객이 많은 곳부터 순차적으로 확대된다.',
  '항공업계는 입국 절차 간소화가 단거리 노선 수요 회복에 긍정적인 신호가 될 것으로 보고 있다.',
  '여행사들은 출국 전에 앱 등록을 마치도록 고객 안내문을 갱신하고 있다고 전했다.',
  '관광국은 앱 사용이 어려운 여행객을 위해 공항 현장 키오스크도 함께 운영한다고 덧붙였다.',
  '여행자는 출발 72시간 전까지 여권 정보와 체류지 주소를 미리 입력해 두는 것이 좋다.',
]

function koreanBody(paragraphsPerSection = 4): string {
  const section = (heading: string, offset: number) => `## ${heading}\n\n` + Array.from({ length: paragraphsPerSection }, (_, i) =>
    `${SENTENCES[(offset + i) % SENTENCES.length]} ${SENTENCES[(offset + i + 3) % SENTENCES.length]}`).join('\n\n')
  return [SENTENCES[0], section('핵심 내용', 1), section('배경과 업계 영향', 3), section('여행자가 확인할 점', 5)].join('\n\n')
}

function articlePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: '일본, 11월부터 공항 입국 신고 단일 앱으로 통합',
    summary: '일본정부관광국이 11월부터 주요 공항의 검역·세관 신고를 하나의 앱과 QR 코드로 통합한다.',
    metaDescription: '일본정부관광국이 11월부터 나리타·하네다·간사이 공항의 입국 신고 절차를 단일 앱으로 통합한다고 밝혔다.',
    keyTakeaways: ['11월부터 입국 신고 단일 앱 통합', '검역·세관 정보를 QR 코드 하나로 제출', '나리타·하네다·간사이부터 순차 확대'],
    content: koreanBody(),
    category: 'destination',
    tags: ['일본', '입국심사', '나리타공항'],
    claims: ['일본정부관광국은 11월부터 입국 신고 앱을 통합한다.', '대상 공항은 나리타, 하네다, 간사이부터 확대된다.'],
    ...overrides,
  }
}

function translationPayload() {
  const content = '## Key facts\n\n' + 'Japan will merge airport entry declarations into a single app from November. '.repeat(4)
    + '\n\n## Background\n\nAirlines expect shorter queues. '.repeat(3) + '\n\n## What travellers should check\n\nRegister 72 hours before departure.'
  return Object.fromEntries(['en', 'zh', 'th', 'vi', 'es'].map(lang => [lang, { title: `Japan unifies entry app (${lang})`, summary: 'Summary', content }]))
}

function geminiResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status, headers: { 'content-type': 'application/json' } })
}

function mockGemini(articleOverrides: Record<string, unknown> = {}) {
  const calls: string[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'), `unexpected fetch ${url}`)
    assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'test-key')
    const prompt = JSON.parse(String(init?.body)).contents[0].parts[0].text as string
    return geminiResponse(prompt.startsWith('Translate the following') ? translationPayload() : articlePayload(articleOverrides))
  }) as typeof fetch
  return { impl, calls }
}

const source = (overrides: Record<string, unknown> = {}) => ({
  title: 'Japan to unify airport entry declarations in one app',
  text: SENTENCES.join(' ') + ' ' + SENTENCES.join(' '),
  sourceName: 'Japan National Tourism Organization',
  sourceUrl: 'https://www.jnto.go.jp/news/entry-app-2026',
  publishedAt: '2026-11-01T00:00:00.000Z',
  licenseInfo: 'Official Press Release',
  ...overrides,
})

test('Gemini client retries rate limits and malformed JSON with backoff, then parses the schema', async () => {
  const delays: number[] = []
  let call = 0
  const fetchImpl = (async () => {
    call++
    if (call === 1) return new Response('slow down', { status: 429, headers: { 'retry-after': '2' } })
    if (call === 2) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{not json' }] } }] }))
    return geminiResponse(articlePayload())
  }) as typeof fetch
  const result = await callGeminiJson({ apiKey: 'k', fetchImpl, models: ['m1'], sleep: async ms => { delays.push(ms) } },
    'prompt', {}, parseGeminiArticle)
  assert.equal(result.attempts, 3)
  assert.equal(delays[0], 2000, 'Retry-After header is honoured')
  assert.ok(delays[1]! >= 2000, 'exponential backoff grows')
  assert.equal(result.value.category, 'destination')
})

test('Gemini client falls back to the next model on 404 and rejects refusals without retrying', async () => {
  const seen: string[] = []
  const fetchImpl = (async (input: RequestInfo | URL) => {
    seen.push(String(input))
    if (String(input).includes('missing-model')) return new Response('not found', { status: 404 })
    return geminiResponse({ title: "I'm sorry, but I cannot help with that." })
  }) as typeof fetch
  await assert.rejects(
    callGeminiJson({ apiKey: 'k', fetchImpl, models: ['missing-model', 'good-model'], sleep: async () => {} }, 'p', {}, parseGeminiArticle),
    (error: unknown) => error instanceof GenerationError && error.code === 'REFUSAL',
  )
  assert.equal(seen.length, 2)
})

test('quality gate blocks short, refusing or placeholder output and never pads text', () => {
  assert.equal(assessArticleQuality(parseGeminiArticle(articlePayload())).passed, true)
  const short = assessArticleQuality(parseGeminiArticle(articlePayload({ content: '## 제목\n\n짧은 본문입니다.' })))
  assert.equal(short.passed, false)
  assert.ok(short.issues.some(issue => issue.includes('too short')))
  const placeholder = assessArticleQuality(parseGeminiArticle(articlePayload({ content: koreanBody() + '\n\nLorem ipsum dolor sit amet' })))
  assert.ok(placeholder.issues.includes('error or placeholder text detected'))
  const woven = weaveImages('lead\n\n## a\n\nx\n\n## b\n\ny', ['https://img/1', 'https://img/2'], 'alt', 'File photo')
  assert.match(woven, /!\[alt\]\(https:\/\/img\/1 "File photo"\)\n\n## a/)
})

test('pipeline persists a source-grounded draft with tags, citations, unverified claims, translations and a generation log', async () => {
  const { database, sqlite } = testDatabase()
  const gemini = mockGemini()
  try {
    const policies = await loadPipelinePolicies(database)
    const result = await runArticlePipeline(database, {
      trigger: 'manual', actor: 'editor@test', policies: { ...policies, autoPublish: false },
      runtime: { apiKey: 'test-key', fetchImpl: gemini.impl, models: ['m'], sleep: async () => {} },
      source: source(),
    })
    assert.equal(result.status, 'drafted', JSON.stringify(result))
    const article = sqlite.prepare('SELECT * FROM articles WHERE id = ?').get(result.articleId!)!
    assert.equal(article.status, 'draft')
    assert.equal(article.review_status, 'needs_review')
    assert.equal(article.source_url, 'https://www.jnto.go.jp/news/entry-app-2026')
    assert.match(String(article.content), /자료 사진 · Unsplash/)
    assert.doesNotMatch(String(article.content), /현장 취재|IATA\)의 공식 권고안/)
    assert.equal(JSON.parse(String(article.key_takeaways_json)).length, 3)
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM article_tags WHERE article_id = ?').get(result.articleId!)!.n, 3)
    assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM article_fact_checks WHERE article_id = ? AND verification_status = 'unverified'").get(result.articleId!)!.n, 2)
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM article_translations WHERE article_id = ?').get(result.articleId!)!.n, 5)
    const log = sqlite.prepare('SELECT * FROM generation_logs WHERE id = ?').get(result.logId)!
    assert.equal(log.status, 'drafted')
    assert.equal(log.article_id, result.articleId)
    assert.equal(log.model, 'm')

    const again = await runArticlePipeline(database, {
      trigger: 'manual', actor: 'editor@test', policies,
      runtime: { apiKey: 'test-key', fetchImpl: gemini.impl, models: ['m'], sleep: async () => {} },
      source: source(),
    })
    assert.equal(again.status, 'duplicate')
    assert.equal(gemini.calls.length, 2, 'duplicate source is blocked before any model call')
  } finally { sqlite.close() }
})

test('quota exhaustion keeps the source queued for the next run and stops the batch', async () => {
  const { database, sqlite } = testDatabase()
  sqlite.exec("UPDATE news_sources SET is_active = 0")
  sqlite.prepare(`INSERT INTO news_sources (id, name, source_type, endpoint_url, license_info, is_active, fetch_interval_minutes)
    VALUES ('q', 'Quota Feed', 'rss', 'https://quota.example.org/feed.xml', 'Official Press Release', 1, 1)`).run()
  let geminiCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === 'https://quota.example.org/feed.xml') {
      const titles = ['Singapore opens new Changi terminal', 'Lisbon tightens short-term rental rules', 'Qantas adds Perth to Paris nonstop']
      return new Response(`<rss version="2.0"><channel>${[1, 2, 3].map(n => `<item><title>${titles[n - 1]}</title>
        <link>https://quota.example.org/s${n}</link><guid>q-${n}</guid><description>${SENTENCES.join(' ')}</description></item>`).join('')}</channel></rss>`)
    }
    if (url.startsWith('https://quota.example.org/s')) return new Response('', { status: 404 })
    geminiCalls++
    return new Response('quota', { status: 429 })
  }) as typeof fetch
  try {
    const result = await executeCronTasks(database, { env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'm' } })
    assert.equal(result.generation.length, 1, 'batch stops after the first rate-limited item')
    assert.equal(result.generation[0]!.errorCode, 'RATE_LIMITED')
    assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM feed_ingestion_items WHERE status = 'ingested' AND article_id IS NULL").get()!.n, 3)
    assert.ok(geminiCalls <= 3 * 2, `bounded retries, got ${geminiCalls}`)
  } finally { globalThis.fetch = originalFetch; sqlite.close() }
})

test('thin sources are rejected without calling the model', async () => {
  const { database, sqlite } = testDatabase()
  const gemini = mockGemini()
  try {
    const result = await runArticlePipeline(database, {
      trigger: 'cron', actor: 'ai-pipeline', policies: await loadPipelinePolicies(database),
      runtime: { apiKey: 'test-key', fetchImpl: gemini.impl, models: ['m'] },
      source: source({ text: 'Headline only', sourceUrl: 'https://example.org/thin' }),
    })
    assert.equal(result.status, 'rejected')
    assert.equal(result.errorCode, 'THIN_SOURCE')
    assert.equal(gemini.calls.length, 0)
  } finally { sqlite.close() }
})

test('auto-publish publishes rights-documented stories into public listings and the sitemap; restricted topics are held', async () => {
  const { database, sqlite } = testDatabase()
  try {
    const policies = { ...(await loadPipelinePolicies(database)), autoPublish: true }
    const published = await runArticlePipeline(database, {
      trigger: 'cron', actor: 'ai-pipeline', policies,
      runtime: { apiKey: 'test-key', fetchImpl: mockGemini().impl, models: ['m'], sleep: async () => {} },
      source: source(),
    })
    assert.equal(published.status, 'published', JSON.stringify(published))
    const visible = sqlite.prepare(`SELECT COUNT(*) n FROM articles a WHERE a.id = ? AND ${publicArticleSql}`).get(published.articleId!)!
    assert.equal(visible.n, 1)
    const sitemap = await articleSitemap(database, 'https://news.example', 1)
    assert.ok(sitemap.includes(`/news/destination/article/${published.articleId}`))
    assert.ok(sitemap.includes(`/en/news/destination/article/${published.articleId}`))

    const held = await runArticlePipeline(database, {
      trigger: 'cron', actor: 'ai-pipeline', policies,
      runtime: { apiKey: 'test-key', fetchImpl: mockGemini({ title: '공항 폭탄 위협 신고로 항공편 지연', summary: '폭탄 위협 신고가 접수됐다.' }).impl, models: ['m'], sleep: async () => {} },
      source: source({ sourceUrl: 'https://www.jnto.go.jp/news/other-story', title: 'Different story' }),
    })
    assert.equal(held.status, 'drafted')
    assert.match(held.reason || '', /restricted keyword/)
  } finally { sqlite.close() }
})

test('cron runner ingests a feed, reads the source page and generates an article end to end', async () => {
  const { database, sqlite } = testDatabase()
  sqlite.exec("UPDATE news_sources SET is_active = 0")
  sqlite.prepare(`INSERT INTO news_sources (id, name, source_type, endpoint_url, license_info, is_active, fetch_interval_minutes)
    VALUES ('jnto', 'JNTO Newsroom', 'rss', 'https://www.jnto.go.jp/feed.xml', 'Official Press Release', 1, 1)`).run()
  const gemini = mockGemini()
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === 'https://www.jnto.go.jp/feed.xml') {
      return new Response(`<?xml version="1.0"?><rss version="2.0"><channel><item><title>Japan to unify entry declarations</title>
        <link>https://www.jnto.go.jp/news/entry-app-2026</link><guid>jnto-1</guid><description>Entry app update</description></item></channel></rss>`)
    }
    if (url === 'https://www.jnto.go.jp/news/entry-app-2026') {
      return new Response(`<html><head><meta property="og:site_name" content="JNTO"></head><body><article>${SENTENCES.map(s => `<p>${s} ${s}</p>`).join('')}</article></body></html>`,
        { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    return gemini.impl(input, init)
  }) as typeof fetch
  try {
    const result = await executeCronTasks(database, { env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'm' } })
    assert.equal(result.totalGenerated, 1, JSON.stringify(result))
    const item = sqlite.prepare("SELECT status, article_id FROM feed_ingestion_items WHERE guid = 'jnto-1'").get()!
    assert.equal(item.status, 'draft')
    const article = sqlite.prepare('SELECT source_name, license_info FROM articles WHERE id = ?').get(item.article_id as number)!
    assert.equal(article.source_name, 'JNTO')
    assert.equal(article.license_info, 'Official Press Release')
  } finally { globalThis.fetch = originalFetch; sqlite.close() }
})

test('JSON sanitizer recovers fenced, prefixed and control-character output', () => {
  assert.deepEqual(safeParseArticleJson('Here you go:\n```json\n{"a": 1}\n```\nThanks!'), { a: 1 })
  assert.deepEqual(safeParseArticleJson('{"text": "line one\nline two\u0007"}'), { text: 'line one\nline two' })
  assert.equal(safeParseArticleJson('no json at all'), null)
})

test('RSS media tags yield thumbnails and source URLs normalize before dedup', () => {
  assert.equal(extractMediaUrl('<item><media:content url="https://img.example/a.jpg" medium="image"/></item>'), 'https://img.example/a.jpg')
  assert.equal(extractMediaUrl('<item><enclosure url="https://img.example/b.png" type="image/png" length="1"/></item>'), 'https://img.example/b.png')
  assert.equal(extractMediaUrl('<item><enclosure url="https://cdn.example/a.mp3" type="audio/mpeg"/></item>'), '')
  assert.equal(normalizeSourceUrl('https://WWW.Example.org/story/?utm_source=x&id=2#top'), 'https://www.example.org/story?id=2')
})

test('source headline hash blocks a re-published source under a new URL before any model call', async () => {
  const { database, sqlite } = testDatabase()
  const gemini = mockGemini()
  try {
    const run = (overrides: Record<string, unknown>) => runArticlePipeline(database, {
      trigger: 'cron', actor: 'ai-pipeline', policies: loadedPolicies,
      runtime: { apiKey: 'test-key', fetchImpl: gemini.impl, models: ['m'], sleep: async () => {} },
      source: source(overrides),
    })
    const loadedPolicies = { ...(await loadPipelinePolicies(database)), autoTranslate: false }
    assert.equal((await run({})).status, 'drafted')
    const again = await run({ sourceUrl: 'https://mirror.example.net/entry-app' })
    assert.equal(again.status, 'duplicate')
    assert.match(again.reason || '', /source headline already processed/)
    assert.equal(gemini.calls.length, 1)
  } finally { sqlite.close() }
})

test('source extractor keeps article paragraphs and drops scripts and navigation', () => {
  const extracted = extractArticleText(`<html><head><meta property="og:description" content="Desc &amp; more"></head><body>
    <nav><p>Home About Contact Subscribe to our newsletter today</p></nav><script>var x = "<p>bad</p>"</script>
    <article><p>${'Real reporting sentence about the airport. '.repeat(3)}</p><p>short</p></article></body></html>`)
  assert.equal(extracted.description, 'Desc & more')
  assert.match(extracted.text, /Real reporting sentence/)
  assert.doesNotMatch(extracted.text, /bad|Home About/)
})
