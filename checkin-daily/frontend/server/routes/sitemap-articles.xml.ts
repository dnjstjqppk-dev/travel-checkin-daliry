import { defineEventHandler, setResponseHeader } from 'h3'
import { d1All, getD1Database } from '../utils/d1'
import { resolveBaseUrl } from '../utils/site-domain'

interface ArticleSitemapRow {
  id: number
  category: string
  updated_at: string
  published_at: string | null
}

const SUPPORTED_LANGS = [
  { prefix: '', hreflang: 'ko' },
  { prefix: '/en', hreflang: 'en' },
  { prefix: '/zh', hreflang: 'zh-Hans' },
  { prefix: '/th', hreflang: 'th' },
  { prefix: '/vi', hreflang: 'vi' },
  { prefix: '/es', hreflang: 'es' },
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

  const baseUrl = await resolveBaseUrl(event)
  const database = getD1Database(event)

  let articles: ArticleSitemapRow[] = []
  if (database) {
    try {
      articles = await d1All<ArticleSitemapRow>(
        database,
        "SELECT id, category, updated_at, published_at FROM articles WHERE status = 'published' ORDER BY id DESC LIMIT 2000",
      )
    } catch {
      articles = []
    }
  }

  const todayStr = new Date().toISOString().split('T')[0]

  const urlNodes = articles.map((a) => {
    const rawDate = String(a.updated_at || a.published_at || todayStr)
    const lastmod = rawDate.includes(' ') ? rawDate.split(' ')[0]! : (rawDate.includes('T') ? rawDate.split('T')[0]! : rawDate)
    const category = encodeURIComponent(a.category || 'major')

    return SUPPORTED_LANGS.map(({ prefix, hreflang }) => {
      const loc = `${baseUrl}${prefix}/news/${category}/article/${a.id}`
      const priority = prefix === '' ? '0.8' : '0.7'

      const alternates = SUPPORTED_LANGS.map((alt) => {
        return `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${baseUrl}${alt.prefix}/news/${category}/article/${a.id}" />`
      }).join('\n')

      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/news/${category}/article/${a.id}" />`

      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
${alternates}
${xDefault}
  </url>`
    }).join('\n')
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlNodes}
</urlset>`
})
