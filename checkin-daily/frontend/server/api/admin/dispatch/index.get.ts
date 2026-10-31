// checkin-daily/frontend/server/api/admin/dispatch/index.get.ts
import { createError, defineEventHandler } from 'h3'
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

  // 1. Newsletter metrics & logs
  const subscriberCountRes = await d1First<{ total: number }>(
    database,
    'SELECT COUNT(*) as total FROM newsletter_subscriptions WHERE is_active = 1',
  )
  const dispatchLogs = await d1All<any>(
    database,
    'SELECT * FROM newsletter_dispatch_logs ORDER BY id DESC LIMIT 20',
  )

  // 2. Web push metrics & logs
  const pushSubsCountRes = await d1First<{ total: number }>(
    database,
    'SELECT COUNT(*) as total FROM push_subscriptions WHERE is_active = 1',
  )
  const pushLogs = await d1All<any>(
    database,
    'SELECT * FROM push_notification_logs ORDER BY id DESC LIMIT 20',
  )

  return {
    success: true,
    newsletter: {
      activeSubscribers: subscriberCountRes?.total || 0,
      logs: dispatchLogs,
    },
    webPush: {
      activeSubscribers: pushSubsCountRes?.total || 0,
      logs: pushLogs,
    },
  }
})
