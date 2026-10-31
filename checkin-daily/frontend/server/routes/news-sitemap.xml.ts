import { publicArticleSql, sitemapPage } from '../utils/sitemap-data'
import { escapeXml, isRecentPublication, publicationDate } from '../utils/syndication'
import { createError, defineEventHandler, setResponseHeader } from 'h3'
import { d1All, d1First, getD1Database } from '../utils/d1'
import { resolveBaseUrl } from '../utils/site-domain'

interface GoogleNewsRow {
  id: number
  title: string
  category: string
  published_at: string | null
  updated_at: string
}


export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-cache')

  const page = sitemapPage(event)
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

  if (!database) throw createError({ statusCode: 503, statusMessage: 'News database unavailable' })
  let articles: GoogleNewsRow[] = []
  if (database) {
    try {
      // 1. Prioritize articles published within 48 hours
      articles = await d1All<GoogleNewsRow>(
        database,
        `SELECT a.id, a.title, a.category, a.published_at, a.updated_at
         FROM articles a
         WHERE ${publicArticleSql} AND julianday(published_at) >= julianday('now', '-48 hours') AND julianday(published_at) <= julianday('now')
         ORDER BY id DESC
         LIMIT 1000 OFFSET ?`,
        (page - 1) * 1000,
      )

    } catch {
      throw createError({ statusCode: 503, statusMessage: 'News sitemap unavailable' })
    }
  }

  if (page > 1 && !articles.length) throw createError({ statusCode: 404, statusMessage: 'Sitemap page not found' })
  const urlNodes = articles.filter(a => isRecentPublication(a.published_at)).map((a) => {
    const pubDate = publicationDate(a.published_at)!.toISOString()
    const loc = `${baseUrl}/news/${encodeURIComponent(a.category || 'major')}/article/${a.id}`

    return `  <url>
    <loc>${escapeXml(loc)}</loc>
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

