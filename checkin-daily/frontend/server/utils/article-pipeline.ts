// End-to-end AI article pipeline:
// dedup -> source context -> Gemini generation -> quality gate -> media -> persist
// -> translations -> optional auto-publish, with every run recorded in generation_logs.
import { d1All, d1First, d1Run, type D1Database } from './d1'
import { normalizeTitle, isDuplicateOrClustered } from './text-similarity'
import { calculateBodyTextLength, validateArticleForPublish, ARTICLE_RULES } from '../../utils/article-validator'
import { pickEditorialImages } from '../../utils/editorial-media'
import {
  GENERATION_LANGS,
  GenerationError,
  containsGenerationArtifact,
  containsRefusal,
  generateArticleFromSource,
  translateArticle,
  type GeminiArticle,
  type GeminiRuntime,
  type SourceMaterial,
} from './gemini-client'
import { transitionArticle } from './editorial-workflow'
import { assertSafeExternalUrl } from './ssrf-guard'

export interface PipelinePolicies {
  autoPublish: boolean
  autoTranslate: boolean
  minQualityScore: number
  dailyPublishLimit: number
  minSourceChars: number
  minBodyChars: number
  useSourceMedia: boolean
  restrictedKeywords: string[]
}

export interface PipelineSource extends SourceMaterial {
  sourceId?: string
  licenseInfo: string
  ingestionItemId?: number
  /** Ordered thumbnail candidates: RSS media first, then the page og:image. */
  imageCandidates?: string[]
}

export interface PipelineInput {
  trigger: 'cron' | 'manual' | 'api'
  source: PipelineSource
  runtime: GeminiRuntime
  policies: PipelinePolicies
  actor: string
}

export type PipelineStatus = 'drafted' | 'published' | 'rejected' | 'duplicate' | 'failed'

export interface PipelineResult {
  status: PipelineStatus
  logId: number
  articleId?: number
  title?: string
  charCount?: number
  qualityScore?: number
  translations?: string[]
  reason?: string
  errorCode?: string
}

export interface QualityReport { passed: boolean; score: number; issues: string[] }

const DEFAULT_RESTRICTED = ['사망', '테러', '추락', '사고', '전쟁', '비상사태', '폭탄', '피랍', '의혹']

export async function loadPipelinePolicies(database: D1Database): Promise<PipelinePolicies> {
  const rows = await d1All<{ key: string; value: string }>(database, 'SELECT key, value FROM automation_policies').catch(() => [])
  const map = Object.fromEntries(rows.map(row => [row.key, row.value]))
  const num = (key: string, fallback: number) => {
    const value = Number(map[key])
    return Number.isFinite(value) ? value : fallback
  }
  return {
    autoPublish: map.auto_publish_enabled === '1',
    autoTranslate: map.auto_translation_enabled !== '0',
    minQualityScore: num('min_quality_score_threshold', 80),
    dailyPublishLimit: num('daily_publish_limit', 50),
    minSourceChars: num('min_source_context_chars', 160),
    minBodyChars: Math.max(ARTICLE_RULES.MIN_BODY_CHARS, num('min_generated_body_chars', 1200)),
    useSourceMedia: map.use_source_media === '1',
    restrictedKeywords: (map.restricted_keywords ?? DEFAULT_RESTRICTED.join(','))
      .split(',').map(keyword => keyword.trim()).filter(Boolean),
  }
}

export async function titleHash(title: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeTitle(title)))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|cmpid$|ocid$)/i

/** Drops fragments, tracking parameters and trailing slashes (the host is kept so the link still resolves). */
export function normalizeSourceUrl(raw: string): string {
  try {
    const url = new URL(raw.trim())
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key)
    url.searchParams.sort()
    return url.toString().replace(/\/+(\?|$)/, '$1')
  } catch {
    return raw.trim()
  }
}

/**
 * Gate 1 (before any LLM call): exact source URL or source-headline hash already processed.
 * Gate 2: headline similarity (>= 0.6) against the 50 most recent articles.
 */
export async function findDuplicateStory(database: D1Database, sourceUrl: string, title: string, options: { sourceHash?: string } = {}): Promise<string | null> {
  if (sourceUrl) {
    const normalized = normalizeSourceUrl(sourceUrl)
    const bySource = await d1First<{ id: number }>(database,
      'SELECT id FROM articles WHERE source_url = ? OR source_url = ? LIMIT 1', sourceUrl, normalized)
    if (bySource) return `source URL already used by article ${bySource.id}`
  }
  if (options.sourceHash) {
    const bySourceHash = await d1First<{ id: number }>(database, 'SELECT id FROM articles WHERE source_hash = ? LIMIT 1', options.sourceHash)
    if (bySourceHash) return `source headline already processed in article ${bySourceHash.id}`
  }
  const hash = await titleHash(title)
  const byHash = await d1First<{ id: number }>(database, 'SELECT id FROM articles WHERE title_hash = ? LIMIT 1', hash)
  if (byHash) return `identical headline exists in article ${byHash.id}`
  const recent = await d1All<{ id: number; title: string }>(database, 'SELECT id, title FROM articles ORDER BY id DESC LIMIT 50')
  const similar = recent.find(row => isDuplicateOrClustered(title, row.title, 0.6))
  return similar ? `near-duplicate of article ${similar.id}` : null
}

