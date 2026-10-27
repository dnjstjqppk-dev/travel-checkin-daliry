import { createError, defineEventHandler, readBody } from 'h3'
import { d1Run, getD1Database } from '../../utils/d1'
import { authenticateAdmin, isSameOriginRequest } from '../../utils/d1-auth'
import { assertSafeExternalUrl } from '../../utils/ssrf-guard'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden request origin' })
  }

  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await readBody(event)
  const action = body?.action || 'create'

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

    // SSRF Check via assertSafeExternalUrl
    assertSafeExternalUrl(endpoint_url)

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
      `source:${id}`,
      JSON.stringify({ name, endpoint_url }),
    )

    return { success: true, id, name }
  }

  throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
})
