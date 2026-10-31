// checkin-daily/frontend/server/utils/r2-storage.ts
// Cloudflare R2 Image Mirroring & Media Asset Storage Utility

import type { H3Event } from 'h3'
import { getWorkerEnvironment } from './d1'
import { assertSafeExternalUrl } from './ssrf-guard'

export interface R2MirrorResult {
  url: string
  isMirrored: boolean
  key?: string
  contentType?: string
  sizeBytes?: number
}

/**
 * Mirror an external editorial image into Cloudflare R2 bucket
 * Gracefully falls back to original external URL if R2 binding is not available
 */
export async function mirrorImageToR2(
  imageUrl: string,
  keyPrefix = 'media',
  event?: H3Event,
): Promise<R2MirrorResult> {
  if (!imageUrl || !imageUrl.startsWith('http')) {
    return { url: imageUrl, isMirrored: false }
  }

  // 1. Check for R2 binding in Cloudflare Workers environment
  const env = (event ? getWorkerEnvironment(event) : (typeof process !== 'undefined' ? (process.env as Record<string, unknown>) : {})) as Record<string, unknown> | undefined
  const r2Bucket = (env?.IMAGES_BUCKET || env?.R2_IMAGES || (globalThis as Record<string, unknown>).IMAGES_BUCKET) as {
    put: (key: string, body: Uint8Array | ArrayBuffer | ReadableStream, options?: Record<string, unknown>) => Promise<unknown>
  } | undefined

  if (!r2Bucket || typeof r2Bucket.put !== 'function') {
    // R2 not configured in this runtime; return original CDN URL
    return { url: imageUrl, isMirrored: false }
  }

  try {
    // 2. Validate URL safety (prevent SSRF)
    assertSafeExternalUrl(imageUrl)

    // 3. Fetch image stream with timeout
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'CheckInDaily-MediaBot/2.0 (+https://checkindaily.com)',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return { url: imageUrl, isMirrored: false }
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'

    const arrayBuffer = await res.arrayBuffer()
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
      // Exceeds 10MB limit
      return { url: imageUrl, isMirrored: false }
    }

    // 4. Compute SHA-256 hash for deduplication
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24)

    const key = `${keyPrefix}/${hashHex}.${ext}`

    await r2Bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    })

    const r2PublicDomain = (env?.R2_PUBLIC_DOMAIN as string) || 'https://media.checkindaily.com'
    const mirroredUrl = `${r2PublicDomain.replace(/\/+$/, '')}/${key}`

    return {
      url: mirroredUrl,
      isMirrored: true,
      key,
      contentType,
      sizeBytes: arrayBuffer.byteLength,
    }
  } catch {
    // On any failure, gracefully preserve original external URL
    return { url: imageUrl, isMirrored: false }
  }
}
