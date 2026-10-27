import { defineEventHandler, setResponseHeader } from 'h3'
import { d1All, d1First, getD1Database } from '../utils/d1'
import { resolveBaseUrl } from '../utils/site-domain'

interface GoogleNewsRow {
  id: number
  title: string
  category: string
  published_at: string | null
  updated_at: string
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=900, s-maxage=1800')

  const baseUrl = await resolveBaseUrl(event)
  const database = getD1Database(event)

  let publicationName = 'Check-in Daily'
  if (database) {
    try {
      const row = await d1First<{ value: string }>(
        database,
        "SELECT value FROM site_settings WHERE key = 'google_news_publication_name' LIMIT 1",
      )
      if (row?.value) {
        publicationName = row.value.trim()
      }
    } catch {}
  }

  let articles: GoogleNewsRow[] = []
  if (database) {
    try {
      // 1. Prioritize articles published within 48 hours
      articles = await d1All<GoogleNewsRow>(
        database,
        `SELECT id, title, category, published_at, updated_at
         FROM articles
         WHERE status = 'published' AND published_at >= datetime('now', '-48 hours')
         ORDER BY id DESC
         LIMIT 100`,
      )

      // 2. Fallback to latest 20 published articles if none within 48h (ensures valid news feed for Google review)
      if (!articles.length) {
        articles = await d1All<GoogleNewsRow>(
          database,
          `SELECT id, title, category, published_at, updated_at
           FROM articles
           WHERE status = 'published'
           ORDER BY id DESC
           LIMIT 20`,
        )
      }
    } catch {
      articles = []
    }
  }

  const urlNodes = articles.map((a) => {
    const pubDate = a.published_at ? new Date(a.published_at).toISOString() : new Date().toISOString()
    const loc = `${baseUrl}/news/${encodeURIComponent(a.category || 'major')}/article/${a.id}`

    return `  <url>
    <loc>${loc}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(publicationName)}</news:name>
        <news:language>ko</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlNodes}
</urlset>`
})

