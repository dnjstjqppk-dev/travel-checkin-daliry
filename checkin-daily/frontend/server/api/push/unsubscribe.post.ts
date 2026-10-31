// checkin-daily/frontend/server/api/push/unsubscribe.post.ts
import { createError, defineEventHandler, readBody } from 'h3'
import { getD1Database, d1Run } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const body = await readBody<{ endpoint?: string }>(event)
  const endpoint = body?.endpoint?.trim()

  if (!endpoint) {
    throw createError({ statusCode: 400, statusMessage: 'Endpoint is required' })
  }

  await d1Run(
    database,
    `UPDATE push_subscriptions SET is_active = 0, updated_at = datetime('now') WHERE endpoint = ?`,
    endpoint,
  )

  return {
    success: true,
    message: '웹 푸시 알림 구독이 해제되었습니다.',
  }
})

