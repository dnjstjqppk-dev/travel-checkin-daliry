// checkin-daily/frontend/server/api/push/latest.get.ts
import { defineEventHandler } from 'h3'
import { getD1Database, d1First } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    return {
      title: '체크인데일리 속보 알림',
      body: '새로운 주요 여행 뉴스가 등록되었습니다.',
      data: { url: '/news' },
    }
  }

  // 1. Check if there is a recent breaking news published
  let article = await d1First<any>(
    database,
    `SELECT id, title, summary, category, cover_image
     FROM articles
     WHERE status = 'published' AND is_breaking = 1
     ORDER BY published_at DESC LIMIT 1`,
  )

  if (!article) {
    article = await d1First<any>(
      database,
      `SELECT id, title, summary, category, cover_image
       FROM articles
       WHERE status = 'published'
       ORDER BY published_at DESC LIMIT 1`,
    )
  }

  if (!article) {
    return {
      title: '체크인데일리 속보 알림',
      body: '새로운 여행 뉴스를 확인하세요.',
      data: { url: '/news' },
    }
  }

  return {
    title: `[속보] ${article.title}`,
    body: article.summary ? (article.summary.slice(0, 100) + '...') : '기사 본문을 확인해 보세요.',
    icon: article.cover_image || '/icons/icon-192.png',
    data: {
      url: `/news/${article.category || 'major'}/article/${article.id}`,
    },
  }
})

