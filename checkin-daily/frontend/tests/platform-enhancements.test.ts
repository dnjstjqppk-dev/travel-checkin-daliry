import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateTitleSimilarity,
  isDuplicateOrClustered,
  normalizeTitle,
  getNGrams,
} from '../server/utils/text-similarity'
import { buildNewsletterHtml } from '../server/api/cron/newsletter.post'
import {
  pushUrlToIndexNow,
  pushUrlToGoogleIndexing,
  notifySearchEnginesOfPublication,
} from '../server/utils/indexing-api'
import { computeFactualIntegrityScore } from '../server/utils/ai-generator'

test('Text Similarity - Normalization and N-Grams', () => {
  assert.equal(normalizeTitle('방콕! 수완나품... 공항??'), '방콕 수완나품 공항')
  assert.equal(normalizeTitle('BANGKOK  AIRPORT   2026'), 'bangkok airport 2026')

  const ngrams = getNGrams('방콕수완나품', 3)
  assert.ok(ngrams.has('방콕수'))
  assert.ok(ngrams.has('수완나'))
})

test('Text Similarity - News Story Clustering and Deduplication', () => {
  const titleA = '태국 방콕 수완나품 공항 스마트 게이트 전면 도입 발표'
  const titleB = '방콕 수완나품 공항, 스마트 게이트 전면 도입으로 출국 시간 단축'
  const titleC = '프랑스 파리 루브르 박물관 야간 특별 관람권 오픈'

  const similarityAB = calculateTitleSimilarity(titleA, titleB)
  const similarityAC = calculateTitleSimilarity(titleA, titleC)

  assert.ok(similarityAB > 0.55, `Expected similarityAB > 0.55, got ${similarityAB}`)
  assert.ok(similarityAC < 0.35, `Expected similarityAC < 0.35, got ${similarityAC}`)

  assert.equal(isDuplicateOrClustered(titleA, titleB, 0.55), true)
  assert.equal(isDuplicateOrClustered(titleA, titleA), true)
  assert.equal(isDuplicateOrClustered(titleA, titleC), false)
})

test('Factual Integrity Score - 2-Pass Reflection Scoring', () => {
  const highIntegrity = computeFactualIntegrityScore({
    sourceName: '태국 관광청 (TAT)',
    sourceUrl: 'https://www.tatnews.org/2026/04/smart-entry/',
    keyTakeaways: ['수치 데이터 1', '수치 데이터 2', '수치 데이터 3'],
    factChecks: [
      { claim: '핵심 정책 1', verification_status: 'VERIFIED', source: '공식 보도자료' },
      { claim: '통계 수치 2', verification_status: 'VERIFIED', source: 'IATA 통계' },
    ],
  })

  assert.ok(highIntegrity >= 95, `Expected score >= 95, got ${highIntegrity}`)

  const basicScore = computeFactualIntegrityScore({})
  assert.ok(basicScore >= 80 && basicScore <= 90, `Expected baseline score 80~90, got ${basicScore}`)
})

test('Search Engine Indexing API - Resilience and Fallbacks', async () => {
  const invalidResult = await pushUrlToIndexNow([])
  assert.equal(invalidResult.success, false)

  const noTokenResult = await pushUrlToGoogleIndexing('https://checkindaily.com/news/airline/article/1')
  assert.equal(noTokenResult.success, true)
  assert.ok(noTokenResult.error?.includes('skipped direct push'))

  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ status: 200 }), { status: 200 })
    const combined = await notifySearchEnginesOfPublication('https://checkindaily.com/news/major/article/100', [
      'https://checkindaily.com/en/news/major/article/100',
    ])
    assert.equal(combined.indexNowSubmitted, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Newsletter Generator - Email HTML Rendering', () => {
  const sampleArticles = [
    {
      id: 101,
      title: '방콕 신규 직항 노선 취항 발표',
      summary: '방콕 수완나품 공항과 인천을 잇는 신규 직항 노선이 정식 취항했습니다.',
      category: 'airline',
      cover_image: 'https://example.org/cover.jpg',
      published_at: new Date().toISOString(),
      view_count: 1420,
    },
  ]

  const html = buildNewsletterHtml(sampleArticles, '2026년 10월 31일', 'https://checkindaily.com')

  assert.ok(html.includes('방콕 신규 직항 노선 취항 발표'))
  assert.ok(html.includes('#01 // AIRLINE'))
  assert.ok(html.includes('https://checkindaily.com/news/airline/article/101'))
  assert.ok(html.includes('TripScanner'))
})
