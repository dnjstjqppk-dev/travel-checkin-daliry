import { createError, defineEventHandler } from 'h3'
import { d1All, d1First, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  // 1. Overall traffic summary
  const humanViewsRow = await d1First<{ cnt: number }>(
    database,
    "SELECT COUNT(*) AS cnt FROM analytics_events WHERE event_type = 'page_view' AND bot_classification = 'human'",
  )
  const botViewsRow = await d1First<{ cnt: number }>(
    database,
    "SELECT COUNT(*) AS cnt FROM analytics_events WHERE bot_classification IN ('crawler', 'suspected_bot')",
  )
  const affiliateClicksRow = await d1First<{ cnt: number }>(
    database,
    "SELECT COUNT(*) AS cnt FROM analytics_events WHERE event_type = 'affiliate_click'",
  )
  const sharesRow = await d1First<{ cnt: number }>(
    database,
    "SELECT COUNT(*) AS cnt FROM analytics_events WHERE event_type = 'share'",
  )
  const bookmarksRow = await d1First<{ cnt: number }>(
    database,
    "SELECT COUNT(*) AS cnt FROM analytics_events WHERE event_type = 'bookmark'",
  )

  // 2. Affiliate clicks per platform
  const affiliateByPlatform = await d1All(
    database,
    `SELECT target_platform, COUNT(*) AS clicks
     FROM analytics_events
     WHERE event_type = 'affiliate_click'
     GROUP BY target_platform
     ORDER BY clicks DESC`,
  )

  // 3. Top viewed articles
  const topArticles = await d1All(
    database,
    `SELECT a.id, a.title, a.category, a.view_count, a.published_at,
       (SELECT COUNT(*) FROM analytics_events WHERE article_id = a.id AND event_type = 'affiliate_click') AS affiliate_clicks
     FROM articles a
     WHERE a.status = 'published'
     ORDER BY a.view_count DESC
     LIMIT 15`,
  )

  return {
    summary: {
      humanViews: humanViewsRow?.cnt || 0,
      botViews: botViewsRow?.cnt || 0,
      affiliateClicks: affiliateClicksRow?.cnt || 0,
      shares: sharesRow?.cnt || 0,
      bookmarks: bookmarksRow?.cnt || 0,
    },
    affiliateByPlatform,
    topArticles,
    generatedAt: new Date().toISOString(),
  }
})

