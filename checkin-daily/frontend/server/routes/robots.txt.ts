import { defineEventHandler, setResponseHeader } from 'h3'
import { resolveBaseUrl } from '../utils/site-domain'

const CRAWLERS = ['Googlebot', 'Googlebot-News', 'Googlebot-Image', 'Yeti', 'Bingbot', 'DuckDuckBot', '*']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

  const baseUrl = await resolveBaseUrl(event)
  const groups = CRAWLERS.map(agent => `User-agent: ${agent}\nAllow: /\nDisallow: /admin/\nDisallow: /api/`).join('\n\n')

  return `${groups}

Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/news-sitemap.xml
`
})
