// Header ticker: breaking stories first, then the latest published headlines.
import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { d1All, getD1Database } from '../utils/d1'
import { cachedPublic } from '../utils/response-cache'
import { publicArticleSql } from '../utils/sitemap-data'
import { LOCALES } from '../../config/locales'

interface TrendingArticleRow {
  id: number
  title: string
  slug: string
  category: string
  is_breaking: number
  view_count: number
  published_at: string
}

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const requested = String(getQuery(event).lang || 'ko')
  const lang = (LOCALES as readonly string[]).includes(requested) ? requested : 'ko'

  try {
    const rows = await cachedPublic(event, { ttlMs: 60_000, swrMs: 300_000 }, () => d1All<TrendingArticleRow>(database,
      `SELECT a.id, COALESCE(t.title, a.title) AS title, a.slug, a.category, a.is_breaking, a.view_count, a.published_at
       FROM articles a
       LEFT JOIN article_translations t ON t.article_id = a.id AND t.lang = ?
       WHERE ${publicArticleSql}
       ORDER BY a.is_breaking DESC, julianday(a.published_at) DESC, a.id DESC
       LIMIT 10`, lang))
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=600')
    return {
      success: true,
      articles: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        category: r.category,
        isBreaking: Boolean(r.is_breaking),
        viewCount: r.view_count,
        publishedAt: r.published_at,
      })),
    }
  } catch (error) {
    console.error('[Trending] query failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Trending stories unavailable' })
  }
})
