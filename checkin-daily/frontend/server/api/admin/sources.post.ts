import { createError, defineEventHandler, readBody } from 'h3'
import { d1Run, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await readBody(event)
  const action = body.action || 'create'

  if (action === 'toggle') {
    const { id, is_active } = body
    await d1Run(
      database,
      'UPDATE news_sources SET is_active = ? WHERE id = ?',
      is_active ? 1 : 0,
      id,
    )
    return { success: true, id, is_active }
  }

  if (action === 'create') {
    const { id, name, source_type, endpoint_url, fetch_interval_minutes, license_info } = body
    if (!id || !name || !endpoint_url) {
      throw createError({ statusCode: 400, statusMessage: 'id, name, and endpoint_url are required' })
    }

    // SSRF Check
    const parsed = new URL(endpoint_url)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.startsWith('192.168.')) {
      throw createError({ statusCode: 400, statusMessage: 'Forbidden host address' })
    }

    await d1Run(
      database,
      `INSERT INTO news_sources (id, name, source_type, endpoint_url, fetch_interval_minutes, license_info, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         source_type = excluded.source_type,
         endpoint_url = excluded.endpoint_url,
         fetch_interval_minutes = excluded.fetch_interval_minutes,
         license_info = excluded.license_info`,
      id,
      name,
      source_type || 'rss',
      endpoint_url,
      fetch_interval_minutes || 60,
      license_info || 'Editorial Fair Citation',
    )

    // Audit log
    await d1Run(
      database,
      'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
      'admin',
      session.identity.username,
      'create_or_update_source',
      `news_sources:${id}`,
      JSON.stringify(body),
    )

    return { success: true, id }
  }

  throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
})

