import { defineEventHandler, getRequestHeader, getRequestURL, setResponseHeader } from 'h3'
import { d1All, getD1Database } from '../utils/d1'
import { siteConfig } from '../../config/site.config'

interface ArticleSitemapRow {
  id: number
  category: string
  slug: string
  updated_at: string
}

const SUPPORTED_LANG_PREFIXES = ['', '/en', '/zh', '/th', '/vi', '/es']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

  const reqUrl = getRequestURL(event)
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || reqUrl.host
  const protocol = getRequestHeader(event, 'x-forwarded-proto') || reqUrl.protocol.replace(':', '') || 'https'
  const baseUrl = host ? `${protocol}://${host}` : (siteConfig.domain || 'https://travel-checkin-daily.dnjstjqppk.workers.dev')

  const database = getD1Database(event)

  let articles: ArticleSitemapRow[] = []
  if (database) {
    try {
      articles = await d1All<ArticleSitemapRow>(
        database,
        "SELECT id, category, slug, updated_at FROM articles WHERE status = 'published' ORDER BY id DESC LIMIT 500",
      )
    } catch {
      articles = []
    }
  }

  const categoryPaths = [
    { path: '', priority: '1.0', changefreq: 'daily' },
    { path: '/major', priority: '0.9', changefreq: 'daily' },
    { path: '/airline', priority: '0.9', changefreq: 'daily' },
    { path: '/hotel', priority: '0.9', changefreq: 'daily' },
    { path: '/destination', priority: '0.9', changefreq: 'daily' },
    { path: '/realtime', priority: '0.8', changefreq: 'hourly' },
    { path: '/region', priority: '0.8', changefreq: 'weekly' },
  ]

  const todayStr = new Date().toISOString().split('T')[0]

  // Generate localized static URLs for all 6 languages
  const staticUrls = SUPPORTED_LANG_PREFIXES.flatMap((prefix) => {
    return categoryPaths.map((cat) => {
      const url = `${baseUrl}${prefix}/news${cat.path}`
      const priority = prefix === '' ? cat.priority : (parseFloat(cat.priority) - 0.1).toFixed(1)
      return `
  <url>
    <loc>${url}</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>${cat.changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    })
  }).join('')

  // Generate localized article URLs for all 6 languages
  const articleUrls = articles.flatMap((a) => {
    const lastmod = (a.updated_at || todayStr).split(' ')[0]
    return SUPPORTED_LANG_PREFIXES.map((prefix) => {
      const url = `${baseUrl}${prefix}/news/${a.category}/article/${a.id}`
      const priority = prefix === '' ? '0.8' : '0.7'
      return `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
    })
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${staticUrls}
${articleUrls}
</urlset>`
})
