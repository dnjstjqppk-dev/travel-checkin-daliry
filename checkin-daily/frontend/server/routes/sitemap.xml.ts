import { defineEventHandler, getRequestHeader, getRequestURL, setResponseHeader } from 'h3'
import { d1All, d1First, getD1Database } from '../utils/d1'
import { siteConfig } from '../../config/site.config'

interface ArticleSitemapRow {
  id: number
  title: string
  category: string
  slug: string
  published_at: string | null
  updated_at: string
}

const SUPPORTED_LANG_PREFIXES = [
  { prefix: '', lang: 'ko' },
  { prefix: '/en', lang: 'en' },
  { prefix: '/zh', lang: 'zh' },
  { prefix: '/th', lang: 'th' },
  { prefix: '/vi', lang: 'vi' },
  { prefix: '/es', lang: 'es' },
]

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
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

  const database = getD1Database(event)

  // 1. Dynamic domain resolution from site_settings or headers
  let customSiteUrl = ''
  if (database) {
    try {
      const row = await d1First<{ value: string }>(
        database,
        "SELECT value FROM site_settings WHERE key = 'site_url' OR key = 'site_domain' LIMIT 1",
      )
      if (row?.value) {
        customSiteUrl = row.value.trim().replace(/\/+$/, '')
      }
    } catch {}
  }

  const reqUrl = getRequestURL(event)
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || reqUrl.host
  const protocol = getRequestHeader(event, 'x-forwarded-proto') || reqUrl.protocol.replace(':', '') || 'https'
  const fallbackUrl = host ? `${protocol}://${host}` : (siteConfig.domain || 'https://travel-checkin-daily.dnjstjqppk.workers.dev')
  const baseUrl = customSiteUrl || fallbackUrl

  let articles: ArticleSitemapRow[] = []
  if (database) {
    try {
      articles = await d1All<ArticleSitemapRow>(
        database,
        "SELECT id, title, category, slug, published_at, updated_at FROM articles WHERE status = 'published' ORDER BY id DESC LIMIT 500",
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

  const now = Date.now()
  const todayStr = new Date().toISOString().split('T')[0]
  const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000

  // Generate localized static URLs for all 6 languages
  const staticUrls = SUPPORTED_LANG_PREFIXES.flatMap(({ prefix }) => {
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

  // Generate localized article URLs for all 6 languages with Google News extensions for recent articles
  const articleUrls = articles.flatMap((a) => {
    const rawDate = String(a.updated_at || todayStr)
    const lastmod = rawDate.includes(' ') ? rawDate.split(' ')[0]! : rawDate
    const pubDateMs = a.published_at ? new Date(a.published_at).getTime() : 0
    const isGoogleNewsEligible = pubDateMs >= fortyEightHoursAgo

    return SUPPORTED_LANG_PREFIXES.map(({ prefix, lang }) => {
      const url = `${baseUrl}${prefix}/news/${a.category}/article/${a.id}`
      const priority = prefix === '' ? '0.8' : '0.7'

      let newsBlock = ''
      if (isGoogleNewsEligible) {
        const pubDateIso = new Date(pubDateMs).toISOString()
        newsBlock = `
    <news:news>
      <news:publication>
        <news:name>Check-in Daily</news:name>
        <news:language>${lang}</news:language>
      </news:publication>
      <news:publication_date>${pubDateIso}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>`
      }

      return `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>${newsBlock}
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
