// checkin-daily/frontend/server/api/comments/[id].delete.ts
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { getD1Database, d1First, d1Run } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'
import { hashCommentPassword } from '../../utils/comments-guard'

interface DeletePayload {
  password?: string
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

  const existing = await d1First<{ id: number; password_hash: string | null; status: string }>(
    database,
    `SELECT id, password_hash, status FROM comments WHERE id = ?`,
    commentId,
  )
  if (!existing || existing.status === 'deleted') {
    throw createError({ statusCode: 404, statusMessage: '댓글을 찾을 수 없습니다.' })
  }

  // 1. Check if caller is Admin
  let isAuthorized = false
  const session = await authenticateAdmin(event, database).catch(() => ({ identity: null }))
  if (session?.identity) {
    isAuthorized = true
  }

  // 2. Otherwise check password match
  if (!isAuthorized) {
    const body = await readBody<DeletePayload>(event).catch(() => ({} as DeletePayload))
    const inputPassword = (body?.password || '').trim()
    if (!inputPassword || !existing.password_hash) {
      throw createError({ statusCode: 401, statusMessage: '삭제를 위한 비밀번호를 입력해 주세요.' })
    }

    const inputHash = await hashCommentPassword(inputPassword)
    if (inputHash !== existing.password_hash) {
      throw createError({ statusCode: 403, statusMessage: '비밀번호가 일치하지 않습니다.' })
    }
    isAuthorized = true
  }

  // 3. Mark as deleted (preserve thread structure for replies)
  const now = new Date().toISOString()
  await d1Run(
    database,
    `UPDATE comments SET status = 'deleted', content = '', updated_at = ? WHERE id = ?`,
    now,
    commentId,
  )

  return {
    success: true,
    message: '댓글이 삭제되었습니다.',
  }
})

