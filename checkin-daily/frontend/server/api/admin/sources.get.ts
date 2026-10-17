import { createError, defineEventHandler } from 'h3'
import { d1All, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const sources = await d1All(
    database,
    `SELECT s.*,
       (SELECT COUNT(*) FROM feed_ingestion_items WHERE source_id = s.id) AS total_items,
       (SELECT COUNT(*) FROM ingestion_runs WHERE source_id = s.id AND status = 'success') AS success_runs,
       (SELECT COUNT(*) FROM ingestion_runs WHERE source_id = s.id AND status = 'failed') AS failed_runs
     FROM news_sources s
     ORDER BY s.id ASC`,
  )

  return { sources }
})

