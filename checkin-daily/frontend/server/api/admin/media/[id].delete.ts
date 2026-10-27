import { createError, defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { getD1Database, d1First, d1Run } from '../../../utils/d1'
import { authenticateAdmin, isSameOriginRequest } from '../../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden request origin' })
  }

  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database binding not available' })
  }

  const session = await authenticateAdmin(event, database)
  if (!session.identity) {
    throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Asset ID required' })
  }

  const existing = await d1First<{ id: string }>(
    database,
    'SELECT id FROM media_assets WHERE id = ?',
    id
  )
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Media asset not found' })
  }

  await d1Run(database, 'DELETE FROM media_assets WHERE id = ?', id)
  setResponseStatus(event, 204)
  return null
})
