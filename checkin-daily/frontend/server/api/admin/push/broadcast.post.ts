// checkin-daily/frontend/server/api/admin/push/broadcast.post.ts
import { createError, defineEventHandler, readBody } from 'h3'
import { getD1Database, getWorkerEnvironment } from '../../../utils/d1'
import { authenticateAdmin } from '../../../utils/d1-auth'
import { broadcastPushNotification } from '../../../utils/web-push'

interface BroadcastPayload {
  title: string
  body: string
  url: string
}

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const session = await authenticateAdmin(event, database)
  if (!session.identity) {
    throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  }

  const payload = await readBody<BroadcastPayload>(event)

  if (!payload?.title || !payload.body || !payload.url) {
    throw createError({ statusCode: 400, statusMessage: '제목, 내용, 연결 URL을 모두 입력해 주세요.' })
  }

  const env = getWorkerEnvironment(event) as Record<string, unknown> | undefined

  const result = await broadcastPushNotification(database, env, {
    title: payload.title.trim(),
    body: payload.body.trim(),
    url: payload.url.trim(),
  })

  return {
    success: true,
    message: `푸시 알림 브로드캐스트 완료: 전송 성공 ${result.sentCount}건, 실패 ${result.failedCount}건 (총 구독자 ${result.totalSubscribers}명)`,
    result,
  }
})
