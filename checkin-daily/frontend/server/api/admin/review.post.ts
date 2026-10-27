import { createError, defineEventHandler, readBody } from 'h3'
import { d1Run, getD1Database } from '../../utils/d1'
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
  const { articleId, decision, editorNote, scheduledAt, correctionId, submissionId } = body
  if (!decision) {
    throw createError({ statusCode: 400, statusMessage: 'decision is required' })
  }

  const now = new Date().toISOString()

  // Handle reader correction approvals/rejections
  if (correctionId) {
    if (decision === 'approve') {
      await d1Run(database, "UPDATE article_corrections SET status = 'approved' WHERE id = ?", correctionId)
    } else if (decision === 'reject') {
      await d1Run(database, "UPDATE article_corrections SET status = 'rejected' WHERE id = ?", correctionId)
    }
    await d1Run(
      database,
      'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
      'editor',
      session.identity.username,
      `correction_${decision}`,
      `correction:${correctionId}`,
      JSON.stringify({ decision, editorNote, articleId }),
    )
    return { success: true, correctionId, decision }
  }

  // Handle partner submission approvals/rejections
  if (submissionId) {
    const subStatus = decision === 'approve' ? 'approved' : 'rejected'
    await d1Run(
      database,
      'UPDATE contributor_submissions SET status = ?, reviewed_by = ?, reviewed_at = ?, editorial_feedback = COALESCE(?, editorial_feedback), updated_at = ? WHERE id = ?',
      subStatus,
      session.identity.username,
      now,
      editorNote || null,
      now,
      submissionId,
    )
    await d1Run(
      database,
      'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
      'editor',
      session.identity.username,
      `submission_${decision}`,
      `submission:${submissionId}`,
      JSON.stringify({ decision, editorNote, submissionId }),
    )
    return { success: true, submissionId, decision }
  }

  if (!articleId) {
    throw createError({ statusCode: 400, statusMessage: 'articleId is required' })
  }

  if (decision === 'approve') {
    if (scheduledAt) {
      // Schedule publication
      await d1Run(
        database,
        "UPDATE articles SET review_status = 'scheduled', status = 'draft', scheduled_at = ? WHERE id = ?",
        scheduledAt,
        articleId,
      )
      await d1Run(
        database,
        `INSERT INTO publish_jobs (article_id, scheduled_at, status, idempotency_key)
         VALUES (?, ?, 'pending', ?)`,
        articleId,
        scheduledAt,
        `job-${articleId}-${Date.now()}`,
      )
    } else {
      // Instant publish
      await d1Run(
        database,
        `UPDATE articles SET
          review_status = 'approved',
          status = 'published',
          published_at = COALESCE(published_at, ?),
          first_published_at = COALESCE(first_published_at, ?),
          fact_checked_at = ?
         WHERE id = ?`,
        now,
        now,
        now,
        articleId,
      )
    }
  } else if (decision === 'reject') {
    await d1Run(
      database,
      "UPDATE articles SET review_status = 'rejected', status = 'draft' WHERE id = ?",
      articleId,
    )
  }

  // Record audit log
  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'editor',
    session.identity.username,
    `editorial_decision_${decision}`,
    `article:${articleId}`,
    JSON.stringify({ decision, editorNote, scheduledAt }),
  )

  return { success: true, articleId, decision }
})
