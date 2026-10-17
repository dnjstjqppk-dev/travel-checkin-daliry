import { createError, defineEventHandler } from 'h3'
import { d1All, d1First, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  // Admin authentication check
  const session = await authenticateAdmin(event, database)
  if (!session.identity) {
    throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  }

  // 1. Article status counts
  const totalArticlesRow = await d1First<{ cnt: number }>(database, 'SELECT COUNT(*) AS cnt FROM articles')
  const publishedRow = await d1First<{ cnt: number }>(database, "SELECT COUNT(*) AS cnt FROM articles WHERE status = 'published'")
  const draftRow = await d1First<{ cnt: number }>(database, "SELECT COUNT(*) AS cnt FROM articles WHERE status = 'draft'")
  const reviewRow = await d1First<{ cnt: number }>(database, "SELECT COUNT(*) AS cnt FROM articles WHERE review_status IN ('needs_review', 'candidate')")
  const scheduledRow = await d1First<{ cnt: number }>(database, "SELECT COUNT(*) AS cnt FROM publish_jobs WHERE status = 'pending'")
  const retractedRow = await d1First<{ cnt: number }>(database, "SELECT COUNT(*) AS cnt FROM articles WHERE review_status = 'retracted'")

  // 2. Ingestion & Sources
  const activeSourcesRow = await d1First<{ cnt: number }>(database, 'SELECT COUNT(*) AS cnt FROM news_sources WHERE is_active = 1')
  const totalFeedItemsRow = await d1First<{ cnt: number }>(database, 'SELECT COUNT(*) AS cnt FROM feed_ingestion_items')
  const recentIngestionRuns = await d1All(
    database,
    'SELECT ir.id, ir.source_id, s.name AS source_name, ir.started_at, ir.status, ir.fetched_count, ir.duplicate_count, ir.error_count FROM ingestion_runs ir LEFT JOIN news_sources s ON s.id = ir.source_id ORDER BY ir.id DESC LIMIT 5',
  )

  // 3. Traffic & Affiliate Analytics
  const totalViewsRow = await d1First<{ cnt: number }>(database, "SELECT COUNT(*) AS cnt FROM analytics_events WHERE event_type = 'page_view' AND bot_classification = 'human'")
  const botViewsRow = await d1First<{ cnt: number }>(database, "SELECT COUNT(*) AS cnt FROM analytics_events WHERE bot_classification IN ('crawler', 'suspected_bot')")
  const affiliateClicksRow = await d1First<{ cnt: number }>(database, "SELECT COUNT(*) AS cnt FROM analytics_events WHERE event_type = 'affiliate_click'")

  // 4. Automation Policy Status
  const killSwitch = await d1First<{ value: string }>(database, "SELECT value FROM automation_policies WHERE key = 'is_automation_paused'")

  // 5. Recent 10 Articles
  const recentArticles = await d1All(
    database,
    'SELECT id, title, slug, category, status, review_status, view_count, quality_score, published_at, updated_at, created_at FROM articles ORDER BY id DESC LIMIT 10',
  )

  // 6. Source Health
  const sourcesHealth = await d1All(
    database,
    'SELECT id, name, endpoint_url, last_fetched_at, last_status, is_active FROM news_sources ORDER BY id ASC',
  )

  return {
    metrics: {
      totalArticles: totalArticlesRow?.cnt || 0,
      publishedCount: publishedRow?.cnt || 0,
      draftCount: draftRow?.cnt || 0,
      reviewCount: reviewRow?.cnt || 0,
      scheduledCount: scheduledRow?.cnt || 0,
      retractedCount: retractedRow?.cnt || 0,
      activeSources: activeSourcesRow?.cnt || 0,
      totalFeedItems: totalFeedItemsRow?.cnt || 0,
      humanViews: totalViewsRow?.cnt || 0,
      botViews: botViewsRow?.cnt || 0,
      affiliateClicks: affiliateClicksRow?.cnt || 0,
      isAutomationPaused: killSwitch?.value === '1',
    },
    sourcesHealth,
    recentIngestionRuns,
    recentArticles,
    dataTime: new Date().toISOString(),
  }
})

