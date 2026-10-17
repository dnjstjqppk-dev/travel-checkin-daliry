import { createError, defineEventHandler, readBody } from 'h3'
import { d1Run, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await readBody(event)
  const { key, value } = body
  if (!key) throw createError({ statusCode: 400, statusMessage: 'key is required' })

  await d1Run(
    database,
    `INSERT INTO automation_policies (key, value, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    key,
    String(value),
  )

  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'admin',
    session.identity.username,
    'update_automation_policy',
    `policy:${key}`,
    JSON.stringify({ key, value }),
  )

  return { success: true, key, value }
})

