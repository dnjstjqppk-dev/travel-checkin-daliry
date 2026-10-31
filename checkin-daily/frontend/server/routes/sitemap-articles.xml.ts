import { createError, defineEventHandler, setResponseHeader } from 'h3'
import { getD1Database } from '../utils/d1'
import { resolveBaseUrl } from '../utils/site-domain'
import { articleSitemap, sitemapPage } from '../utils/sitemap-data'
export default defineEventHandler(async event => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const xml = await articleSitemap(database, await resolveBaseUrl(event), sitemapPage(event))
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  return xml
})
