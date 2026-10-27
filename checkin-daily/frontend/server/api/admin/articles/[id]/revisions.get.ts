import { createError, defineEventHandler, getRouterParam } from 'h3'
import { d1All, getD1Database } from '../../../../utils/d1'
import { authenticateAdmin } from '../../../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Valid article ID required' })
  }

  const revisions = await d1All(
    database,
    `SELECT id, article_id, revision_num, title, summary, content, editor_note, created_at
     FROM article_revisions
     WHERE article_id = ?
     ORDER BY revision_num DESC, id DESC
     LIMIT 50`,
    id,
  )

  return { revisions }
})

