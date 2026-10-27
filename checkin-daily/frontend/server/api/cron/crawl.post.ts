// checkin-daily/frontend/server/api/cron/crawl.post.ts
import { createError, defineEventHandler, getRequestHeader } from 'h3'
import { getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'
import { executeCronTasks } from '../../utils/cron-runner'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'D1 database binding unavailable' })
  }

  // Strict Fail-Closed Authorization:
  // Must provide valid x-cron-token matching CRON_TOKEN (at least 16 chars) OR valid admin session
  const token = getRequestHeader(event, 'x-cron-token')
  const expectedToken = process.env.CRON_TOKEN

  let isAuthorized = false

  if (token && expectedToken && expectedToken.length >= 16 && token === expectedToken) {
    isAuthorized = true
  }

  if (!isAuthorized) {
    const session = await authenticateAdmin(event, database)
    if (session.identity) {
      isAuthorized = true
    }
  }

  if (!isAuthorized) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized cron request' })
  }

  return executeCronTasks(database)
})
