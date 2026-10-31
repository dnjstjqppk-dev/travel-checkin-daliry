// checkin-daily/frontend/server/api/push/subscribe.post.ts
import { createError, defineEventHandler, readBody } from 'h3'
import { getD1Database, d1Run } from '../../utils/d1'

interface SubscribePayload {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  lang?: string
  topics?: string
}

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const body = await readBody<SubscribePayload>(event)

  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid push subscription payload' })
  }

  const endpoint = body.endpoint.trim()
  const p256dh = body.keys.p256dh.trim()
  const auth = body.keys.auth.trim()
  const lang = (body.lang || 'ko').slice(0, 10)
  const topics = (body.topics || 'all').slice(0, 50)

  // Insert or update subscription
  await d1Run(
    database,
    `INSERT INTO push_subscriptions (endpoint, p256dh_key, auth_key, lang, topics, is_active, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(endpoint) DO UPDATE SET
       p256dh_key = excluded.p256dh_key,
       auth_key = excluded.auth_key,
       lang = excluded.lang,
       topics = excluded.topics,
       is_active = 1,
       updated_at = datetime('now')`,
    endpoint,
    p256dh,
    auth,
    lang,
    topics,
  )

  return {
    success: true,
    message: '웹 푸시 알림 구독이 등록되었습니다.',
  }
})

