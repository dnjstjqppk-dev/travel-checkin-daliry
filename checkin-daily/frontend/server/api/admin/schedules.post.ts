import { createError, defineEventHandler, readBody } from 'h3'
import { d1Run, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await readBody(event)
  const { action, jobId } = body

  if (action === 'cancel' && jobId) {
    await d1Run(database, "UPDATE publish_jobs SET status = 'cancelled' WHERE id = ?", jobId)
    return { success: true, message: 'Job cancelled' }
  }

  if (action === 'publish_now' && jobId) {
    const now = new Date().toISOString()
    await d1Run(
      database,
      `UPDATE articles SET status = 'published', published_at = COALESCE(published_at, ?), review_status = 'approved'
       WHERE id = (SELECT article_id FROM publish_jobs WHERE id = ?)`,
      now,
      jobId,
    )
    await d1Run(database, "UPDATE publish_jobs SET status = 'published', published_at = ? WHERE id = ?", now, jobId)
    return { success: true, message: 'Article published' }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid action or jobId' })
})

