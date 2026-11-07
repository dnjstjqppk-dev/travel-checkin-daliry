import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { useNuxt } from '@nuxt/kit'
const configRequire = createRequire(import.meta.url)
const routerTypePlugin = configRequire.resolve('vue-router/volar/sfc-route-blocks', {
  paths: [dirname(configRequire.resolve('nuxt/package.json'))],
})

export default defineNuxtConfig({
  hooks: {
    'modules:done'() {
      useNuxt().hook('prepare:types', ({ tsConfig }) => {
        const options = (tsConfig.vueCompilerOptions ||= {}) as { plugins?: string[] }
        options.plugins = (options.plugins || []).map(plugin => plugin === 'vue-router/volar/sfc-route-blocks' ? routerTypePlugin : plugin)
      })
    },
  },
  srcDir: '.',
  compatibilityDate: '2025-02-01',
  devtools: { enabled: false },
  nitro: { externals: { inline: ['nuxt'] }, preset: process.env.NITRO_PRESET || (process.env.BUILD_TARGET === 'node' ? 'node-server' : 'cloudflare_module') },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; img-src 'self' data: https: blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      },
    },
    // SSR pages: let browsers revalidate and the edge serve briefly stale HTML while refreshing.
    '/news/**': { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' } },
    '/admin/**': { headers: { 'Cache-Control': 'no-store' } },
    '/sitemap*.xml': { headers: { 'Cache-Control': 'no-cache' } },
    '/news-sitemap.xml': { headers: { 'Cache-Control': 'no-cache' } },
    '/rss.xml': { headers: { 'Cache-Control': 'no-cache' } },
    '/ads.txt': { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } },
  },
  runtimeConfig: {
    apiInternalBase: process.env.NUXT_API_INTERNAL_BASE || process.env.API_INTERNAL_BASE || 'http://localhost:8080',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://travel-checkin-daily.dnjstjqppk.workers.dev',
    },
  },
  app: {
    head: {
      title: '체크인데일리 | Check-in Daily — The World’s Window on Travel Journalism',
      htmlAttrs: { lang: 'ko' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover' },
        { name: 'description', content: '글로벌 항공, 호텔, 여행지 트렌드를 심층 취재하고 데이터 기반으로 보도하는 독립 여행 저널리즘 미디어' },
        { name: 'theme-color', content: '#ffffff' },
        { property: 'og:site_name', content: 'Check-in Daily' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: '' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },
})
