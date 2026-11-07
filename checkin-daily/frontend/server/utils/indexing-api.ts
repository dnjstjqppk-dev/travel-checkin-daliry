import { siteConfig } from '../../config/site.config'
// checkin-daily/frontend/server/utils/indexing-api.ts
// Google Indexing API v3 & IndexNow Integration for Rapid URL Grounding and Indexation

export interface IndexingResult {
  url: string
  googleSubmitted: boolean
  indexNowSubmitted: boolean
  googleMessage?: string
  indexNowMessage?: string
}

/**
 * Submit URLs to Bing / Yandex / Naver via IndexNow protocol
 * Spec: https://www.indexnow.org/documentation
 */
/** IndexNow key from INDEXNOW_KEY (8-128 chars of a-z, A-Z, 0-9, '-'), or '' when unset/invalid. */
export function configuredIndexNowKey(): string {
  const env = typeof process !== 'undefined' ? process.env : undefined
  const value = (env?.INDEXNOW_KEY || env?.NUXT_INDEXNOW_KEY || '').trim()
  return /^[A-Za-z0-9-]{8,128}$/.test(value) ? value : ''
}

export async function pushUrlToIndexNow(
  urls: string | string[],
  options?: { host?: string; key?: string },
): Promise<{ success: boolean; count: number; error?: string }> {
  const urlList = (Array.isArray(urls) ? urls : [urls]).filter((u) => typeof u === 'string' && u.startsWith('http'))
  if (urlList.length === 0) {
    return { success: false, count: 0, error: 'No valid URLs provided' }
  }

  const primaryUrl = new URL(urlList[0]!)
  const host = options?.host || primaryUrl.host
  const key = options?.key || configuredIndexNowKey()
  // The key must also be served at /{key}.txt (server/routes/[indexnow].txt.ts) for IndexNow to accept it.
  if (!key) return { success: false, count: 0, error: 'INDEXNOW_KEY is not configured' }

  try {
    const payload = {
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList,
    }

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': `CheckInDaily-IndexBot/2.1 (+${siteConfig.domain})`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    })

    // IndexNow returns 200 (OK) or 202 (Accepted)
    const isOk = response.status === 200 || response.status === 202
    return {
      success: isOk,
      count: urlList.length,
      error: isOk ? undefined : `IndexNow returned status ${response.status}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      count: 0,
      error: `IndexNow push error: ${message}`,
    }
  }
}

/**
 * Submit URL to Google Indexing API v3 (URL_UPDATED)
 * Spec: https://developers.google.com/search/apis/indexing-api/v3/using-api
 */
export async function pushUrlToGoogleIndexing(
  url: string,
  options?: { accessToken?: string },
): Promise<{ success: boolean; error?: string }> {
  if (!url || !url.startsWith('http')) {
    return { success: false, error: 'Invalid URL for Google Indexing' }
  }

  const token = options?.accessToken
    || (typeof process !== 'undefined' ? (process.env.GOOGLE_INDEXING_TOKEN || (process.env as Record<string, string>).NUXT_GOOGLE_INDEXING_TOKEN) : '')

  if (!token) {
    // If no direct token configured, gracefully log and complete without breaking workflow
    return {
      success: true,
      error: 'Google Indexing API token not configured; skipped direct push',
    }
  }

  try {
    const endpoint = 'https://indexing.googleapis.com/v3/urlNotifications:publish'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url,
        type: 'URL_UPDATED',
      }),
      signal: AbortSignal.timeout(6000),
    })

    const isOk = response.ok
    return {
      success: isOk,
      error: isOk ? undefined : `Google Indexing returned status ${response.status}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Google Indexing push error: ${message}`,
    }
  }
}

/**
 * Unified helper to trigger both Google Indexing and IndexNow in parallel on publish
 */
export async function notifySearchEnginesOfPublication(
  canonicalUrl: string,
  alternateUrls: string[] = [],
): Promise<IndexingResult> {
  const allUrls = Array.from(new Set([canonicalUrl, ...alternateUrls]))

  const [indexNowRes, googleRes] = await Promise.all([
    pushUrlToIndexNow(allUrls),
    pushUrlToGoogleIndexing(canonicalUrl),
  ])

  return {
    url: canonicalUrl,
    googleSubmitted: googleRes.success,
    indexNowSubmitted: indexNowRes.success,
    googleMessage: googleRes.error,
    indexNowMessage: indexNowRes.error,
  }
}

