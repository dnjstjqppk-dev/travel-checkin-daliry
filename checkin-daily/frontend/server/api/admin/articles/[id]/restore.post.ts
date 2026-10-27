import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { d1First, d1Run, getD1Database } from '../../../../utils/d1'
import { authenticateAdmin, isSameOriginRequest } from '../../../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden request origin' })
  }

  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Valid article ID required' })
  }

  const body = await readBody(event)
  const revisionId = Number(body?.revisionId)
  if (!Number.isSafeInteger(revisionId) || revisionId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Valid revisionId is required' })
  }

  // 1. Fetch target revision
  const revision = await d1First<{
    id: number
    article_id: number
    revision_num: number
    title: string
    summary: string
    content: string
  }>(
    database,
    'SELECT id, article_id, revision_num, title, summary, content FROM article_revisions WHERE id = ? AND article_id = ?',
    revisionId,
    id,
  )

  if (!revision) {
    throw createError({ statusCode: 404, statusMessage: 'Target revision not found for this article' })
  }

  // 2. Fetch current article state to create a backup revision before restoring
  const current = await d1First<{
    title: string
    summary: string
    content: string
  }>(
    database,
    'SELECT title, summary, content FROM articles WHERE id = ?',
    id,
  )

  const latestRev = await d1First<{ max_rev: number }>(
    database,
    'SELECT COALESCE(MAX(revision_num), 0) as max_rev FROM article_revisions WHERE article_id = ?',
    id,
  )
  const nextRevNum = (latestRev?.max_rev || 0) + 1

  if (current) {
    await d1Run(
      database,
      `INSERT INTO article_revisions (article_id, revision_num, title, summary, content, editor_note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      nextRevNum,
      current.title,
      current.summary,
      current.content,
      `스냅샷 (버전 #${revision.revision_num} 복원 전 자동 보존)`,
    )
  }

  // 3. Restore article to the target revision
  const now = new Date().toISOString()
  await d1Run(
    database,
    `UPDATE articles
     SET title = ?, summary = ?, content = ?, updated_at = ?
     WHERE id = ?`,
    revision.title,
    revision.summary,
    revision.content,
    now,
    id,
  )

  // 4. Record audit log
  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'editor',
    session.identity.username,
    'restore_article_revision',
    `article:${id}`,
    JSON.stringify({ revisionId, revisionNum: revision.revision_num, title: revision.title }),
  )

  return {
    success: true,
    message: `기사가 버전 #${revision.revision_num}으로 성공적으로 복원되었습니다.`,
    restored: {
      title: revision.title,
      summary: revision.summary,
      content: revision.content,
    },
  }
})

