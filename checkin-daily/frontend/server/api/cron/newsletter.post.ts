// checkin-daily/frontend/server/api/cron/newsletter.post.ts
// Automated Daily 08:00 KST Morning Newsletter Briefing Dispatcher

import { createError, defineEventHandler, getRequestHeader } from 'h3'
import { getD1Database, d1All, d1First, d1Run } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'
import { siteConfig } from '../../../config/site.config'

interface ArticleBrief {
  id: number
  title: string
  summary: string
  category: string
  cover_image: string
  published_at: string
  view_count: number
}

interface SubscriberRow {
  email: string
  lang: string
}

export function buildNewsletterHtml(
  articles: ArticleBrief[],
  dateStr: string,
  siteUrl: string,
): string {
  const articleCards = articles.map((a, i) => `
    <div style="margin-bottom: 24px; padding: 18px; background-color: #181927; border: 1px solid #23253a; border-radius: 8px;">
      <div style="font-family: monospace; font-size: 11px; font-weight: bold; color: #00d4aa; margin-bottom: 6px;">
        #0${i + 1} // ${a.category.toUpperCase()}
      </div>
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #ffffff; line-height: 1.4;">
        <a href="${siteUrl}/news/${a.category}/article/${a.id}" style="color: #ffffff; text-decoration: none;">
          ${a.title}
        </a>
      </h3>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #a1a5b8; line-height: 1.5;">
        ${a.summary}
      </p>
      <a href="${siteUrl}/news/${a.category}/article/${a.id}" style="display: inline-block; font-size: 12px; font-weight: bold; color: #00d4aa; text-decoration: none;">
        심층 분석 전문 읽기 →
      </a>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Check-in Daily Morning Briefing</title>
</head>
<body style="margin: 0; padding: 24px 16px; background-color: #0d0e1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e1e3ea;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #13141f; border: 1px solid #23253a; border-radius: 12px; overflow: hidden; padding: 28px;">
    <!-- Header -->
    <div style="border-bottom: 1px solid #23253a; padding-bottom: 18px; margin-bottom: 24px; text-align: left;">
      <div style="font-size: 11px; font-family: monospace; color: #00d4aa; letter-spacing: 1px; font-weight: bold;">
        📡 CHECK-IN DAILY // INTELLIGENCE WIRE
      </div>
      <h1 style="margin: 6px 0 4px 0; font-size: 22px; color: #ffffff; font-weight: 800;">
        오늘의 글로벌 여행 인텔리전스 모닝 브리핑
      </h1>
      <div style="font-size: 12px; color: #7e8299; font-family: monospace;">
        ${dateStr} KST • 데스크 공인 1차 팩트체크 검증 리포트
      </div>
    </div>

    <!-- Articles Feed -->
    <div>
      ${articleCards}
    </div>

    <!-- Partner CTA -->
    <div style="margin-top: 28px; padding: 16px; background-color: rgba(0, 212, 170, 0.08); border: 1px solid rgba(0, 212, 170, 0.3); border-radius: 8px; text-align: center;">
      <div style="font-size: 12px; font-weight: bold; color: #00d4aa; margin-bottom: 4px;">✈️ 파트너사 실시간 항공·호텔 최저가 알림</div>
      <div style="font-size: 11.5px; color: #a1a5b8; margin-bottom: 10px;">TripScanner와 GetForTrip을 통해 전 세계 주요 노선의 실시간 요금을 비교하세요.</div>
      <a href="https://tripscanner.io?utm_source=newsletter&utm_medium=email" style="display: inline-block; background-color: #00d4aa; color: #0d0e1a; font-size: 12px; font-weight: bold; padding: 8px 16px; border-radius: 6px; text-decoration: none;">
        실시간 특가 확인하기
      </a>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; border-top: 1px solid #23253a; padding-top: 18px; font-size: 11px; color: #5e6278; line-height: 1.5; text-align: center;">
      <p style="margin: 0 0 6px 0;">
        본 메일은 체크인데일리(Check-in Daily) 뉴스레터를 수신 동의하신 구독자께 발송됩니다.
      </p>
      <p style="margin: 0;">
        © 2026 Check-in Daily Newsroom. All rights reserved. •
        <a href="${siteUrl}/policy" style="color: #7e8299; text-decoration: underline;">이용약관 및 프라이버시</a>
      </p>
    </div>
  </div>
</body>
</html>
  `
}

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'D1 database binding unavailable' })
  }

  // Strict Fail-Closed Authorization:
  const token = getRequestHeader(event, 'x-cron-token')
  const expectedToken = process.env.CRON_TOKEN

  let isAuthorized = false
  if (token && expectedToken && expectedToken.length >= 16 && token === expectedToken) {
    isAuthorized = true
  }

  if (!isAuthorized) {
    const session = await authenticateAdmin(event, database)
    if (session.identity) {
      isAuthorized = true
    }
  }

  if (!isAuthorized) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized newsletter cron request' })
  }

  const now = new Date()
  const dateStr = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(now)

  // 1. Fetch Top 3~5 Articles (published)
  let articles = await d1All<ArticleBrief>(
    database,
    `SELECT id, title, summary, category, cover_image, published_at, view_count
     FROM articles
     WHERE status = 'published' AND datetime(published_at) >= datetime('now', '-24 hours')
     ORDER BY is_breaking DESC, view_count DESC, id DESC
     LIMIT 5`,
  )

  if (articles.length === 0) {
    articles = await d1All<ArticleBrief>(
      database,
      `SELECT id, title, summary, category, cover_image, published_at, view_count
       FROM articles
       WHERE status = 'published'
       ORDER BY id DESC
       LIMIT 3`,
    )
  }

  // 2. Fetch Active Subscribers
  const subscribers = await d1All<SubscriberRow>(
    database,
    'SELECT email, lang FROM newsletter_subscriptions WHERE is_active = 1 LIMIT 500',
  )

  const siteUrl = (siteConfig.domain || 'https://travel-checkin-daily.dnjstjqppk.workers.dev').replace(/\/+$/, '')
  const emailHtml = buildNewsletterHtml(articles, dateStr, siteUrl)

  // 3. Record in audit_logs
  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'system',
    'newsletter-scheduler',
    'dispatch_morning_newsletter',
    'newsletter:subscribers',
    JSON.stringify({
      dispatchedCount: subscribers.length,
      articlesCount: articles.length,
      articleIds: articles.map((a) => a.id),
      timestamp: now.toISOString(),
    }),
  )

  return {
    success: true,
    message: `Morning newsletter briefing generated for ${subscribers.length} subscribers with ${articles.length} articles.`,
    articlesCount: articles.length,
    subscribersCount: subscribers.length,
    timestamp: now.toISOString(),
    previewSnippet: articles.map((a) => a.title),
  }
})
