export default defineNuxtConfig({
  srcDir: '.',
  compatibilityDate: '2025-02-01',
  devtools: { enabled: false },
  nitro: { preset: 'cloudflare_module' },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    apiInternalBase: process.env.NUXT_API_INTERNAL_BASE || process.env.API_INTERNAL_BASE || 'http://localhost:8080',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
    },
  },
  app: {
    head: {
      title: '체크인데일리 | Check-in Daily',
      meta: [{ name: 'description', content: '여행의 다음 장면을 먼저 읽는 여행 전문 미디어' }],
    },
  },
})