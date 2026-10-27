import { createError, defineEventHandler, readBody } from 'h3'
import { d1Run, getD1Database } from '../../../../utils/d1'
import { authenticateAdmin, isSameOriginRequest } from '../../../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden request origin' })
  }

  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = Number(event.context.params?.id)
  if (!id || !Number.isSafeInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const body = await readBody(event)
  const reason = (body?.reason || 'Editorial Retraction').trim()
  const now = new Date().toISOString()

  await d1Run(
    database,
    `UPDATE articles SET
       status = 'draft',
       review_status = 'retracted',
       retracted_at = ?,
       retraction_reason = ?
     WHERE id = ?`,
    now,
    reason,
    id,
  )

  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'editor',
    session.identity.username,
    'retract_article',
    `article:${id}`,
    JSON.stringify({ reason, retracted_at: now }),
  )

  return { success: true, id, status: 'retracted', reason, retracted_at: now }
})
