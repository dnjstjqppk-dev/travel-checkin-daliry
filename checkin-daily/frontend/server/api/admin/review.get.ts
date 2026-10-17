import { createError, defineEventHandler } from 'h3'
import { d1All, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const items = await d1All(
    database,
    `SELECT a.id, a.title, a.slug, a.category, a.status, a.review_status, a.quality_score,
            a.author, a.source_name, a.source_url, a.created_at, a.ingested_at,
            (SELECT json_group_array(json_object('claim', claim, 'status', verification_status, 'evidence', evidence_url)) FROM article_fact_checks WHERE article_id = a.id) AS fact_checks
     FROM articles a
     WHERE a.review_status IN ('candidate', 'needs_review', 'correction_required')
     ORDER BY a.quality_score ASC, a.id DESC`,
  )

  return { queue: items }
})

