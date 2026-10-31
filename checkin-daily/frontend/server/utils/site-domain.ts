import { type H3Event } from 'h3'
import { d1First, getD1Database } from './d1'
import { siteConfig } from '../../config/site.config'

export async function resolveBaseUrl(event: H3Event): Promise<string> {
  const database = getD1Database(event)

  // 1. Check D1 site_settings
  if (database) {
    try {
      const row = await d1First<{ value: string }>(
        database,
        "SELECT value FROM site_settings WHERE key = 'site_url' OR key = 'site_domain' LIMIT 1",
      )
      if (row?.value) {
        const val = row.value.trim().replace(/\/+$/, '')
        if (val.startsWith('http://') || val.startsWith('https://')) {
          return val
        }
        if (val) {
          return `https://${val}`
        }
      }
    } catch {}
  }

  // Canonical origins come from operator configuration, never untrusted Host headers.

  // 3. Fallback to siteConfig or environment
  const envUrl = process.env.SITE_URL || process.env.NUXT_PUBLIC_SITE_URL
  if (envUrl) {
    return envUrl.trim().replace(/\/+$/, '')
  }

  return (siteConfig.domain || 'https://travel-checkin-daily.dnjstjqppk.workers.dev').replace(/\/+$/, '')
}

