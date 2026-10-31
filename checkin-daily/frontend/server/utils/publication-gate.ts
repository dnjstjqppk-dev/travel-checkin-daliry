import { createError } from 'h3'
import { d1First, type D1Database } from './d1'
import { validateArticleForPublish } from './article-validator'

export async function assertArticlePublishable(database: D1Database, id: number): Promise<void> {
  const article = await d1First<{ content: string; cover_image: string; license_info: string }>(
    database, 'SELECT content, cover_image, license_info FROM articles WHERE id = ?', id,
  )
  if (!article) throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  if (!article.license_info?.trim() || article.license_info === 'Editorial Fair Citation') {
    throw createError({ statusCode: 422, statusMessage: 'Document content usage rights before publishing' })
  }
  const validation = validateArticleForPublish({ content: article.content, coverImage: article.cover_image })
  if (!validation.valid) throw createError({ statusCode: 422, statusMessage: 'Article does not meet publication requirements' })
}
