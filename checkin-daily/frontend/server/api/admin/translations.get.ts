import { createError, defineEventHandler } from 'h3'
import { d1All, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const session = await authenticateAdmin(event, database)
  if (!session.identity) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const articles = await d1All(
    database,
    `SELECT a.id, a.title, a.category, a.status, a.published_at,
       (SELECT group_concat(lang) FROM article_translations WHERE article_id = a.id) AS translated_langs
     FROM articles a
     ORDER BY a.id DESC
     LIMIT 50`,
  )

  return { articles }
})

