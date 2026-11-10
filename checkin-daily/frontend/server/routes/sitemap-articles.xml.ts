import { createError, defineEventHandler, setResponseHeader } from 'h3'
import { getD1Database } from '../utils/d1'
import { cachedPublic } from '../utils/response-cache'
import { resolveBaseUrl } from '../utils/site-domain'
import { articleSitemap, sitemapPage } from '../utils/sitemap-data'
export default defineEventHandler(async event => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600')
  return cachedPublic(event, { ttlMs: 1_800_000, swrMs: 3_600_000 }, async () =>
    articleSitemap(database, await resolveBaseUrl(event), sitemapPage(event)))
})
