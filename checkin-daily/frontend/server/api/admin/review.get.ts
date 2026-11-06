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

  let submissions: any[]
  let corrections: any[]

  try {
    submissions = await d1All(
      database,
      `SELECT id, org_id, submitter_name, submitter_email, title, summary, content, category, source_url, status, created_at
       FROM contributor_submissions
       WHERE status = 'submitted'
       ORDER BY id DESC LIMIT 50`,
    )
  } catch (err) {
    console.error('[ReviewQueue] Failed to load contributor submissions:', err)
    throw createError({ statusCode: 500, statusMessage: '검수 대기 제보 목록을 불러오지 못했습니다.' })
  }

  try {
    corrections = await d1All(
      database,
      `SELECT c.id, c.article_id, c.original_statement, c.corrected_statement, c.reason, c.status, c.corrected_at,
              a.title as article_title, a.category as article_category
       FROM article_corrections c
       LEFT JOIN articles a ON a.id = c.article_id
       WHERE c.status = 'pending'
       ORDER BY c.id DESC LIMIT 50`,
    )
  } catch (err) {
    console.error('[ReviewQueue] Failed to load pending corrections:', err)
    throw createError({ statusCode: 500, statusMessage: '정정 요청 목록을 불러오지 못했습니다.' })
  }

  return { queue: items, submissions, corrections }
})
