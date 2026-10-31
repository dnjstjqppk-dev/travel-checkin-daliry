// checkin-daily/frontend/server/api/comments/[id]/report.post.ts
import { createError, defineEventHandler, getRequestHeader, getRouterParam, readBody } from 'h3'
import { getD1Database, d1First, d1Run } from '../../../utils/d1'
import { hashIp } from '../../../utils/comments-guard'

interface ReportPayload {
  reason: string
  details?: string
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

  const body = await readBody<ReportPayload>(event)
  const reason = (body?.reason || '부적절한 내용 / 스팸').trim()
  const details = (body?.details || '').trim().slice(0, 500)

  const clientIp = getRequestHeader(event, 'cf-connecting-ip')
    || getRequestHeader(event, 'x-forwarded-for')
    || '127.0.0.1'
  const ipHash = await hashIp(clientIp)

  // Insert report
  await d1Run(
    database,
    `INSERT INTO comment_reports (comment_id, reason, details, ip_hash)
     VALUES (?, ?, ?, ?)`,
    commentId,
    reason,
    details,
    ipHash,
  )

  // Count reports for this comment. If >= 3, automatically mark comment as flagged
  const reportCount = await d1First<{ count: number }>(
    database,
    `SELECT COUNT(*) as count FROM comment_reports WHERE comment_id = ? AND status = 'pending'`,
    commentId,
  )

  if ((reportCount?.count || 0) >= 3) {
    await d1Run(
      database,
      `UPDATE comments SET status = 'flagged' WHERE id = ? AND status = 'approved'`,
      commentId,
    )
  }

  return {
    success: true,
    message: '신고가 접수되었습니다. 클린 모더레이터 팀에서 검토합니다.',
  }
})

