import { createError, defineEventHandler } from 'h3'
import { d1All, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const jobs = await d1All(
    database,
    `SELECT pj.*, a.title AS article_title, a.category, a.author
     FROM publish_jobs pj
     JOIN articles a ON a.id = pj.article_id
     ORDER BY pj.scheduled_at ASC`,
  )

  return { jobs }
})

