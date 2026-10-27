import { createError, defineEventHandler, getQuery } from 'h3'
import { d1All, getD1Database } from '../../utils/d1'
import { authenticateAdmin } from '../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  const query = getQuery(event)
  const email = query.email ? String(query.email).trim().toLowerCase() : null
  const status = query.status ? String(query.status).trim() : null

  // Check if admin is requesting
  let isAdmin = false
  try {
    const session = await authenticateAdmin(event, database)
    if (session.identity) isAdmin = true
  } catch {
    isAdmin = false
  }

  let items: any[] = []

  if (isAdmin) {
    if (status) {
      items = await d1All(
        database,
        'SELECT * FROM contributor_submissions WHERE status = ? ORDER BY id DESC LIMIT 100',
        status,
      )
    } else {
      items = await d1All(
        database,
        'SELECT * FROM contributor_submissions ORDER BY id DESC LIMIT 100',
      )
    }
  } else if (email) {
    items = await d1All(
      database,
      `SELECT id, title, category, status, submitter_name as submitterName,
              editorial_feedback as editorialFeedback, created_at as createdAt
       FROM contributor_submissions
       WHERE submitter_email = ?
       ORDER BY id DESC LIMIT 20`,
      email,
    )
  } else {
    // Public view: recent submissions summary (anonymized)
    items = await d1All(
      database,
      `SELECT id, title, category, status, submitter_name as submitterName,
              editorial_feedback as editorialFeedback, created_at as createdAt
       FROM contributor_submissions
       ORDER BY id DESC LIMIT 10`,
    )
  }

  return { submissions: items }
})

