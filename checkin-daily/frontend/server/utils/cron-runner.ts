import { transitionArticle } from './editorial-workflow'
import { isDuplicateOrClustered } from './text-similarity'
// checkin-daily/frontend/server/utils/cron-runner.ts
import { d1All, d1First, d1Run, type D1Database } from './d1'
import { parseRssOrAtomXml } from './feed-parser'
import { assertSafeExternalUrl } from './ssrf-guard'

interface NewsSourceRow {
  id: string
  name: string
  source_type: string
  endpoint_url: string
  fetch_interval_minutes: number
  license_info: string
  is_active: number
}

interface AutomationPolicyRow {
  key: string
  value: string
}

interface ScheduledJobRow {
  id: number
  article_id: number
  scheduled_at: string
}

export interface CronExecutionResult {
  success: boolean
  message: string
  totalFetched: number
  totalDuplicates: number
  totalDrafts: number
  totalScheduledPublished: number
  timestamp: string
}

export async function executeCronTasks(database: D1Database): Promise<CronExecutionResult> {
  const now = new Date().toISOString()
  let totalScheduledPublished = 0

  // 1. Process Scheduled Publication Jobs (publish_jobs where scheduled_at <= now)
  try {
    const dueJobs = await d1All<ScheduledJobRow>(
      database,
      `SELECT j.id, j.article_id, j.scheduled_at FROM publish_jobs j
       JOIN articles a ON a.id = j.article_id
       WHERE j.status = 'pending' AND a.status = 'draft' AND a.review_status = 'scheduled'
         AND julianday(j.scheduled_at) <= julianday('now')`,
    )

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

  // 2. Check Global Automation Kill-Switch
  const killSwitch = await d1First<AutomationPolicyRow>(
    database,
    "SELECT value FROM automation_policies WHERE key = 'is_automation_paused'",
  )
  if (killSwitch?.value === '1') {
    return {
      success: false,
      message: 'Automation is currently PAUSED by Editorial Kill-Switch.',
      totalFetched: 0,
      totalDuplicates: 0,
      totalDrafts: 0,
      totalScheduledPublished,
      timestamp: now,
    }
  }

  // 3. Fetch Policies
  const policiesList = await d1All<AutomationPolicyRow>(database, 'SELECT key, value FROM automation_policies')
  const policies = Object.fromEntries(policiesList.map((p) => [p.key, p.value]))
  const autoDraft = policies.auto_draft_enabled === '1'
  const restrictedKeywords = (policies.restricted_keywords || '사망,테러,추락,사고,전쟁,비상사태,폭탄,피랍,의혹')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

  // 3.5. Recent Ingested Items for Clustering and Near-Duplicate Prevention
  const recentIngested: Array<{ title: string }> = await d1All<{ title: string }>(
    database,
    "SELECT title FROM feed_ingestion_items WHERE datetime(created_at) >= datetime('now', '-3 days') ORDER BY id DESC LIMIT 50",
  ).catch((): Array<{ title: string }> => [])

  // 4. Fetch Active Sources
  const sources = await d1All<NewsSourceRow>(database, "SELECT * FROM news_sources WHERE is_active = 1 AND (last_fetched_at IS NULL OR julianday(last_fetched_at) + fetch_interval_minutes / 1440.0 <= julianday('now'))")
  let totalFetched = 0
  let totalDuplicates = 0
  let totalDrafts = 0
  let totalSourceFailures = 0

  for (const source of sources) {
    let runId = 0
    try {
      const runInsert = await d1Run(
        database,
        'INSERT INTO ingestion_runs (source_id, started_at, status) VALUES (?, ?, ?)',
        source.id,
        now,
        'running',
      )
      runId = (runInsert.meta?.last_row_id || 0) as number
    } catch {
      // Ignore run tracker error
    }

    try {
      // SSRF Protection: strictly enforce HTTPS and block private/local/metadata IPs
      assertSafeExternalUrl(source.endpoint_url)

      // Fetch official XML / RSS feed with timeout & prevent redirect SSRF
      const res = await fetch(source.endpoint_url, {
        headers: {
          'User-Agent': 'CheckInDaily-NewsBot/2.0 (+https://checkindaily.com)',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${source.endpoint_url}`)
      }

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
      } finally { await reader.cancel() }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      const xmlText = new TextDecoder().decode(bytes)
      const items = await parseRssOrAtomXml(xmlText)

      let sourceFetched = 0
      let sourceDupes = 0

      for (const item of items.slice(0, 5)) {
        // Check duplicate in feed_ingestion_items
        const existing = await d1First<{ id: number }>(
          database,
          'SELECT id FROM feed_ingestion_items WHERE guid = ? OR link = ?',
          item.guid,
          item.link,
        )

        if (existing) {
          totalDuplicates++
          sourceDupes++
          continue
        }

        totalFetched++
        sourceFetched++
        // Check near-duplicate title similarity (>0.65 threshold) with recent items
        const isSimilarDupe = recentIngested.some((r) => isDuplicateOrClustered(item.title, r.title, 0.65))
        if (isSimilarDupe) {
          totalDuplicates++
          sourceDupes++
          await d1Run(
            database,
            `INSERT INTO feed_ingestion_items (source_id, guid, title, link, pub_date, summary, category, status, is_duplicate, raw_payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'duplicate', 1, ?)`,
            source.id,
            item.guid,
            item.title,
            item.link,
            item.pubDate,
            item.summary,
            item.category,
            JSON.stringify(item),
          ).catch(() => {})
          continue
        }
        recentIngested.push({ title: item.title })


        // Check restricted keywords
        const containsRestricted = restrictedKeywords.some((rk) =>
          item.title.includes(rk) || item.summary.includes(rk)
        )
        if (containsRestricted) {
          await d1Run(
            database,
            `INSERT INTO feed_ingestion_items (source_id, guid, title, link, pub_date, summary, category, status, raw_payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'rejected', ?)`,
            source.id,
            item.guid,
            item.title,
            item.link,
            item.pubDate,
            item.summary,
            item.category,
            JSON.stringify(item),
          )
          continue
        }

        // Record as ingested item
        await d1Run(
          database,
          `INSERT INTO feed_ingestion_items (source_id, guid, title, link, pub_date, summary, category, status, raw_payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ingested', ?)`,
          source.id,
          item.guid,
          item.title,
          item.link,
          item.pubDate,
          item.summary,
          item.category,
          JSON.stringify(item),
        )

        // If autoDraft is enabled, generate editorial article
        if (autoDraft) {
          // Feed access does not grant republication rights. Preserve provenance and
          // create a review-only draft; never invent body text, imagery, cities or translations.
          const articleStatus = 'draft'
          const articleRow = await database.prepare(`INSERT INTO articles (
            title, slug, summary, content, category, author, cover_image,
            status, review_status, source_name, source_url, license_info,
            view_count, published_at, created_at, updated_at
          ) VALUES (?, ?, ?, '', ?, '', '', 'draft', 'needs_review', ?, ?, ?, 0, NULL, ?, ?)
          RETURNING id`)
            .bind(item.title, crypto.randomUUID(), '', item.category || 'major',
              source.name, item.link, source.license_info || '', now, now)
            .first<{ id: number }>()

          if (articleRow?.id) {
            const articleId = articleRow.id

            // Link ingestion item to created article
            await d1Run(
              database,
              'UPDATE feed_ingestion_items SET status = ?, article_id = ? WHERE guid = ?',
              articleStatus,
              articleId,
              item.guid,
            )

            totalDrafts++
          }
        }
      }

      // Update source status
      await d1Run(
        database,
        'UPDATE news_sources SET last_fetched_at = ?, last_status = ? WHERE id = ?',
        now,
        'ok',
        source.id,
      )

      if (runId) {
        await d1Run(
          database,
          'UPDATE ingestion_runs SET completed_at = ?, status = ?, fetched_count = ?, duplicate_count = ? WHERE id = ?',
          new Date().toISOString(),
          'success',
          sourceFetched,
          sourceDupes,
          runId,
        )
      }
    } catch (err: unknown) {
      totalSourceFailures++
      const errMsg = err instanceof Error ? err.message : String(err)
      await d1Run(
        database,
        'UPDATE news_sources SET last_fetched_at = ?, last_status = ? WHERE id = ?',
        now,
        `error: ${errMsg.slice(0, 100)}`,
        source.id,
      )

      if (runId) {
        await d1Run(
          database,
          'UPDATE ingestion_runs SET completed_at = ?, status = ?, error_count = 1, error_detail = ? WHERE id = ?',
          new Date().toISOString(),
          'failed',
          errMsg.slice(0, 500),
          runId,
        )
      }
    }
  }

  // Record Audit Log
  await d1Run(
    database,
    `INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json)
     VALUES (?, ?, ?, ?, ?)`,
    'system',
    'cron-crawler',
    'ingestion_pipeline_run',
    'feed_ingestion_items',
    JSON.stringify({ totalFetched, totalDuplicates, totalDrafts, totalScheduledPublished, timestamp: now }),
  )

  return {
    success: totalSourceFailures === 0,
    message: `Ingestion & Scheduled Publishing completed. Scheduled Published: ${totalScheduledPublished}, Fetched: ${totalFetched}, Duplicates: ${totalDuplicates}, Drafts: ${totalDrafts}.`,
    totalFetched,
    totalDuplicates,
    totalDrafts,
    totalScheduledPublished,
    timestamp: now,
  }
}

