// Manual / webhook trigger for the newsroom pipeline.
// Auth: x-cron-token header matching CRON_TOKEN (>= 16 chars), or a staff admin session.
// Body (optional JSON): { sourceId?: string, skipIngestion?: boolean, maxGenerations?: number }
import { createError, defineEventHandler, getRequestHeader, readBody } from 'h3'
import { getD1Database, getWorkerEnvironment } from '../../utils/d1'
import { authenticateAdmin, constantTimeEqual, isSameOriginRequest } from '../../utils/d1-auth'
import { executeCronTasks } from '../../utils/cron-runner'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'D1 database binding unavailable' })

  const token = getRequestHeader(event, 'x-cron-token') || ''
  const env = getWorkerEnvironment(event) as Record<string, unknown> | undefined
  const expectedToken = String(env?.CRON_TOKEN || env?.CRON_SECRET || process.env.CRON_TOKEN || process.env.CRON_SECRET || '')

  let isAuthorized = Boolean(token && expectedToken.length >= 16 && constantTimeEqual(token, expectedToken))
  if (!isAuthorized) {
    const session = await authenticateAdmin(event, database)
    isAuthorized = Boolean(session.identity) && isSameOriginRequest(event)
  }
  if (!isAuthorized) throw createError({ statusCode: 401, statusMessage: 'Unauthorized cron request' })

  let body: { sourceId?: unknown; skipIngestion?: unknown; maxGenerations?: unknown } = {}
  try {
    body = (await readBody(event)) || {}
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Request body must be JSON' })
  }
  const maxGenerations = Number(body.maxGenerations)

  try {
    return await executeCronTasks(database, {
      env,
      sourceId: typeof body.sourceId === 'string' && body.sourceId ? body.sourceId.slice(0, 80) : undefined,
      skipIngestion: body.skipIngestion === true,
      maxGenerations: Number.isInteger(maxGenerations) && maxGenerations >= 0 ? maxGenerations : undefined,
    })
  } catch (error) {
    console.error('[CronCrawl] pipeline failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Pipeline execution failed' })
  }
})
