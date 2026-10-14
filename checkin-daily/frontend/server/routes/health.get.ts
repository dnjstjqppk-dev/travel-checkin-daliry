import { createError } from 'h3'
import { d1First, getD1Database } from '../utils/d1'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Cloudflare D1 binding is not configured',
    })
  }

  await d1First<{ ok: number }>(database, 'SELECT 1 AS ok')
  return { status: 'ok' }
})
