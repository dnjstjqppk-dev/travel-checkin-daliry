import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { d1First, getD1Database } from '../../../utils/d1'
import { authenticateAdmin, isSameOriginRequest } from '../../../utils/d1-auth'
import { isStaffRole } from '../../../utils/staff-permissions'
export default defineEventHandler(async event => {
  if (!isSameOriginRequest(event)) throw createError({ statusCode: 403, statusMessage: 'Forbidden origin' })
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid staff ID' })
  if (id === session.identity.id) throw createError({ statusCode: 409, statusMessage: 'Cannot change your own role or deactivate your own account' })
  const body = await readBody(event)
  if (!body || typeof body.role !== 'string' || !isStaffRole(body.role) || typeof body.active !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Valid role and active flag required' })
  }
  if (!await d1First(database, 'SELECT id FROM admin_accounts WHERE id = ?', id)) throw createError({ statusCode: 404, statusMessage: 'Staff account not found' })
  await database.batch([
    database.prepare("UPDATE admin_accounts SET role = ?, is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
      .bind(body.role, body.active ? 1 : 0, id),
    database.prepare('DELETE FROM admin_sessions WHERE account_id = ?').bind(id),
    database.prepare("INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES ('admin', ?, 'update_staff', ?, ?)")
      .bind(session.identity.username, `staff:${id}`, JSON.stringify({ role: body.role, active: body.active })),
  ])
  return { success: true }
})
