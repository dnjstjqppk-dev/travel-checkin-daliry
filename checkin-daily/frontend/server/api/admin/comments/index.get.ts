// checkin-daily/frontend/server/api/admin/comments/index.get.ts
import { createError, defineEventHandler, getQuery } from 'h3'
import { getD1Database, d1All, d1First } from '../../../utils/d1'
import { authenticateAdmin } from '../../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const session = await authenticateAdmin(event, database)
  if (!session.identity) {
    throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  }

  const query = getQuery(event)
  const statusFilter = typeof query.status === 'string' ? query.status : ''
  const limit = Math.min(100, Math.max(10, parseInt(String(query.limit || '50'), 10)))

  let sql = `
    SELECT c.id, c.article_id, c.parent_id, c.author_name, c.author_email, c.content, c.status,
           c.like_count, c.created_at, a.title as article_title,
           (SELECT COUNT(*) FROM comment_reports r WHERE r.comment_id = c.id AND r.status = 'pending') as report_count
    FROM comments c
    LEFT JOIN articles a ON a.id = c.article_id
  `
  const params: unknown[] = []

  if (statusFilter && ['approved', 'pending_review', 'flagged', 'deleted'].includes(statusFilter)) {
    sql += ` WHERE c.status = ?`
    params.push(statusFilter)
  }

  sql += ` ORDER BY report_count DESC, c.id DESC LIMIT ?`
  params.push(limit)

  const rows = await d1All<any>(database, sql, ...params as any)
  const totalRes = await d1First<{ total: number }>(database, 'SELECT COUNT(*) as total FROM comments')

  return {
    success: true,
    total: totalRes?.total || 0,
    comments: rows,
  }
})
