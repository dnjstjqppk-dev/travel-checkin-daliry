import { proxyRequest } from 'h3'

export default defineEventHandler((event) => {
  const upstream = process.env.NUXT_API_INTERNAL_BASE || process.env.API_INTERNAL_BASE || 'http://localhost:8080'
  return proxyRequest(event, `${upstream}${event.path}`)
})