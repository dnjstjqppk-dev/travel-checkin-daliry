import { defineEventHandler, getRequestHeader, getRequestURL, setResponseHeader } from 'h3'
import { siteConfig } from '../../config/site.config'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')

  const reqUrl = getRequestURL(event)
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || reqUrl.host
  const protocol = getRequestHeader(event, 'x-forwarded-proto') || reqUrl.protocol.replace(':', '') || 'https'
  const baseUrl = host ? `${protocol}://${host}` : (siteConfig.domain || 'https://travel-checkin-daily.dnjstjqppk.workers.dev')

  return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`
})

