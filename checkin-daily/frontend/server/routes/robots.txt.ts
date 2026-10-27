import { defineEventHandler, setResponseHeader } from 'h3'
import { resolveBaseUrl } from '../utils/site-domain'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')

  const baseUrl = await resolveBaseUrl(event)

  return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

# Specialized Search Engine Sitemaps
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/news-sitemap.xml
`
})
