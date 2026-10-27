import { createError, defineEventHandler, getRequestHeader, readBody } from 'h3'
import { d1First, d1Run, getD1Database } from '../../utils/d1'

async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  const ip = getRequestHeader(event, 'cf-connecting-ip')
    || getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || '127.0.0.1'
  const ipHash = await sha256(`newsletter_${ip}`)

  const body = await readBody(event)
  const email = String(body?.email || '').trim().toLowerCase()
  if (!email || !email.includes('@') || !email.includes('.')) {
    throw createError({ statusCode: 400, statusMessage: '올바른 이메일 주소를 입력해 주세요.' })
  }

  try {
    await d1Run(
      database,
      'INSERT OR IGNORE INTO newsletter_subscribers (email, ip_hash) VALUES (?, ?)',
      email,
      ipHash,
    )
    await d1Run(
      database,
      'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
      'subscriber',
      email,
      'newsletter_subscribed',
      `subscriber:${email}`,
      JSON.stringify({ email }),
    )
  } catch {}

  return {
    success: true,
    message: '체크인데일리 글로벌 여행 뉴스레터 구독이 완료되었습니다. 매주 월요일 아침 최신 인텔리전스를 전해드립니다.',
  }
})