/**
 * Zero-broken-image resolver: first reachable https image among the candidates
 * (only when source media reuse is enabled), else the category stock pool.
 */
export async function resolveThumbnail(candidates: string[], enabled: boolean, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!enabled) return null
  for (const candidate of candidates) {
    try {
      const url = assertSafeExternalUrl(candidate)
      const response = await fetchImpl(url.toString(), { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(4000) })
      const type = response.headers.get('content-type') || ''
      if (response.ok && type.startsWith('image/')) return url.toString()
    } catch {
      // unreachable or unsafe candidate — try the next one
    }
  }
  return null
}

function hangulRatio(value: string): number {
  const letters = value.match(/[\p{L}]/gu) || []
  if (!letters.length) return 0
  return (value.match(/[가-힣]/g) || []).length / letters.length
}

export function assessArticleQuality(article: GeminiArticle, minBodyChars: number = ARTICLE_RULES.MIN_BODY_CHARS): QualityReport {
  const issues: string[] = []
  const combined = `${article.title}\n${article.summary}\n${article.content}`
  const length = calculateBodyTextLength(article.content)
  const headings = (article.content.match(/^##\s+\S/gm) || []).length
  if (containsRefusal(combined)) issues.push('AI refusal text detected')
  if (containsGenerationArtifact(combined)) issues.push('error or placeholder text detected')
  if (length < minBodyChars) issues.push(`body too short (${length} chars, minimum ${minBodyChars})`)
  if (length > ARTICLE_RULES.MAX_BODY_CHARS) issues.push(`body too long (${length} chars)`)
  if (headings < 2) issues.push(`needs at least 2 subheadings (found ${headings})`)
  if ([...article.title].length < 10 || [...article.title].length > 120) issues.push('headline length out of range')
  if (article.keyTakeaways.length < 3) issues.push('fewer than 3 key takeaways')
  if (hangulRatio(article.content) < 0.5) issues.push('body is not primarily Korean')

  // Score reflects measurable completeness only; it is not a fact-check verdict.
  let score = 100
  score -= issues.length * 20
  if (article.tags.length < 3) score -= 5
  if (article.claims.length < 2) score -= 5
  if (!article.metaDescription) score -= 5
  if (headings < 3) score -= 5
  return { passed: issues.length === 0, score: Math.max(0, Math.min(100, score)), issues }
}

/** Places one captioned file photo before each subheading after the first. */
export function weaveImages(content: string, images: string[], alt: string, caption: string): string {
  const sections = content.split(/\n(?=##\s)/)
  let imageIndex = 0
  const woven = sections.map((section, index) => {
    if (index === 0 || imageIndex >= images.length) return section
    return `![${alt}](${images[imageIndex++]} "${caption}")\n\n${section}`
  })
  let result = woven.join('\n\n').replace(/\n{3,}/g, '\n\n')
  while (imageIndex < images.length) result += `\n\n![${alt}](${images[imageIndex++]} "${caption}")`
  return result
}

function asciiSlug(category: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${category}-${date}-${crypto.randomUUID().slice(0, 8)}`
}

function tagSlug(tag: string): string {
  return tag.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

const IMAGE_CAPTIONS: Record<string, string> = {
  ko: '자료 사진 · Unsplash', en: 'File photo · Unsplash', ja: '資料写真 · Unsplash', zh: '资料图片 · Unsplash',
  th: 'ภาพประกอบ · Unsplash', vi: 'Ảnh minh họa · Unsplash', es: 'Foto de archivo · Unsplash',
}

async function updateLog(database: D1Database, logId: number, fields: Record<string, string | number | null>) {
  if (!logId) return
  const keys = Object.keys(fields)
  await d1Run(database, `UPDATE generation_logs SET ${keys.map(key => `${key} = ?`).join(', ')} WHERE id = ?`,
    ...keys.map(key => fields[key]!), logId).catch(error => console.error('[Pipeline] log update failed', error))
}

async function markIngestionItem(database: D1Database, itemId: number | undefined, status: string, articleId?: number) {
  if (!itemId) return
  await d1Run(database, 'UPDATE feed_ingestion_items SET status = ?, article_id = COALESCE(?, article_id), processed_to_draft = ? WHERE id = ?',
    status, articleId ?? null, articleId ? 1 : 0, itemId).catch(() => {})
}

export async function runArticlePipeline(database: D1Database, input: PipelineInput): Promise<PipelineResult> {
  const started = Date.now()
  const { source, policies } = input
  const logInsert = await d1Run(database,
    `INSERT INTO generation_logs (trigger_type, source_id, ingestion_item_id, source_url, keyword, status)
     VALUES (?, ?, ?, ?, ?, 'started')`,
    input.trigger, source.sourceId ?? null, source.ingestionItemId ?? null, source.sourceUrl, source.title.slice(0, 300))
  const logId = Number(logInsert.meta?.last_row_id || 0)
  const finish = async (result: Omit<PipelineResult, 'logId'>, extra: Record<string, string | number | null> = {}) => {
    await updateLog(database, logId, {
      status: result.status,
      article_id: result.articleId ?? null,
      char_count: result.charCount ?? 0,
      error_code: result.errorCode ?? '',
      error_detail: (result.reason ?? '').slice(0, 1000),
      duration_ms: Date.now() - started,
      ...extra,
    })
    return { ...result, logId }
  }

  try {
    const sourceHash = await titleHash(source.title)
    const duplicate = await findDuplicateStory(database, source.sourceUrl, source.title, { sourceHash })
    if (duplicate) {
      await markIngestionItem(database, source.ingestionItemId, 'duplicate')
      return finish({ status: 'duplicate', reason: duplicate, errorCode: 'DUPLICATE' })
    }
    if (source.text.replace(/\s+/g, ' ').trim().length < policies.minSourceChars) {
      await markIngestionItem(database, source.ingestionItemId, 'rejected')
      return finish({ status: 'rejected', errorCode: 'THIN_SOURCE',
        reason: `source context has fewer than ${policies.minSourceChars} characters; refusing to write without reporting` })
    }

    // Generation with one corrective round when the body length misses the contract.
    let generated = await generateArticleFromSource(input.runtime, source)
    let attempts = generated.attempts
    let quality = assessArticleQuality(generated.value, policies.minBodyChars)
    // Up to two corrective rounds when the output misses the structural contract.
    for (let round = 0; round < 2 && !quality.passed && generated.value.content.trim()
      && quality.issues.some(issue => /body too|subheadings|takeaways/.test(issue)); round++) {
      generated = await generateArticleFromSource(input.runtime, source,
        `이전 응답이 다음 규칙을 위반했습니다: ${quality.issues.join('; ')}. 원천 자료에 있는 사실만으로 규칙을 지켜 다시 작성하세요.`)
      attempts += generated.attempts
      quality = assessArticleQuality(generated.value, policies.minBodyChars)
    }
    const article = generated.value
    if (!article.content.trim()) {
      await markIngestionItem(database, source.ingestionItemId, 'rejected')
      return finish({ status: 'rejected', errorCode: 'THIN_SOURCE', reason: 'model reported the source was not newsworthy' },
        { model: generated.model, attempts })
    }
    if (!quality.passed) {
      await markIngestionItem(database, source.ingestionItemId, 'rejected')
      return finish({ status: 'rejected', errorCode: 'QUALITY', reason: quality.issues.join('; '),
        charCount: calculateBodyTextLength(article.content), qualityScore: quality.score }, { model: generated.model, attempts })
    }
    // Generated headline may still collide with an existing story.
    const postDuplicate = await findDuplicateStory(database, '', article.title)
    if (postDuplicate) {
      await markIngestionItem(database, source.ingestionItemId, 'duplicate')
      return finish({ status: 'duplicate', reason: postDuplicate, errorCode: 'DUPLICATE' }, { model: generated.model, attempts })
    }

    const category = source.preferredCategory && source.preferredCategory !== 'realtime' ? source.preferredCategory : article.category
    const images = pickEditorialImages(category, article.title)
    const sourceCover = await resolveThumbnail(source.imageCandidates ?? [], policies.useSourceMedia)
    const cover = sourceCover ?? images.cover
    const content = weaveImages(article.content, images.body, article.title.slice(0, 80), IMAGE_CAPTIONS.ko!)
    const validation = validateArticleForPublish({ content, coverImage: cover })
    if (!validation.valid) {
      await markIngestionItem(database, source.ingestionItemId, 'rejected')
      return finish({ status: 'rejected', errorCode: 'QUALITY', reason: validation.errors.join('; '), charCount: validation.textLength },
        { model: generated.model, attempts })
    }

    const now = new Date().toISOString()
    const hash = await titleHash(article.title)
    const row = await database.prepare(`INSERT INTO articles (
        title, slug, summary, content, category, author, cover_image, status, review_status,
        source_name, source_url, license_info, quality_score, ingested_at, source_first_published_at,
        meta_description, key_takeaways_json, title_hash, source_hash, generated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'needs_review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
      .bind(article.title, asciiSlug(category), article.summary, content, category, 'Check-in Daily AI Desk',
        cover, source.sourceName, normalizeSourceUrl(source.sourceUrl), source.licenseInfo, quality.score, now,
        source.publishedAt || null, article.metaDescription, JSON.stringify(article.keyTakeaways), hash, sourceHash,
        generated.model, now, now)
      .first<{ id: number }>()
    if (!row?.id) throw new GenerationError('UPSTREAM', 'Article insert returned no id')
    const articleId = row.id

    const statements = [
      database.prepare('INSERT INTO article_citations (article_id, source_name, source_url, published_date, license_type) VALUES (?, ?, ?, ?, ?)')
        .bind(articleId, source.sourceName, source.sourceUrl, source.publishedAt || '', source.licenseInfo),
      ...article.claims.map(claim => database.prepare(`INSERT INTO article_fact_checks
          (article_id, claim, verification_status, evidence_url, checked_by, checked_at, notes) VALUES (?, ?, 'unverified', ?, 'ai-extraction', ?, ?)`)
        .bind(articleId, claim, source.sourceUrl, now, 'Claim attributed to the source; pending editor verification')),
    ]
    for (const tag of article.tags) {
      const slug = tagSlug(tag)
      if (!slug) continue
      statements.push(database.prepare('INSERT OR IGNORE INTO tags (slug, name) VALUES (?, ?)').bind(slug, tag))
      statements.push(database.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) SELECT ?, id FROM tags WHERE slug = ?').bind(articleId, slug))
    }
    await database.batch(statements)

    let translatedLangs: string[] = []
    let translationNote = ''
    if (policies.autoTranslate) {
      try {
        const translated = await translateArticle(input.runtime, { title: article.title, summary: article.summary, content: article.content })
        attempts += translated.attempts
        const inserts = GENERATION_LANGS.flatMap(lang => {
          const value = translated.value[lang]
          if (!value) return []
          const localized = weaveImages(value.content, images.body, value.title.slice(0, 80), IMAGE_CAPTIONS[lang] ?? IMAGE_CAPTIONS.en!)
          translatedLangs.push(lang)
          return [database.prepare('INSERT OR REPLACE INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
            .bind(articleId, lang, value.title, value.summary, localized)]
        })
        if (inserts.length) await database.batch(inserts)
        const missing = GENERATION_LANGS.filter(lang => !translatedLangs.includes(lang))
        if (missing.length) translationNote = `translations rejected by quality gate: ${missing.join(',')}`
      } catch (error) {
        translatedLangs = []
        translationNote = `translation failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    let status: PipelineStatus = 'drafted'
    let reason = translationNote
    const restricted = policies.restrictedKeywords.find(keyword => `${article.title} ${article.summary} ${article.content}`.includes(keyword))
    if (policies.autoPublish) {
      const publishedToday = await d1First<{ n: number }>(database,
        "SELECT COUNT(*) n FROM articles WHERE status = 'published' AND generated_by <> '' AND date(published_at) = date('now')")
      const blockers = [
        restricted ? `restricted keyword "${restricted}" requires editor review` : '',
        quality.score < policies.minQualityScore ? `quality score ${quality.score} below ${policies.minQualityScore}` : '',
        (publishedToday?.n ?? 0) >= policies.dailyPublishLimit ? 'daily auto-publish limit reached' : '',
      ].filter(Boolean)
      if (blockers.length) {
        reason = [reason, `held for review: ${blockers.join('; ')}`].filter(Boolean).join(' | ')
      } else {
        try {
          await transitionArticle(database, { articleId, decision: 'approve', actor: 'ai-pipeline' })
          status = 'published'
        } catch (error) {
          const message = (error as { statusMessage?: string }).statusMessage || (error instanceof Error ? error.message : String(error))
          reason = [reason, `held for review: ${message}`].filter(Boolean).join(' | ')
        }
      }
    }

    await markIngestionItem(database, source.ingestionItemId, status === 'published' ? 'published' : 'draft', articleId)
    return finish({ status, articleId, title: article.title, charCount: validation.textLength, qualityScore: quality.score,
      translations: translatedLangs, reason }, { model: generated.model, attempts })
  } catch (error) {
    const code = error instanceof GenerationError ? error.code : 'UPSTREAM'
    const message = error instanceof Error ? error.message : String(error)
    // Quota / provider outages are transient: keep the item queued so the next run retries it.
    const transient = code === 'RATE_LIMITED' || code === 'UPSTREAM' || code === 'TIMEOUT' || code === 'INVALID_JSON' || code === 'NO_API_KEY'
    if (!transient) await markIngestionItem(database, source.ingestionItemId, 'failed')
    return finish({ status: code === 'REFUSAL' || code === 'BLOCKED' ? 'rejected' : 'failed', errorCode: code,
      reason: transient ? `${message} (queued for retry)` : message })
  }
}
