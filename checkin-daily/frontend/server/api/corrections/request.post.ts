import { createError, defineEventHandler, readBody, getRequestHeader } from 'h3'
import { d1Run, d1First, getD1Database } from '../../utils/d1'

async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  // 1. IP-based rate limiting (Max 3 submissions per 10 minutes)
  const ip = getRequestHeader(event, 'cf-connecting-ip')
    || getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || '127.0.0.1'
  const ipHash = await sha256(`correction_${ip}`)
  const nowSec = Math.floor(Date.now() / 1000)

  try {
    const existingLimit = await d1First<{ count: number; expires_at: number }>(
      database,
      'SELECT count, expires_at FROM rate_limits WHERE key = ?',
      ipHash,
    )

    if (existingLimit && existingLimit.expires_at > nowSec && existingLimit.count >= 3) {
      throw createError({
        statusCode: 429,
        statusMessage: '너무 많은 정정 요청이 접수되었습니다. 잠시 후(최대 10분) 다시 시도해 주세요.',
      })
    }

    if (!existingLimit || existingLimit.expires_at <= nowSec) {
      await d1Run(
        database,
        'INSERT OR REPLACE INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)',
        ipHash,
        nowSec + 600,
      )
    } else {
      await d1Run(
        database,
        'UPDATE rate_limits SET count = count + 1 WHERE key = ?',
        ipHash,
      )
    }
  } catch (err: any) {
    if (err?.statusCode === 429) throw err
    // If rate_limits table not available in tests, continue
  }

  // 2. Read and validate body
  const body = await readBody(event)
  const { articleId, originalStatement, correctedStatement, evidenceUrl, reason, requesterEmail } = body || {}

  if (!articleId || !originalStatement || !correctedStatement) {
    throw createError({
      statusCode: 400,
      statusMessage: 'articleId, originalStatement, and correctedStatement are required',
    })
  }

  // 3. Insert as 'pending' - Never deface or auto-publish unapproved reader corrections!
  await d1Run(
    database,
    `INSERT INTO article_corrections (article_id, original_statement, corrected_statement, reason, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    Number(articleId),
    String(originalStatement).trim(),
    String(correctedStatement).trim(),
    `${reason || '독자 정정 요청'}${evidenceUrl ? ` (증빙: ${evidenceUrl})` : ''}${requesterEmail ? ` [신청자: ${requesterEmail}]` : ''}`,
  )

  // 4. Record audit log
  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'system',
    requesterEmail || 'anonymous_reader',
    'reader_correction_request_submitted',
    `article:${articleId}`,
    JSON.stringify({ articleId, originalStatement, correctedStatement, requesterEmail }),
  )

  return {
    success: true,
    message: '정정 요청이 안전하게 접수되었습니다. 편집국 검토 및 승인 후 반영 여부가 결정됩니다.',
  }
})
