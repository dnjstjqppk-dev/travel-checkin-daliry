import { createError, defineEventHandler } from 'h3'
import { getD1Database, d1All } from '../../../utils/d1'
import { authenticateAdmin } from '../../../utils/d1-auth'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database binding not available' })
  }

  const session = await authenticateAdmin(event, database)
  if (!session.identity) {
    throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  }

  const rows = await d1All<{
    id: string
    filename: string
    mime_type: string
    size_bytes: number
    alt_text: string
    caption: string
    uploaded_by: string
    created_at: string
  }>(
    database,
    `SELECT id, filename, mime_type, size_bytes, alt_text, caption, uploaded_by, created_at
     FROM media_assets
     ORDER BY created_at DESC
     LIMIT 100`
  )

  return {
    assets: rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      altText: r.alt_text,
      caption: r.caption,
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at,
      url: `/api/media/${r.id}`,
    })),
  }
})

