import { type H3Event } from 'h3'
import { d1First, getD1Database, getWorkerEnvironment } from './d1'
import { DEFAULT_SITE_URL, configuredSiteUrl } from '../../config/site.config'

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * Canonical origin priority:
 *   1. SITE_URL / NUXT_PUBLIC_SITE_URL (Worker vars or process env) — set this when binding a custom domain
 *   2. site_settings.site_url saved from the admin console
 *   3. DEFAULT_SITE_URL
 * Request Host headers are never trusted for canonical URLs.
 */
export async function resolveBaseUrl(event: H3Event): Promise<string> {
  const env = getWorkerEnvironment(event) as Record<string, unknown> | undefined
  const fromEnv = [env?.SITE_URL, env?.NUXT_PUBLIC_SITE_URL].find(value => typeof value === 'string' && value.trim()) as string | undefined
  if (fromEnv) return normalizeOrigin(fromEnv)
  const configured = configuredSiteUrl()
  if (configured !== DEFAULT_SITE_URL) return configured

  const database = getD1Database(event)
  if (database) {
    try {
      const row = await d1First<{ value: string }>(database,
        "SELECT value FROM site_settings WHERE key = 'site_url' AND trim(value) <> '' LIMIT 1")
      if (row?.value) return normalizeOrigin(row.value)
    } catch {
      // settings table unavailable — fall through to the default origin
    }
  }
  return DEFAULT_SITE_URL
}
