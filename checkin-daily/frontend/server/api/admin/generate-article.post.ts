// Editor-triggered AI article generation from a source URL and/or source text.
// The result is always saved as a review draft; publication goes through /admin/review.
import { createError, defineEventHandler, readBody } from 'h3'
import { getD1Database } from '../../utils/d1'
import { authenticateAdmin, isSameOriginRequest } from '../../utils/d1-auth'
import { canAccessStaff } from '../../utils/staff-permissions'
import { describePipelineResult, generateFromManualSource, type ManualSourceInput } from '../../utils/manual-generation'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) throw createError({ statusCode: 403, statusMessage: 'Forbidden request origin' })
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  if (!canAccessStaff(session.identity.role, '/api/admin/generate-batch', 'POST')) {
    throw createError({ statusCode: 403, statusMessage: '기사 생성 권한이 없습니다.' })
  }

  const body = await readBody<ManualSourceInput & { keyword?: string }>(event).catch(() => null)
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'JSON body required' })

  const result = await generateFromManualSource(event, database, { ...body, title: body.title || body.keyword }, session.identity.username)
  const ok = result.status === 'drafted' || result.status === 'published'
  if (!ok) {
    throw createError({ statusCode: result.status === 'failed' ? 502 : 422, statusMessage: describePipelineResult(result), data: result })
  }
  return { success: true, ...result, editUrl: `/admin/articles/${result.articleId}`, message: describePipelineResult(result) }
})
