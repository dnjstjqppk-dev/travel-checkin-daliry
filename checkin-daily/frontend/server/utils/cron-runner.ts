// checkin-daily/frontend/server/utils/cron-runner.ts
import { d1All, d1First, d1Run, type D1Database } from './d1'
import { parseRssOrAtomXml } from './feed-parser'
import { generateNewsStory } from './ai-generator'
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
      `SELECT id, article_id, scheduled_at FROM publish_jobs
       WHERE status = 'pending' AND scheduled_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )

    for (const job of dueJobs) {
      await d1Run(
        database,
        `UPDATE articles SET
           status = 'published',
           published_at = COALESCE(published_at, ?),
           review_status = 'approved',
           updated_at = ?
         WHERE id = ?`,
        now,
        now,
        job.article_id,
      )

      await d1Run(
        database,
        "UPDATE publish_jobs SET status = 'published', published_at = ? WHERE id = ?",
        now,
        job.id,
      )

      await d1Run(
        database,
        'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
        'system',
        'cron-scheduler',
        'scheduled_auto_publish',
        `article:${job.article_id}`,
        JSON.stringify({ jobId: job.id, scheduled_at: job.scheduled_at, published_at: now }),
      )

      totalScheduledPublished++
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
  const autoPublish = policies.auto_publish_enabled === '1'
  const restrictedKeywords = (policies.restricted_keywords || '사망,테러,추락,사고,전쟁,비상사태,폭탄,피랍,의혹')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

  // 4. Fetch Active Sources
  const sources = await d1All<NewsSourceRow>(database, 'SELECT * FROM news_sources WHERE is_active = 1')
  let totalFetched = 0
  let totalDuplicates = 0
  let totalDrafts = 0

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

      const xmlText = await res.text()
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

        // Check restricted keywords
        const containsRestricted = restrictedKeywords.some((rk) =>
          item.title.includes(rk) || item.summary.includes(rk)
        )
        if (containsRestricted) {
          await d1Run(
            database,
            `INSERT INTO feed_ingestion_items (source_id, guid, title, link, summary, category, status, raw_payload)
             VALUES (?, ?, ?, ?, ?, ?, 'rejected', ?)`,
            source.id,
            item.guid,
            item.title,
            item.link,
            item.summary,
            item.category,
            JSON.stringify(item),
          )
          continue
        }

        // Record as ingested item
        await d1Run(
          database,
          `INSERT INTO feed_ingestion_items (source_id, guid, title, link, summary, category, status, raw_payload)
           VALUES (?, ?, ?, ?, ?, ?, 'ingested', ?)`,
          source.id,
          item.guid,
          item.title,
          item.link,
          item.summary,
          item.category,
          JSON.stringify(item),
        )

        // If autoDraft is enabled, generate editorial article
        if (autoDraft) {
          const generated = generateNewsStory(item.title, item.category)
          const articleStatus = autoPublish ? 'published' : 'draft'
          const reviewStatus = autoPublish ? 'approved' : 'needs_review'

          const insertArticleSql = `INSERT INTO articles (
            title, slug, summary, content, category, author, cover_image,
            status, review_status, view_count, published_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?) RETURNING id;`

          const articleRow = await database.prepare(insertArticleSql)
            .bind(
              generated.title,
              generated.slug,
              generated.summary,
              generated.content,
              generated.category,
              generated.author,
              generated.coverImage,
              articleStatus,
              reviewStatus,
              autoPublish ? now : null,
              now,
              now,
            )
            .first<{ id: number }>()

          if (articleRow?.id) {
            const articleId = articleRow.id

            // Map cities
            await d1Run(database, 'INSERT OR IGNORE INTO article_cities (article_id, city_id) VALUES (?, ?)', articleId, 'bkk')

            // Insert translations
            const translationStatements = [
              database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
                .bind(articleId, 'en', generated.translations.en.title, generated.translations.en.summary, generated.translations.en.content),
              database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
                .bind(articleId, 'zh', generated.translations.zh.title, generated.translations.zh.summary, generated.translations.zh.content),
              database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
                .bind(articleId, 'th', generated.translations.th.title, generated.translations.th.summary, generated.translations.th.content),
              database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
                .bind(articleId, 'vi', generated.translations.vi.title, generated.translations.vi.summary, generated.translations.vi.content),
              database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
                .bind(articleId, 'es', generated.translations.es.title, generated.translations.es.summary, generated.translations.es.content),
            ]
            await database.batch(translationStatements)

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
    success: true,
    message: `Ingestion & Scheduled Publishing completed. Scheduled Published: ${totalScheduledPublished}, Fetched: ${totalFetched}, Duplicates: ${totalDuplicates}, Drafts: ${totalDrafts}.`,
    totalFetched,
    totalDuplicates,
    totalDrafts,
    totalScheduledPublished,
    timestamp: now,
  }
}

