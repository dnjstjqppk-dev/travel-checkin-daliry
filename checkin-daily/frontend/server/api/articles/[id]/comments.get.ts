// checkin-daily/frontend/server/api/articles/[id]/comments.get.ts
import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { getD1Database, d1All, d1First } from '../../../utils/d1'
import { buildCommentTree, type RawCommentRow } from '../../../utils/comments-guard'

export default defineEventHandler(async (event) => {
  const articleId = parseInt(getRouterParam(event, 'id') || '', 10)
  if (!articleId || isNaN(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  setResponseHeader(event, 'Cache-Control', 'public, max-age=15, s-maxage=30')

  try {
    const rows = await d1All<RawCommentRow>(
      database,
      `SELECT id, article_id, parent_id, author_name, content, status, like_count, created_at, updated_at
       FROM comments
       WHERE article_id = ? AND status IN ('approved', 'deleted')
       ORDER BY id ASC`,
      articleId,
    )

    const tree = buildCommentTree(rows)
    const countRes = await d1First<{ count: number }>(
      database,
      `SELECT COUNT(*) as count FROM comments WHERE article_id = ? AND status = 'approved'`,
      articleId,
    )

    return {
      success: true,
      totalCount: countRes?.count || 0,
      comments: tree,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw createError({ statusCode: 500, statusMessage: `Failed to fetch comments: ${msg}` })
  }
})

