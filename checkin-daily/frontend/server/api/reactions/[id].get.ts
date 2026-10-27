import { createError, defineEventHandler, getRequestHeader, getRouterParam } from 'h3'
import { d1All, d1First, getD1Database } from '../../utils/d1'

async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default defineEventHandler(async (event) => {
  const articleId = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(articleId) || articleId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Valid articleId required' })
  }

  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  const ip = getRequestHeader(event, 'cf-connecting-ip')
    || getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || '127.0.0.1'
  const ipHash = await sha256(`react_${ip}`)

  // Get aggregated counts
  let counts = { helpful: 0, insightful: 0, recommend: 0 }
  let userReactions: string[] = []

  try {
    const rows = await d1All<{ reaction_type: string; total: number }>(
      database,
      'SELECT reaction_type, COUNT(*) as total FROM article_reactions WHERE article_id = ? GROUP BY reaction_type',
      articleId,
    )
    for (const r of rows) {
      if (r.reaction_type in counts) {
        counts[r.reaction_type as keyof typeof counts] = Number(r.total)
      }
    }

    const userRows = await d1All<{ reaction_type: string }>(
      database,
      'SELECT reaction_type FROM article_reactions WHERE article_id = ? AND ip_hash = ?',
      articleId,
      ipHash,
    )
    userReactions = userRows.map((r) => r.reaction_type)
  } catch {}

  return { counts, userReactions }
})

