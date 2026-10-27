import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { d1All, getD1Database } from '../utils/d1'
import { resolveBaseUrl } from '../utils/site-domain'
import { siteConfig } from '../../config/site.config'

interface ArticleRssRow {
  id: number
  title: string
  summary: string | null
  content: string | null
  category: string
  slug: string
  cover_image: string | null
  published_at: string | null
  created_at: string
  author: string | null
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=1800, s-maxage=3600')

  const query = getQuery(event)
  const lang = typeof query.lang === 'string' && ['en', 'zh', 'th', 'vi', 'es'].includes(query.lang) ? query.lang : 'ko'
  const categoryParam = typeof query.cat === 'string' ? query.cat.trim().toLowerCase() : ''

  const baseUrl = await resolveBaseUrl(event)
  const database = getD1Database(event)

  let articles: ArticleRssRow[] = []
  if (database) {
    try {
      if (lang === 'ko') {
        const sql = categoryParam
          ? "SELECT id, title, summary, content, category, slug, cover_image, published_at, created_at, author FROM articles WHERE status = 'published' AND category = ? ORDER BY id DESC LIMIT 50"
          : "SELECT id, title, summary, content, category, slug, cover_image, published_at, created_at, author FROM articles WHERE status = 'published' ORDER BY id DESC LIMIT 50"
        articles = await d1All<ArticleRssRow>(database, sql, categoryParam ? [categoryParam] : [])
      } else {
        const sql = categoryParam
          ? `SELECT a.id,
                    COALESCE(t.title, a.title) as title,
                    COALESCE(t.summary, a.summary) as summary,
                    COALESCE(t.content, a.content) as content,
                    a.category, a.slug, a.cover_image, a.published_at, a.created_at, a.author
             FROM articles a
             LEFT JOIN article_translations t ON a.id = t.article_id AND t.lang = ?
             WHERE a.status = 'published' AND a.category = ?
             ORDER BY a.id DESC LIMIT 50`
          : `SELECT a.id,
                    COALESCE(t.title, a.title) as title,
                    COALESCE(t.summary, a.summary) as summary,
                    COALESCE(t.content, a.content) as content,
                    a.category, a.slug, a.cover_image, a.published_at, a.created_at, a.author
             FROM articles a
             LEFT JOIN article_translations t ON a.id = t.article_id AND t.lang = ?
             WHERE a.status = 'published'
             ORDER BY a.id DESC LIMIT 50`
        articles = await d1All<ArticleRssRow>(database, sql, categoryParam ? [lang, categoryParam] : [lang])
      }
    } catch {
      articles = []
    }
  }

  const nowRfc822 = new Date().toUTCString()
  const langPrefix = lang === 'ko' ? '' : `/${lang}`

  const selfFeedUrl = `${baseUrl}/rss.xml${lang !== 'ko' || categoryParam ? `?${new URLSearchParams({ ...(lang !== 'ko' ? { lang } : {}), ...(categoryParam ? { cat: categoryParam } : {}) }).toString()}` : ''}`

  const items = articles
    .map((a) => {
      const itemUrl = `${baseUrl}${langPrefix}/news/${encodeURIComponent(a.category || 'major')}/article/${a.id}`
      const pubDate = a.published_at || a.created_at ? new Date(a.published_at || a.created_at).toUTCString() : nowRfc822
      const description = a.summary || a.title || ''
      const category = a.category || 'General'
      const author = a.author || 'Check-in Daily Editorial Desk'

      let mediaTags = ''
      if (a.cover_image && a.cover_image.startsWith('http')) {
        mediaTags = `
      <enclosure url="${escapeXml(a.cover_image)}" length="124500" type="image/jpeg" />
      <media:content url="${escapeXml(a.cover_image)}" medium="image" width="1200" height="800">
        <media:title><![CDATA[${a.title}]]></media:title>
      </media:content>`
      }

      return `    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${escapeXml(itemUrl)}</link>
      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>editorial@checkindaily.com (${escapeXml(author)})</author>
      <dc:creator><![CDATA[${author}]]></dc:creator>
      <category>${escapeXml(category)}</category>
      <description><![CDATA[${description}]]></description>
      <content:encoded><![CDATA[<p>${description}</p>]]></content:encoded>${mediaTags}
    </item>`
    })
    .join('\n')

  const channelTitle = categoryParam
    ? `${siteConfig.brandName} ${siteConfig.brandSubname} [${categoryParam.toUpperCase()}] - ${siteConfig.slogan}`
    : `${siteConfig.brandName} ${siteConfig.brandSubname} - ${siteConfig.slogan}`

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title><![CDATA[${channelTitle}]]></title>
    <link>${escapeXml(baseUrl)}</link>
    <description><![CDATA[${siteConfig.description}]]></description>
    <language>${lang}</language>
    <lastBuildDate>${nowRfc822}</lastBuildDate>
    <atom:link href="${escapeXml(selfFeedUrl)}" rel="self" type="application/rss+xml" />
    <generator>Check-in Daily Enterprise Syndication Engine</generator>
${items}
  </channel>
</rss>`
})
