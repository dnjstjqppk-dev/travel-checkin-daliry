// Scheduled newsroom worker: publishes due scheduled jobs, ingests RSS/Atom sources,
// then turns the ingestion backlog into AI-written articles through the shared pipeline.
import { transitionArticle } from './editorial-workflow'
import { isDuplicateOrClustered } from './text-similarity'
import { d1All, d1First, d1Run, type D1Database } from './d1'
import { parseRssOrAtomXml } from './feed-parser'
import { assertSafeExternalUrl } from './ssrf-guard'
import { siteConfig } from '../../config/site.config'
import { resolveGeminiModels } from './gemini-client'
import { loadPipelinePolicies, runArticlePipeline, type PipelineResult } from './article-pipeline'
import { fetchSourceContext, htmlToText } from './source-extractor'

interface NewsSourceRow {
  id: string
  name: string
  source_type: string
  endpoint_url: string
  fetch_interval_minutes: number
  license_info: string
  is_active: number
}

interface ScheduledJobRow {
  id: number
  article_id: number
  scheduled_at: string
}

interface BacklogRow {
  id: number
  title: string
  link: string
  pub_date: string
  summary: string
  category: string
  source_id: string
  source_name: string
  license_info: string
  raw_payload: string
}

export interface CronExecutionResult {
  success: boolean
  message: string
  totalFetched: number
  totalDuplicates: number
  totalDrafts: number
  totalGenerated: number
  totalAutoPublished: number
  totalRejected: number
  totalScheduledPublished: number
  generation: Array<Pick<PipelineResult, 'status' | 'articleId' | 'title' | 'reason' | 'errorCode' | 'logId'>>
  timestamp: string
}

export interface CronOptions {
  env?: Record<string, unknown>
  /** Restrict ingestion to one source (manual trigger). */
  sourceId?: string
  /** Skip feed fetching and only process the existing backlog. */
  skipIngestion?: boolean
  maxGenerations?: number
}

const CATEGORY_SLUGS = ['major', 'airline', 'hotel', 'destination']

export async function resolveGeminiApiKey(database: D1Database, env?: Record<string, unknown>): Promise<string> {
  const fromEnv = env?.GEMINI_API_KEY ?? (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined)
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  const row = await d1First<{ value: string }>(database, "SELECT value FROM site_settings WHERE key = 'gemini_api_key'").catch(() => null)
  return row?.value?.trim() || ''
}

