// checkin-daily/frontend/server/api/admin/dispatch/newsletter-test.post.ts
import { createError, defineEventHandler, readBody } from 'h3'
import { getD1Database, getWorkerEnvironment, d1All } from '../../../utils/d1'
import { authenticateAdmin } from '../../../utils/d1-auth'
import { siteConfig } from '../../../../config/site.config'
import { buildNewsletterHtml } from '../../cron/newsletter.post'
import { dispatchNewsletterBatch } from '../../../utils/email-dispatcher'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const session = await authenticateAdmin(event, database)
  if (!session.identity) {
    throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  }

  const body = await readBody<{ targetEmail?: string }>(event)
  const targetEmail = body?.targetEmail?.trim()

  if (!targetEmail || !targetEmail.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: '유효한 테스트 수신 이메일 주소를 입력해 주세요.' })
  }

  const env = getWorkerEnvironment(event) as Record<string, unknown> | undefined

  const now = new Date()
  const dateStr = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(now)

  // Fetch recent 3 articles
  const articles = await d1All<any>(
    database,
    `SELECT id, title, summary, category, cover_image, published_at, view_count
     FROM articles
     WHERE status = 'published'
     ORDER BY id DESC
     LIMIT 3`,
  )

  const siteUrl = (siteConfig.domain || 'https://travel-checkin-daily.dnjstjqppk.workers.dev').replace(/\/+$/, '')
  const emailHtml = buildNewsletterHtml(articles, dateStr, siteUrl)
  const emailSubject = `[TEST] [Check-in Daily] ${dateStr} 모닝 여행 인텔리전스 브리핑`

  const dispatchResult = await dispatchNewsletterBatch({
    database,
    env,
    subject: emailSubject,
    html: emailHtml,
    recipients: [targetEmail],
  })

  return {
    success: true,
    message: `테스트 뉴스레터 발송 요청 완료 (${dispatchResult.provider}): 성공 ${dispatchResult.successCount}건, 실패 ${dispatchResult.failureCount}건`,
    dispatchResult,
  }
})
