import { createError } from 'h3'
import { d1First, type D1Database } from './d1'
import { assertArticlePublishable } from './publication-gate'

/** D1 batch is transactional. The token guards all dependent writes after the CAS. */
export async function transitionArticle(database: D1Database, input: {
  articleId: number; decision: 'approve' | 'reject'; actor: string
  scheduledAt?: string; jobId?: number; editorNote?: string
}): Promise<void> {
  if (!Number.isSafeInteger(input.articleId) || input.articleId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }
  const before = await d1First<{ workflow_token: string; updated_at: string; content: string; license_info: string; cover_image: string }>(
    database, 'SELECT workflow_token, updated_at, content, license_info, cover_image FROM articles WHERE id = ?', input.articleId,
  )
  if (!before) throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  if (input.decision === 'approve') await assertArticlePublishable(database, input.articleId)
  const now = new Date().toISOString()
  const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : null
  if (scheduled && (!Number.isFinite(scheduled.getTime()) || scheduled.getTime() <= Date.now())) {
    throw createError({ statusCode: 400, statusMessage: 'A future publication date is required' })
  }
  const token = crypto.randomUUID()
  const publishing = input.decision === 'approve' && !scheduled
  const review = input.decision === 'reject' ? 'rejected' : scheduled ? 'scheduled' : 'approved'
  const statements = [database.prepare(`UPDATE articles SET
    status = ?, review_status = ?, scheduled_at = ?, updated_at = ?, workflow_token = ?,
    published_at = CASE WHEN ? THEN COALESCE(published_at, ?) ELSE published_at END,
    first_published_at = CASE WHEN ? THEN COALESCE(first_published_at, published_at, ?) ELSE first_published_at END
    WHERE id = ? AND updated_at = ? AND content = ? AND license_info = ? AND cover_image = ? AND workflow_token = ?
    ${input.jobId ? "AND review_status = 'scheduled' AND status = 'draft' AND EXISTS (SELECT 1 FROM publish_jobs WHERE id = ? AND article_id = articles.id AND status = 'pending')" : ''}`)
    .bind(publishing ? 'published' : 'draft', review, scheduled?.toISOString() ?? null, now, token,
      publishing ? 1 : 0, now, publishing ? 1 : 0, now, input.articleId, before.updated_at, before.content,
      before.license_info, before.cover_image, before.workflow_token, ...(input.jobId ? [input.jobId] : []))]
  statements.push(database.prepare(`UPDATE publish_jobs SET status = ?, published_at = ?
    WHERE article_id = ? AND status = 'pending'
    AND EXISTS (SELECT 1 FROM articles WHERE id = ? AND workflow_token = ?)
    ${input.jobId ? 'AND id = ?' : ''}`)
    .bind(input.jobId ? 'published' : 'cancelled', input.jobId ? now : null,
      input.articleId, input.articleId, token, ...(input.jobId ? [input.jobId] : [])))
  if (scheduled) statements.push(database.prepare(`INSERT INTO publish_jobs (article_id, scheduled_at, status, idempotency_key)
    SELECT id, ?, 'pending', ? FROM articles WHERE id = ? AND workflow_token = ?`)
    .bind(scheduled.toISOString(), token, input.articleId, token))
  statements.push(database.prepare(`INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json)
    SELECT ?, ?, ?, ?, ? FROM articles WHERE id = ? AND workflow_token = ?`)
    .bind(input.actor === 'cron-scheduler' ? 'system' : 'editor', input.actor,
      `editorial_${review}`, `article:${input.articleId}`,
      JSON.stringify({ scheduledAt: scheduled?.toISOString(), jobId: input.jobId, note: input.editorNote || '' }),
      input.articleId, token))
  const results = await database.batch(statements)
  if (results.some(result => !result.success)) throw createError({ statusCode: 500, statusMessage: 'Publication transaction failed' })
  if (!results[0]?.meta?.changes) throw createError({ statusCode: 409, statusMessage: 'Article changed; reload before publishing' })
}