async function ingestSource(database: D1Database, source: NewsSourceRow, now: string, recentTitles: string[], restrictedKeywords: string[]) {
  let fetched = 0
  let duplicates = 0
  let runId = 0
  try {
    const runInsert = await d1Run(database, 'INSERT INTO ingestion_runs (source_id, started_at, status) VALUES (?, ?, ?)', source.id, now, 'running')
    runId = Number(runInsert.meta?.last_row_id || 0)
  } catch {
    // run tracking is best-effort
  }

  try {
    // Workers only support redirect 'follow' | 'manual'; follow up to 3 hops manually,
    // re-applying the SSRF guard to every Location so a redirect cannot reach private hosts.
    let target = assertSafeExternalUrl(source.endpoint_url).toString()
    let res: Response | null = null
    for (let hop = 0; hop <= 3; hop++) {
      res = await fetch(target, {
        headers: {
          'User-Agent': `CheckInDaily-NewsBot/2.1 (+${siteConfig.domain})`,
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      })
      if (res.status < 300 || res.status >= 400) break
      const location = res.headers.get('location')
      if (!location || hop === 3) throw new Error(`Too many or invalid redirects from ${source.endpoint_url}`)
      target = assertSafeExternalUrl(new URL(location, target).toString()).toString()
    }
    if (!res || !res.ok) throw new Error(`HTTP ${res?.status ?? 'n/a'} from ${source.endpoint_url}`)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Feed response body missing')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 2 * 1024 * 1024) throw new Error('Feed exceeds 2 MiB limit')
        chunks.push(value)
      }
    } finally { await reader.cancel().catch(() => {}) }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const items = await parseRssOrAtomXml(new TextDecoder().decode(bytes))

    for (const item of items.slice(0, 5)) {
      const existing = await d1First<{ id: number }>(database, 'SELECT id FROM feed_ingestion_items WHERE guid = ? OR link = ?', item.guid, item.link)
      if (existing) { duplicates++; continue }
      fetched++
      const nearDuplicate = recentTitles.some(title => isDuplicateOrClustered(item.title, title, 0.65))
      const restricted = restrictedKeywords.some(keyword => item.title.includes(keyword) || item.summary.includes(keyword))
      const status = nearDuplicate ? 'duplicate' : restricted ? 'rejected' : 'ingested'
      if (nearDuplicate) duplicates++
      else recentTitles.push(item.title)
      await d1Run(database,
        `INSERT INTO feed_ingestion_items (source_id, guid, title, link, pub_date, summary, category, status, is_duplicate, raw_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        source.id, item.guid, item.title, item.link, item.pubDate, item.summary, item.category, status,
        nearDuplicate ? 1 : 0, JSON.stringify(item))
    }

    await d1Run(database, 'UPDATE news_sources SET last_fetched_at = ?, last_status = ? WHERE id = ?', now, 'ok', source.id)
    if (runId) {
      await d1Run(database, 'UPDATE ingestion_runs SET completed_at = ?, status = ?, fetched_count = ?, duplicate_count = ? WHERE id = ?',
        new Date().toISOString(), 'success', fetched, duplicates, runId)
    }
    return { fetched, duplicates, failed: false }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await d1Run(database, 'UPDATE news_sources SET last_fetched_at = ?, last_status = ? WHERE id = ?', now, `error: ${errMsg.slice(0, 100)}`, source.id).catch(() => {})
    if (runId) {
      await d1Run(database, 'UPDATE ingestion_runs SET completed_at = ?, status = ?, error_count = 1, error_detail = ? WHERE id = ?',
        new Date().toISOString(), 'failed', errMsg.slice(0, 500), runId).catch(() => {})
    }
    return { fetched, duplicates, failed: true }
  }
}

/** Builds the reporting context for a backlog item from its feed summary and the source page. */
async function buildSourceText(item: BacklogRow): Promise<{ text: string; publisher: string; images: string[] }> {
  const feedSummary = htmlToText(item.summary || '')
  let page = null
  try {
    page = await fetchSourceContext(item.link)
  } catch {
    page = null
  }
  const parts = [feedSummary, page?.description || '', page?.text || '']
    .map(part => part.trim()).filter((part, index, all) => part && all.indexOf(part) === index)
  // A feed summary that merely repeats the headline is not reporting.
  const text = parts.filter(part => part !== item.title && !(part.length < 200 && item.title.includes(part))).join('\n\n')
  let feedImage = ''
  try {
    feedImage = String((JSON.parse(item.raw_payload || '{}') as { imageUrl?: string }).imageUrl || '')
  } catch {
    feedImage = ''
  }
  const images = [feedImage, page?.ogImage || ''].filter(url => /^https:\/\//i.test(url))
  return { text, publisher: page?.siteName || '', images }
}

export async function executeCronTasks(database: D1Database, options: CronOptions = {}): Promise<CronExecutionResult> {
  const now = new Date().toISOString()
  let totalScheduledPublished = 0

  // 1. Scheduled publication jobs
  try {
    const dueJobs = await d1All<ScheduledJobRow>(database,
      `SELECT j.id, j.article_id, j.scheduled_at FROM publish_jobs j
       JOIN articles a ON a.id = j.article_id
       WHERE j.status = 'pending' AND a.status = 'draft' AND a.review_status = 'scheduled'
         AND julianday(j.scheduled_at) <= julianday('now')`)
    for (const job of dueJobs) {
      try {
        await transitionArticle(database, { articleId: job.article_id, decision: 'approve', actor: 'cron-scheduler', jobId: job.id })
        totalScheduledPublished++
      } catch (error) {
        console.error('[CronRunner] Publication blocked', job.id, error instanceof Error ? error.message : 'unknown')
      }
    }
  } catch (err) {
    console.error('[CronRunner] Error processing scheduled publish jobs:', err)
  }

  const empty = { totalFetched: 0, totalDuplicates: 0, totalDrafts: 0, totalGenerated: 0, totalAutoPublished: 0, totalRejected: 0, generation: [] }

  // 2. Global kill-switch
  const killSwitch = await d1First<{ value: string }>(database, "SELECT value FROM automation_policies WHERE key = 'is_automation_paused'")
  if (killSwitch?.value === '1') {
    return { success: false, message: 'Automation is currently PAUSED by Editorial Kill-Switch.', ...empty, totalScheduledPublished, timestamp: now }
  }

  const policyRows = await d1All<{ key: string; value: string }>(database, 'SELECT key, value FROM automation_policies')
  const policyMap = Object.fromEntries(policyRows.map(p => [p.key, p.value]))
  const autoDraft = policyMap.auto_draft_enabled === '1'
  const pipelinePolicies = await loadPipelinePolicies(database)

  // 3. Ingestion
  let totalFetched = 0
  let totalDuplicates = 0
  let totalSourceFailures = 0
  if (!options.skipIngestion) {
    const recentTitles = (await d1All<{ title: string }>(database,
      "SELECT title FROM feed_ingestion_items WHERE datetime(created_at) >= datetime('now', '-3 days') ORDER BY id DESC LIMIT 50")
      .catch((): Array<{ title: string }> => [])).map(row => row.title)
    const sources = options.sourceId
      ? await d1All<NewsSourceRow>(database, 'SELECT * FROM news_sources WHERE id = ?', options.sourceId)
      : await d1All<NewsSourceRow>(database,
        "SELECT * FROM news_sources WHERE is_active = 1 AND (last_fetched_at IS NULL OR julianday(last_fetched_at) + fetch_interval_minutes / 1440.0 <= julianday('now'))")
    for (const source of sources) {
      const outcome = await ingestSource(database, source, now, recentTitles, pipelinePolicies.restrictedKeywords)
      totalFetched += outcome.fetched
      totalDuplicates += outcome.duplicates
      if (outcome.failed) totalSourceFailures++
    }
  }

  // 4. Generation from backlog
  let totalDrafts = 0
  let totalGenerated = 0
  let totalAutoPublished = 0
  let totalRejected = 0
  const generation: CronExecutionResult['generation'] = []
  if (autoDraft) {
    const apiKey = await resolveGeminiApiKey(database, options.env)
    const limit = Math.max(0, Math.min(10, options.maxGenerations ?? (Number(policyMap.max_generations_per_run) || 3)))
    const backlog = await d1All<BacklogRow>(database,
      `SELECT f.id, f.title, f.link, f.pub_date, f.summary, f.category, f.source_id, f.raw_payload, s.name AS source_name, s.license_info
       FROM feed_ingestion_items f JOIN news_sources s ON s.id = f.source_id
       WHERE f.status = 'ingested' AND f.article_id IS NULL AND julianday(f.created_at) >= julianday('now', '-2 days')
       ORDER BY f.id DESC LIMIT ?`, apiKey ? limit : 50)

    for (const item of backlog) {
      if (!apiKey) {
        // Without an AI provider the item becomes a source-linked review task for a human writer.
        const row = await database.prepare(`INSERT INTO articles (
            title, slug, summary, content, category, author, cover_image, status, review_status,
            source_name, source_url, license_info, view_count, published_at, ingested_at, created_at, updated_at
          ) VALUES (?, ?, '', '', ?, '', '', 'draft', 'needs_review', ?, ?, ?, 0, NULL, ?, ?, ?) RETURNING id`)
          .bind(item.title, crypto.randomUUID(), CATEGORY_SLUGS.includes(item.category) ? item.category : 'major',
            item.source_name, item.link, item.license_info || '', now, now, now)
          .first<{ id: number }>()
        if (row?.id) {
          await d1Run(database, "UPDATE feed_ingestion_items SET status = 'draft', article_id = ? WHERE id = ?", row.id, item.id)
          totalDrafts++
        }
        continue
      }
      const context = await buildSourceText(item)
      const result = await runArticlePipeline(database, {
        trigger: 'cron',
        actor: 'ai-pipeline',
        runtime: { apiKey, models: resolveGeminiModels(options.env) },
        policies: pipelinePolicies,
        source: {
          title: item.title,
          text: context.text,
          sourceName: context.publisher || item.source_name,
          sourceUrl: item.link,
          publishedAt: item.pub_date,
          preferredCategory: CATEGORY_SLUGS.includes(item.category) ? item.category : undefined,
          sourceId: item.source_id,
          licenseInfo: item.license_info || '',
          ingestionItemId: item.id,
          imageCandidates: context.images,
        },
      })
      generation.push({ status: result.status, articleId: result.articleId, title: result.title, reason: result.reason, errorCode: result.errorCode, logId: result.logId })
      if (result.status === 'drafted' || result.status === 'published') {
        totalGenerated++
        totalDrafts++
        if (result.status === 'published') totalAutoPublished++
      } else if (result.status === 'duplicate') {
        totalDuplicates++
      } else {
        totalRejected++
      }
      // Quota exhausted or provider down: stop this run instead of burning retries on every item.
      if (result.errorCode === 'RATE_LIMITED' || result.errorCode === 'NO_API_KEY') break
    }
  }

  await d1Run(database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'system', 'cron-crawler', 'ingestion_pipeline_run', 'feed_ingestion_items',
    JSON.stringify({ totalFetched, totalDuplicates, totalDrafts, totalGenerated, totalAutoPublished, totalRejected, totalScheduledPublished, timestamp: now }))

  return {
    success: totalSourceFailures === 0,
    message: `Scheduled published: ${totalScheduledPublished}, fetched: ${totalFetched}, duplicates: ${totalDuplicates}, AI generated: ${totalGenerated} (auto-published ${totalAutoPublished}), rejected: ${totalRejected}, drafts: ${totalDrafts}, source failures: ${totalSourceFailures}.`,
    totalFetched,
    totalDuplicates,
    totalDrafts,
    totalGenerated,
    totalAutoPublished,
    totalRejected,
    totalScheduledPublished,
    generation,
    timestamp: now,
  }
}
