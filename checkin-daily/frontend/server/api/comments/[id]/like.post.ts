// checkin-daily/frontend/server/api/comments/[id]/like.post.ts
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getD1Database, d1First, d1Run } from '../../../utils/d1'

export default defineEventHandler(async (event) => {
  const commentId = parseInt(getRouterParam(event, 'id') || '', 10)
  if (!commentId || isNaN(commentId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid comment ID' })
  }

  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  await d1Run(
    database,
    `UPDATE comments SET like_count = like_count + 1 WHERE id = ? AND status = 'approved'`,
    commentId,
  )

  const updated = await d1First<{ like_count: number }>(
    database,
    `SELECT like_count FROM comments WHERE id = ?`,
    commentId,
  )

  return {
    success: true,
    likeCount: updated?.like_count || 0,
  }
})

