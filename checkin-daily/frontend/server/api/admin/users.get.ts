import { createError, defineEventHandler } from 'h3'
import { d1All, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'
export default defineEventHandler(async event => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  if (!(await authenticateAdmin(event, database)).identity) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  return d1All(database, 'SELECT id, username, role, is_active, created_at FROM admin_accounts ORDER BY id')
})
