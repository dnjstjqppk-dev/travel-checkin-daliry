// checkin-daily/frontend/server/api/articles/[id]/comments.post.ts
import { createError, defineEventHandler, getRequestHeader, getRouterParam, readBody } from 'h3'
import { getD1Database, d1First, d1Run } from '../../../utils/d1'
import { containsAbuseKeywords, hashCommentPassword, hashIp } from '../../../utils/comments-guard'

interface CreateCommentPayload {
  authorName: string
  password?: string
  content: string
  parentId?: number
  authorEmail?: string
}

export default defineEventHandler(async (event) => {
  const articleId = parseInt(getRouterParam(event, 'id') || '', 10)
  if (!articleId || isNaN(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  // 1. Verify article exists and is published
  const article = await d1First<{ id: number; status: string }>(
    database,
    `SELECT id, status FROM articles WHERE id = ? AND status = 'published'`,
    articleId,
  )
  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found or not published' })
  }

  // 2. Read and validate payload
  const body = await readBody<CreateCommentPayload>(event)
  const authorName = (body?.authorName || '').trim()
  const content = (body?.content || '').trim()
  const password = (body?.password || '').trim()
  const parentId = body?.parentId ? parseInt(String(body.parentId), 10) : null

  if (authorName.length < 2 || authorName.length > 30) {
    throw createError({ statusCode: 400, statusMessage: '작성자 이름은 2자 이상 30자 이하여야 합니다.' })
  }

  if (content.length < 2 || content.length > 1000) {
    throw createError({ statusCode: 400, statusMessage: '댓글 내용은 2자 이상 1,000자 이하여야 합니다.' })
  }

  // 3. Parent ID validation (if reply)
  if (parentId) {
    const parent = await d1First<{ id: number; article_id: number; parent_id: number | null }>(
      database,
      `SELECT id, article_id, parent_id FROM comments WHERE id = ?`,
      parentId,
    )
    if (!parent || parent.article_id !== articleId) {
      throw createError({ statusCode: 400, statusMessage: '원댓글을 찾을 수 없습니다.' })
    }
    // Limit to 1 nesting level: replies to a reply attach to the root comment
    if (parent.parent_id !== null) {
      throw createError({ statusCode: 400, statusMessage: '대댓글에는 추가 대댓글을 작성할 수 없습니다.' })
    }
  }

  // 4. IP Hash for Rate Limiting / Abuse
  const clientIp = getRequestHeader(event, 'cf-connecting-ip')
    || getRequestHeader(event, 'x-forwarded-for')
    || '127.0.0.1'
  const ipHash = await hashIp(clientIp)

  // 5. Abuse Keyword Check -> Flag if detected
  const isAbusive = containsAbuseKeywords(content) || containsAbuseKeywords(authorName)
  const status = isAbusive ? 'pending_review' : 'approved'

  // 6. Hash password for commenter self-deletion
  const passwordHash = password ? await hashCommentPassword(password) : null

  const now = new Date().toISOString()
  const result = await d1Run(
    database,
    `INSERT INTO comments (article_id, parent_id, author_name, author_email, password_hash, content, status, ip_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    articleId,
    parentId,
    authorName,
    body?.authorEmail || null,
    passwordHash,
    content,
    status,
    ipHash,
    now,
    now,
  )

  const newId = result.meta?.last_row_id || 0

  return {
    success: true,
    message: isAbusive ? '댓글이 작성되었으며, 클린봇 검토 후 공개됩니다.' : '댓글이 등록되었습니다.',
    commentId: newId,
    status,
  }
})

