import { createError, getQuery, type H3Event } from 'h3'
import { d1All, d1First, type D1Database } from './d1'
import { escapeXml, publicationDate } from './syndication'
export const articleShardSize = 2000
export const publicArticleSql = "a.status = 'published' AND a.retracted_at IS NULL AND a.review_status IN ('approved', 'published') AND julianday(a.published_at) <= julianday('now')"
export function sitemapPage(event: H3Event): number {
  const value = getQuery(event).page ?? '1'
  if (typeof value !== 'string' || !/^[1-9]\d{0,6}$/.test(value)) throw createError({ statusCode: 400, statusMessage: 'Invalid sitemap page' })
  return Number(value)
}
export async function articleCount(database: D1Database): Promise<number> {
  return (await d1First<{ n: number }>(database, `SELECT COUNT(*) n FROM articles a WHERE ${publicArticleSql}`))?.n ?? 0
}
export interface SitemapRow { id: number; category: string; published_at: string; updated_at: string; languages: string | null }
const languages: Record<string, string> = { en: 'en', zh: 'zh-Hans', th: 'th', vi: 'vi', es: 'es' }
export async function articleSitemap(database: D1Database, base: string, page: number): Promise<string> {
  const count = await articleCount(database)
  if (page > Math.max(1, Math.ceil(count / articleShardSize))) throw createError({ statusCode: 404, statusMessage: 'Sitemap page not found' })
  const rows = await d1All<SitemapRow>(database, `SELECT a.id, a.category, a.published_at, a.updated_at,
    (SELECT group_concat(t.lang) FROM article_translations t WHERE t.article_id = a.id
      AND trim(t.title) <> '' AND trim(t.content) <> '') AS languages
    FROM articles a WHERE ${publicArticleSql} ORDER BY a.id LIMIT ? OFFSET ?`, articleShardSize, (page - 1) * articleShardSize)
  const nodes = rows.map(row => {
    const variants = [{ prefix: '', lang: 'ko' }, ...(row.languages || '').split(',')
      .filter(lang => languages[lang]).map(lang => ({ prefix: `/${lang}`, lang: languages[lang]! }))]
    const url = (prefix: string) => `${base}${prefix}/news/${encodeURIComponent(row.category)}/article/${row.id}`
    const lastmod = publicationDate(row.updated_at) || publicationDate(row.published_at)
    const alternates = variants.map(v => `<xhtml:link rel="alternate" hreflang="${v.lang}" href="${escapeXml(url(v.prefix))}" />`).join('')
    return variants.map(v => `<url><loc>${escapeXml(url(v.prefix))}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}${alternates}<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(url(''))}" /></url>`).join('\n')
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${nodes}</urlset>`
}
