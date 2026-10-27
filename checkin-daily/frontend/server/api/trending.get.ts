import { createError, defineEventHandler } from 'h3'
import { d1All, getD1Database } from '../utils/d1'

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

  try {
    const rows = await d1All<TrendingArticleRow>(
      database,
      `SELECT id, title, slug, category, is_breaking, view_count, published_at
       FROM articles
       WHERE status = 'published'
       ORDER BY is_breaking DESC, view_count DESC, id DESC
       LIMIT 10`,
    )
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
  } catch {
    return { success: true, articles: [] }
  }
})

