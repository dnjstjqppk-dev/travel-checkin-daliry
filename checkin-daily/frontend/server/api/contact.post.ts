import { createError, defineEventHandler, readBody, getRequestHeader } from 'h3'
import { d1Run, d1First, getD1Database } from '../utils/d1'

async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  // 1. IP-based rate limiting (Max 5 inquiries per 10 minutes)
  const ip = getRequestHeader(event, 'cf-connecting-ip')
    || getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || '127.0.0.1'
  const ipHash = await sha256(`contact_${ip}`)
  const nowSec = Math.floor(Date.now() / 1000)

  try {
    const existingLimit = await d1First<{ count: number; expires_at: number }>(
      database,
      'SELECT count, expires_at FROM rate_limits WHERE key = ?',
      ipHash,
    )

    if (existingLimit && existingLimit.expires_at > nowSec && existingLimit.count >= 5) {
      throw createError({
        statusCode: 429,
        statusMessage: '문의 접수 횟수가 초과되었습니다. 잠시 후(최대 10분) 다시 시도해 주세요.',
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
  }

  // 2. Validate input
  const body = await readBody(event)
  const { name, organization, email, category, title, message } = body || {}

  if (!name || !email || !title || !message) {
    throw createError({
      statusCode: 400,
      statusMessage: '성명, 이메일, 제목 및 문의 내용은 필수 입력 항목입니다.',
    })
  }

  const cleanEmail = String(email).trim().toLowerCase()
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    throw createError({
      statusCode: 400,
      statusMessage: '올바른 이메일 주소를 입력해 주세요.',
    })
  }

  const cleanName = String(name).trim()
  const cleanOrg = String(organization || '').trim()
  const cleanCategory = String(category || 'press').trim()
  const cleanTitle = String(title).trim()
  const cleanMessage = String(message).trim()

  // 3. Insert into contact_inquiries
  await d1Run(
    database,
    `INSERT INTO contact_inquiries (name, organization, email, category, title, message, ip_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    cleanName,
    cleanOrg,
    cleanEmail,
    cleanCategory,
    cleanTitle,
    cleanMessage,
    ipHash,
  )

  // 4. Record audit log
  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'reader',
    cleanEmail,
    'contact_inquiry_submitted',
    `inquiry:${cleanCategory}`,
    JSON.stringify({ name: cleanName, organization: cleanOrg, email: cleanEmail, category: cleanCategory, title: cleanTitle }),
  )

  return {
    success: true,
    message: '문의가 성공적으로 접수되었습니다. 담당 부서에서 확인 후 신속히 회신드리겠습니다.',
  }
})

