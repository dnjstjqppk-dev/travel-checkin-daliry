import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')

  return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://travel-checkin-daily.dnjstjqppk.workers.dev/sitemap.xml
`
})

