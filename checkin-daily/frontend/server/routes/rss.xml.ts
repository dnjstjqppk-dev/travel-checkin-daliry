import { defineEventHandler, getRequestHeader, getRequestURL, setResponseHeader } from 'h3'
import { d1All, getD1Database } from '../utils/d1'
import { siteConfig } from '../../config/site.config'

interface ArticleRssRow {
  id: number
  title: string
  summary: string | null
  category: string
  slug: string
  published_at: string | null
  created_at: string
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=1800, s-maxage=3600')

  const reqUrl = getRequestURL(event)
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || reqUrl.host
  const protocol = getRequestHeader(event, 'x-forwarded-proto') || reqUrl.protocol.replace(':', '') || 'https'
  const baseUrl = host ? `${protocol}://${host}` : (siteConfig.domain || 'https://travel-checkin-daily.dnjstjqppk.workers.dev')

  const database = getD1Database(event)

  let articles: ArticleRssRow[] = []
  if (database) {
    try {
      articles = await d1All<ArticleRssRow>(
        database,
        "SELECT id, title, summary, category, slug, published_at, created_at FROM articles WHERE status = 'published' ORDER BY id DESC LIMIT 50",
      )
    } catch {
      articles = []
    }
  }

  const nowRfc822 = new Date().toUTCString()

  const items = articles
    .map((a) => {
      const itemUrl = `${baseUrl}/news/${encodeURIComponent(a.category || 'major')}/article/${a.id}`
      const pubDate = a.published_at || a.created_at ? new Date(a.published_at || a.created_at).toUTCString() : nowRfc822
      const description = a.summary || a.title || ''
      const category = a.category || 'General'

      return `    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${escapeXml(itemUrl)}</link>
      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(category)}</category>
      <description><![CDATA[${description}]]></description>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${siteConfig.brandName} ${siteConfig.brandSubname} - ${siteConfig.slogan}]]></title>
    <link>${escapeXml(baseUrl)}</link>
    <description><![CDATA[${siteConfig.description}]]></description>
    <language>ko</language>
    <lastBuildDate>${nowRfc822}</lastBuildDate>
    <atom:link href="${escapeXml(baseUrl)}/rss.xml" rel="self" type="application/rss+xml" />
    <generator>CheckIn Daily Master Architecture</generator>
${items}
  </channel>
</rss>`
})

