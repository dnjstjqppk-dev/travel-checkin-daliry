// checkin-daily/frontend/server/api/admin/generate-article.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { getD1Database, d1Run, d1First, type D1Database } from '../../utils/d1'
import { generateNewsStory } from '../../utils/ai-generator'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ keyword?: string; category?: string; publishNow?: boolean }>(event)
  const keyword = body?.keyword?.trim()

  if (!keyword) {
    throw createError({ statusCode: 400, statusMessage: '키워드를 입력해 주세요.' })
  }

  // 1. Generate article story with strict 300~1,000 char validation, 4~10 body images, and CTA
  const story = generateNewsStory(keyword, body.category)

  // Verify strict publishing standards (300 <= length <= 1,000, 4 <= images <= 10)
  if (story.charCount < 300 || story.charCount > 1000) {
    throw createError({
      statusCode: 400,
      statusMessage: `글자 수 검증 실패: ${story.charCount}자 (300자 이상 1,000자 이하여야 합니다)`,
    })
  }
  if (story.imageCount < 4 || story.imageCount > 10) {
    throw createError({
      statusCode: 400,
      statusMessage: `본문 이미지 검증 실패: ${story.imageCount}장 (4장 이상 10장 이하여야 합니다)`,
    })
  }

  const database = getD1Database(event)

  // If not publishing immediately, return preview draft
  if (!body.publishNow || !database) {
    return {
      success: true,
      draft: story,
      charCount: story.charCount,
      imageCount: story.imageCount,
      isValidLength: true,
      isValidImages: true,
      ctaTarget: story.ctaTarget,
      message: `기사가 성공적으로 생성되었습니다. (본문 텍스트 ${story.charCount}자 / 이미지 ${story.imageCount}장 규격 통과)`,
    }
  }

  // 2. Publish directly to Cloudflare D1
  const nowIso = new Date().toISOString()
  const insertArticleSql = `INSERT INTO articles (title, slug, summary, content, category, author, cover_image, status, view_count, published_at, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 150, ?, ?, ?) RETURNING id;`

  try {
    const articleRow = await database.prepare(insertArticleSql)
      .bind(
        story.title,
        story.slug,
        story.summary,
        story.content,
        story.category,
        story.author,
        story.coverImage,
        story.publishedAt,
        nowIso,
        nowIso,
      )
      .first<{ id: number }>()

    if (!articleRow?.id) {
      throw new Error('D1 INSERT failed to return ID')
    }

    const articleId = articleRow.id

    // Default city mapping
    await d1Run(database, 'INSERT OR IGNORE INTO article_cities (article_id, city_id) VALUES (?, ?)', articleId, 'bkk')

    // Insert 5 translations into article_translations
    const translationStatements = [
      database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
        .bind(articleId, 'en', story.translations.en.title, story.translations.en.summary, story.translations.en.content),
      database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
        .bind(articleId, 'zh', story.translations.zh.title, story.translations.zh.summary, story.translations.zh.content),
      database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
        .bind(articleId, 'th', story.translations.th.title, story.translations.th.summary, story.translations.th.content),
      database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
        .bind(articleId, 'vi', story.translations.vi.title, story.translations.vi.summary, story.translations.vi.content),
      database.prepare('INSERT INTO article_translations (article_id, lang, title, summary, content) VALUES (?, ?, ?, ?, ?)')
        .bind(articleId, 'es', story.translations.es.title, story.translations.es.summary, story.translations.es.content),
    ]

    await database.batch(translationStatements)

    return {
      success: true,
      articleId,
      slug: story.slug,
      title: story.title,
      category: story.category,
      charCount: story.charCount,
      imageCount: story.imageCount,
      isValidLength: true,
      isValidImages: true,
      ctaTarget: story.ctaTarget,
      liveUrl: `/news/${story.category}/article/${articleId}`,
      message: `🎉 기사가 즉시 발행되었습니다! (본문 텍스트 ${story.charCount}자, 이미지 ${story.imageCount}장, 5개국어 번역 및 ${story.ctaTarget} 트래픽 CTA 탑재 완료)`,
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `기사 D1 저장 실패: ${err.message}`,
    })
  }
})

