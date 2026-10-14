import { createError, defineEventHandler, getRequestURL, proxyRequest } from 'h3'
import { handleD1Api } from '../utils/d1-api'
import { getD1Database } from '../utils/d1'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (database) return handleD1Api(event, database)

  if (import.meta.dev) {
    const config = useRuntimeConfig(event)
    const upstream = process.env.NUXT_API_INTERNAL_BASE
      || process.env.API_INTERNAL_BASE
      || config.apiInternalBase
      || 'http://localhost:8080'
    const url = getRequestURL(event)
    return proxyRequest(event, `${upstream}${url.pathname}${url.search}`)
  }

  throw createError({
    statusCode: 503,
    statusMessage: 'Cloudflare D1 binding is not configured',
  })
})