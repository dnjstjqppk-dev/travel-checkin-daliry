// Batch AI generation: one source URL per line (max 10). Each runs through the
// shared pipeline and lands in the review queue; failures are reported per line.
import { createError, defineEventHandler, readBody } from 'h3'
import { d1Run, getD1Database } from '../../utils/d1'
import { authenticateAdmin, isSameOriginRequest } from '../../utils/d1-auth'
import { canAccessStaff } from '../../utils/staff-permissions'
import { describePipelineResult, generateFromManualSource } from '../../utils/manual-generation'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) throw createError({ statusCode: 403, statusMessage: 'Forbidden request origin' })
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  if (!canAccessStaff(session.identity.role, '/api/admin/generate-batch', 'POST')) {
    throw createError({ statusCode: 403, statusMessage: '권한이 부족합니다. 에디터 이상만 대량 생성을 실행할 수 있습니다.' })
  }

  const body = await readBody<{ urls?: string[] | string; category?: string; licenseInfo?: string }>(event).catch(() => null)
  const raw = Array.isArray(body?.urls) ? body.urls : typeof body?.urls === 'string' ? body.urls.split('\n') : []
  const urls = [...new Set(raw.map(value => String(value).trim()).filter(value => /^https:\/\//i.test(value)))].slice(0, 10)
  if (!urls.length) throw createError({ statusCode: 400, statusMessage: '한 줄에 하나씩 HTTPS 원문 URL을 입력해 주세요. (최대 10개)' })

  const results = []
  for (const url of urls) {
    try {
      const result = await generateFromManualSource(event, database,
        { sourceUrl: url, category: body?.category, licenseInfo: body?.licenseInfo }, session.identity.username)
      results.push({ url, success: result.status === 'drafted', articleId: result.articleId, title: result.title, status: result.status, message: describePipelineResult(result) })
    } catch (error) {
      const message = (error as { statusMessage?: string }).statusMessage || (error instanceof Error ? error.message : String(error))
      results.push({ url, success: false, status: 'failed', message })
    }
  }
  const successCount = results.filter(item => item.success).length

  await d1Run(database, 'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'admin', session.identity.username, 'batch_generate_articles', 'articles:batch',
    JSON.stringify({ requested: urls.length, successCount, articleIds: results.map(item => item.articleId).filter(Boolean) }))

  return {
    success: successCount > 0,
    totalRequested: urls.length,
    successCount,
    errorCount: urls.length - successCount,
    results,
    message: `${urls.length}건 중 ${successCount}건 초안 저장, ${urls.length - successCount}건 차단/실패`,
  }
})
