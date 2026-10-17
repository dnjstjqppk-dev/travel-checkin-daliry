import { createError, defineEventHandler, getRequestHeader, readBody } from 'h3'
import { d1Run, getD1Database } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  const body = await readBody(event)
  const { eventType, articleId, targetPlatform, referrer } = body
  if (!eventType) throw createError({ statusCode: 400, statusMessage: 'eventType is required' })

  const userAgent = (getRequestHeader(event, 'user-agent') || '').toLowerCase()
  const isBot = /bot|crawl|spider|slurp|headless|lighthouse|mediapartners|google|bing|yandex|baidu/i.test(userAgent)
  const botClassification = isBot ? 'crawler' : 'human'

  await d1Run(
    database,
    `INSERT INTO analytics_events (article_id, event_type, bot_classification, referrer_category, target_platform, meta_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    articleId ? Number(articleId) : null,
    eventType,
    botClassification,
    referrer || 'direct',
    targetPlatform || '',
    JSON.stringify({ userAgent: userAgent.slice(0, 150) }),
  )

  return { success: true }
})

