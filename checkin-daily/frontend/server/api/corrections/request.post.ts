import { createError, defineEventHandler, readBody } from 'h3'
import { d1Run, getD1Database } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  const body = await readBody(event)
  const { articleId, originalStatement, correctedStatement, evidenceUrl, reason, requesterEmail } = body

  if (!articleId || !originalStatement || !correctedStatement) {
    throw createError({ statusCode: 400, statusMessage: 'articleId, originalStatement, and correctedStatement are required' })
  }

  await d1Run(
    database,
    `INSERT INTO article_corrections (article_id, original_statement, corrected_statement, reason)
     VALUES (?, ?, ?, ?)`,
    Number(articleId),
    String(originalStatement).trim(),
    String(correctedStatement).trim(),
    `${reason || '독자 정정 요청'}${evidenceUrl ? ` (증빙: ${evidenceUrl})` : ''}${requesterEmail ? ` [신청자: ${requesterEmail}]` : ''}`,
  )

  // Mark article review_status to correction_required if it's currently published
  await d1Run(
    database,
    "UPDATE articles SET review_status = 'correction_required' WHERE id = ?",
    Number(articleId),
  )

  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'system',
    requesterEmail || 'anonymous_reader',
    'reader_correction_request',
    `article:${articleId}`,
    JSON.stringify(body),
  )

  return { success: true, message: '정정 요청이 접수되어 편집국 검토 대기열에 등록되었습니다.' }
})

