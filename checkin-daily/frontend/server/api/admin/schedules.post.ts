import { transitionArticle } from '../../utils/editorial-workflow'
import { createError, defineEventHandler, readBody } from 'h3'
import { d1First, d1Run, getD1Database } from '../../utils/d1'
import { authenticateAdmin, isSameOriginRequest } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden request origin' })
  }

  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await readBody(event)
  const { action, jobId } = body

  if (action === 'cancel' && jobId) {
    await d1Run(database, "UPDATE publish_jobs SET status = 'cancelled' WHERE id = ?", jobId)
    await d1Run(
      database,
      'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
      'admin',
      session.identity.username,
      'cancel_publish_job',
      `publish_job:${jobId}`,
      JSON.stringify({ jobId }),
    )
    return { success: true, message: 'Job cancelled' }
  }

  if (action === 'publish_now' && jobId) {
    const job = await d1First<{ article_id: number }>(database, "SELECT article_id FROM publish_jobs WHERE id = ? AND status = 'pending'", jobId)
    if (!job) throw createError({ statusCode: 409, statusMessage: 'Pending job not found' })
    await transitionArticle(database, {
      articleId: job.article_id, decision: 'approve', actor: session.identity.username, jobId: Number(jobId),
    })
    return { success: true, message: 'Article published' }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid action or jobId' })
})
