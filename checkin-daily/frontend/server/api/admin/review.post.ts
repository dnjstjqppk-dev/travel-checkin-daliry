import { transitionArticle } from '../../utils/editorial-workflow'
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
  if (!['approve', 'reject'].includes(decision)) {
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

  await transitionArticle(database, {
    articleId: Number(articleId), decision, actor: session.identity.username,
    scheduledAt, editorNote,
  })

  return { success: true, articleId, decision }
})
