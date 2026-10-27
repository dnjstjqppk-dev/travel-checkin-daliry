import { defineEventHandler, setResponseHeader } from 'h3'
import { resolveBaseUrl } from '../utils/site-domain'

const SUPPORTED_LANGS = [
  { prefix: '', hreflang: 'ko' },
  { prefix: '/en', hreflang: 'en' },
  { prefix: '/zh', hreflang: 'zh-Hans' },
  { prefix: '/th', hreflang: 'th' },
  { prefix: '/vi', hreflang: 'vi' },
  { prefix: '/es', hreflang: 'es' },
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

  const baseUrl = await resolveBaseUrl(event)
  const todayStr = new Date().toISOString().split('T')[0]

  const paths = [
    { path: '/news', priority: '1.0', changefreq: 'hourly' },
    { path: '/news/major', priority: '0.9', changefreq: 'daily' },
    { path: '/news/airline', priority: '0.9', changefreq: 'daily' },
    { path: '/news/hotel', priority: '0.9', changefreq: 'daily' },
    { path: '/news/destination', priority: '0.9', changefreq: 'daily' },
    { path: '/news/realtime', priority: '0.8', changefreq: 'hourly' },
    { path: '/news/region', priority: '0.8', changefreq: 'daily' },
    { path: '/about', priority: '0.5', changefreq: 'monthly' },
    { path: '/policy', priority: '0.5', changefreq: 'monthly' },
    { path: '/corrections', priority: '0.6', changefreq: 'weekly' },
    { path: '/contact', priority: '0.5', changefreq: 'monthly' },
  ]

  const urlNodes = paths.map((p) => {
    return SUPPORTED_LANGS.map(({ prefix, hreflang }) => {
      const loc = `${baseUrl}${prefix}${p.path}`
      const priority = prefix === '' ? p.priority : (parseFloat(p.priority) - 0.1).toFixed(1)

      const alternates = SUPPORTED_LANGS.map((alt) => {
        return `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${baseUrl}${alt.prefix}${p.path}" />`
      }).join('\n')

      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${p.path}" />`

      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}
${xDefault}
  </url>`
    }).join('\n')
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlNodes}
</urlset>`
})

