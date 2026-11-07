// Ops view: recent AI generation runs, status totals, and published counts per category.
import { createError, defineEventHandler, setResponseHeader } from 'h3'
import { d1All, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'
import { publicArticleSql } from '../../utils/sitemap-data'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  setResponseHeader(event, 'Cache-Control', 'no-store')

  try {
    const [logs, totals, categories, backlog] = await Promise.all([
      d1All(database, `SELECT g.id, g.trigger_type, g.status, g.keyword AS source_title, g.source_url, g.model, g.attempts,
          g.char_count, g.article_id, g.error_code, g.error_detail, g.duration_ms, g.created_at, a.title AS article_title
        FROM generation_logs g LEFT JOIN articles a ON a.id = g.article_id ORDER BY g.id DESC LIMIT 40`),
      d1All<{ status: string; n: number }>(database,
        "SELECT status, COUNT(*) n FROM generation_logs WHERE julianday(created_at) >= julianday('now', '-7 days') GROUP BY status"),
      d1All<{ category: string; n: number }>(database,
        `SELECT a.category, COUNT(*) n FROM articles a WHERE ${publicArticleSql} GROUP BY a.category ORDER BY n DESC`),
      d1All<{ n: number }>(database,
        "SELECT COUNT(*) n FROM feed_ingestion_items WHERE status = 'ingested' AND article_id IS NULL AND julianday(created_at) >= julianday('now', '-2 days')"),
    ])
    return {
      logs,
      totals7d: Object.fromEntries(totals.map(row => [row.status, row.n])),
      publishedByCategory: categories,
      backlog: backlog[0]?.n ?? 0,
    }
  } catch (error) {
    console.error('[GenerationLogs] query failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Generation logs unavailable' })
  }
})
