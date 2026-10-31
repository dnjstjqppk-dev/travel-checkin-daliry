import { createError, defineEventHandler, readBody } from 'h3'
import { getD1Database, d1First } from '../../utils/d1'
import { authenticateAdmin, hashPassword, isSameOriginRequest } from '../../utils/d1-auth'
import { isStaffRole } from '../../utils/staff-permissions'
export default defineEventHandler(async event => {
  if (!isSameOriginRequest(event)) throw createError({ statusCode: 403, statusMessage: 'Forbidden origin' })
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  const body = await readBody(event)
  if (!body || typeof body.username !== 'string' || !/^[a-zA-Z0-9_.@-]{3,100}$/.test(body.username)
    || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 1024
    || typeof body.role !== 'string' || !isStaffRole(body.role)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid username, role and password of 12 or more characters required' })
  }
  const username = body.username.toLowerCase()
  if (await d1First(database, 'SELECT id FROM admin_accounts WHERE username = ?', username)) throw createError({ statusCode: 409, statusMessage: 'Username already exists' })
  await database.batch([
    database.prepare('INSERT INTO admin_accounts (username, password_hash, role) VALUES (?, ?, ?)')
      .bind(username, await hashPassword(body.password), body.role),
    database.prepare("INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES ('admin', ?, 'create_staff', ?, ?)")
      .bind(session.identity.username, `staff:${username}`, JSON.stringify({ role: body.role })),
  ])
  return { success: true, username }
})
