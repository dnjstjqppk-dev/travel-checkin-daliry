import { createError, getQuery, setResponseHeader, type H3Event } from 'h3'
import { d1All, getD1Database } from './d1'
import { publicArticleSql } from './sitemap-data'
import { escapeXml, publicationDate } from './syndication'
import { resolveBaseUrl } from './site-domain'

interface FeedRow { id: number; title: string; summary: string; category: string; author: string; published_at: string; updated_at: string; source_name: string; source_url: string }
export async function newsFeed(event: H3Event, format: 'rss' | 'atom', categoryOverride?: string): Promise<string> {
  const query = getQuery(event)
  const lang = typeof query.lang === 'string' ? query.lang : 'ko'
  if (!['ko', 'en', 'zh', 'th', 'vi', 'es'].includes(lang)) throw createError({ statusCode: 400, statusMessage: 'Unsupported feed language' })
  const category = categoryOverride || (typeof query.cat === 'string' ? query.cat : '')
  if (category && !['latest', 'breaking', 'major', 'airline', 'hotel', 'destination', 'realtime'].includes(category)) {
    throw createError({ statusCode: 404, statusMessage: 'Feed not found' })
  }
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const base = await resolveBaseUrl(event)
  const translated = lang !== 'ko'
  const filter = category === 'breaking' ? ' AND a.is_breaking = 1' : category && category !== 'latest' ? ' AND a.category = ?' : ''
  const rows = await d1All<FeedRow>(database, `SELECT a.id, ${translated ? 't.title, t.summary' : 'a.title, a.summary'},
    a.category, a.author, a.published_at, a.updated_at, a.source_name, a.source_url FROM articles a
    ${translated ? "JOIN article_translations t ON t.article_id = a.id AND t.lang = ? AND trim(t.title) <> '' AND trim(t.content) <> ''" : ''}
    WHERE ${publicArticleSql}${filter} ORDER BY julianday(a.published_at) DESC, a.id DESC LIMIT 50`,
    ...(translated ? [lang] : []), ...(filter.includes('category = ?') ? [category] : []))
  const articles = rows.filter(row => publicationDate(row.published_at))
  const articleUrl = (row: FeedRow) => `${base}${translated ? '/' + lang : ''}/news/${encodeURIComponent(row.category)}/article/${row.id}`
  const params = new URLSearchParams({ ...(lang !== 'ko' ? { lang } : {}), ...(category ? { cat: category } : {}) }).toString()
  const self = `${base}/${format === 'rss' ? 'rss' : 'atom'}.xml${params ? '?' + params : ''}`
  const updated = articles.map(row => publicationDate(row.updated_at) || publicationDate(row.published_at)!)
    .sort((a,b) => b.getTime() - a.getTime())[0]?.toISOString() || '1970-01-01T00:00:00.000Z'
  const e = escapeXml
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Content-Type', `application/${format === 'rss' ? 'rss' : 'atom'}+xml; charset=utf-8`)
  if (format === 'atom') return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">
    <id>${e(self)}</id><title>Check-in Daily</title><updated>${updated}</updated>
    <link href="${e(base)}"/><link rel="self" href="${e(self)}"/>
    ${articles.map(row => `<entry><id>${e(articleUrl(row))}</id><title>${e(row.title)}</title><link href="${e(articleUrl(row))}"/>
      <published>${publicationDate(row.published_at)!.toISOString()}</published>
      <updated>${(publicationDate(row.updated_at) || publicationDate(row.published_at))!.toISOString()}</updated>
      <author><name>${e(row.author || 'Check-in Daily')}</name></author><summary type="text">${e(row.summary || '')}</summary></entry>`).join('')}
    </feed>`
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
    <title>Check-in Daily</title><link>${e(base)}</link><description>Check-in Daily news feed</description><language>${lang}</language>
    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate><atom:link rel="self" type="application/rss+xml" href="${e(self)}"/>
    ${articles.map(row => `<item><title>${e(row.title)}</title><link>${e(articleUrl(row))}</link>
      <guid isPermaLink="true">${e(articleUrl(row))}</guid><pubDate>${publicationDate(row.published_at)!.toUTCString()}</pubDate>
      <dc:creator>${e(row.author || 'Check-in Daily')}</dc:creator><category>${e(row.category)}</category><description>${e(row.summary || '')}</description>
      ${/^https:\/\//.test(row.source_url) ? `<source url="${e(row.source_url)}">${e(row.source_name || 'Original source')}</source>` : ''}</item>`).join('')}
    </channel></rss>`
}
