// checkin-daily/frontend/server/api/admin/comments/[id]/moderate.post.ts
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { getD1Database, d1Run } from '../../../../utils/d1'
import { authenticateAdmin } from '../../../../utils/d1-auth'

interface ModeratePayload {
  action: 'approve' | 'flag' | 'delete' | 'dismiss_reports'
}

export default defineEventHandler(async (event) => {
  const commentId = parseInt(getRouterParam(event, 'id') || '', 10)
  if (!commentId || isNaN(commentId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid comment ID' })
  }

  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const session = await authenticateAdmin(event, database)
  if (!session.identity) {
    throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  }

  const body = await readBody<ModeratePayload>(event)
  const action = body?.action

  const now = new Date().toISOString()

  if (action === 'approve') {
    await d1Run(database, `UPDATE comments SET status = 'approved', updated_at = ? WHERE id = ?`, now, commentId)
    await d1Run(database, `UPDATE comment_reports SET status = 'dismissed' WHERE comment_id = ?`, commentId)
  } else if (action === 'flag') {
    await d1Run(database, `UPDATE comments SET status = 'flagged', updated_at = ? WHERE id = ?`, now, commentId)
  } else if (action === 'delete') {
    await d1Run(database, `UPDATE comments SET status = 'deleted', content = '', updated_at = ? WHERE id = ?`, now, commentId)
    await d1Run(database, `UPDATE comment_reports SET status = 'resolved' WHERE comment_id = ?`, commentId)
  } else if (action === 'dismiss_reports') {
    await d1Run(database, `UPDATE comment_reports SET status = 'dismissed' WHERE comment_id = ?`, commentId)
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Invalid moderation action' })
  }

  return {
    success: true,
    message: '댓글 모더레이션이 적용되었습니다.',
  }
})

