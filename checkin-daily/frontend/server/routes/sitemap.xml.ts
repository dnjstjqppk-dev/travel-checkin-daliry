import { createError, defineEventHandler, setResponseHeader } from 'h3'
import { resolveBaseUrl } from '../utils/site-domain'
import { d1First, getD1Database } from '../utils/d1'
import { articleCount, articleShardSize, publicArticleSql } from '../utils/sitemap-data'
import { escapeXml } from '../utils/syndication'
export default defineEventHandler(async event => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const base = await resolveBaseUrl(event)
  const count = await articleCount(database)
  const news = await d1First<{ n: number }>(database, `SELECT COUNT(*) n FROM articles a WHERE ${publicArticleSql}
    AND julianday(a.published_at) >= julianday('now', '-48 hours')`)
  const paths = ['/sitemap-main.xml', ...Array.from({ length: Math.max(1, Math.ceil(count / articleShardSize)) },
    (_, i) => '/sitemap-articles.xml' + (i ? '?page=' + (i + 1) : '')),
    ...Array.from({ length: Math.max(1, Math.ceil((news?.n ?? 0) / 1000)) },
      (_, i) => '/news-sitemap.xml' + (i ? '?page=' + (i + 1) : ''))]
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  return '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + paths.map(path => '<sitemap><loc>' + escapeXml(base + path) + '</loc></sitemap>').join('') + '</sitemapindex>'
})
