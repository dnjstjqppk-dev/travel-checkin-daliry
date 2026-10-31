// checkin-daily/frontend/server/utils/web-push.ts
// Standards-compliant Web Push Notification Engine (RFC 8292 VAPID) using native Web Crypto API

import type { D1DatabaseLike } from './d1'
import { d1All, d1First, d1Run } from './d1'

const DEFAULT_VAPID_PUBLIC_KEY = 'BJnEnAqEg0Wfj0Hf7wOmG0YPydrh_Tqtcgczl_JnSzFn9va1fneUMs_8QeuPHcgbKF2VtJImAup5BfA_D7umiv4'
const DEFAULT_VAPID_PRIVATE_KEY = 'MtDYmRVBC_29laCLW1_oqVFEGxIG1tn1D03B4eoAAZA'
const DEFAULT_VAPID_SUBJECT = 'mailto:admin@checkindaily.news'

export interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

export interface PushNotificationPayload {
  title: string
  body: string
  url: string
  icon?: string
}

export interface PushBroadcastResult {
  totalSubscribers: number
  sentCount: number
  failedCount: number
  expiredCount: number
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

function uint8ArrayToBase64Url(array: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i] ?? 0)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function getVapidConfig(database?: D1DatabaseLike, env?: Record<string, unknown>): Promise<VapidConfig> {
  const envPub = (env?.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY) as string | undefined
  const envPriv = (env?.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY) as string | undefined
  const envSub = (env?.VAPID_SUBJECT || process.env.VAPID_SUBJECT) as string | undefined

  if (envPub && envPriv) {
    return {
      publicKey: envPub,
      privateKey: envPriv,
      subject: envSub || DEFAULT_VAPID_SUBJECT,
    }
  }

  if (database) {
    try {
      const pubSetting = await d1First<{ value: string }>(database, `SELECT value FROM site_settings WHERE key = 'vapid_public_key'`)
      const privSetting = await d1First<{ value: string }>(database, `SELECT value FROM site_settings WHERE key = 'vapid_private_key'`)
      if (pubSetting?.value && privSetting?.value) {
        return {
          publicKey: pubSetting.value,
          privateKey: privSetting.value,
          subject: envSub || DEFAULT_VAPID_SUBJECT,
        }
      }
    } catch {}
  }

  return {
    publicKey: DEFAULT_VAPID_PUBLIC_KEY,
    privateKey: DEFAULT_VAPID_PRIVATE_KEY,
    subject: DEFAULT_VAPID_SUBJECT,
  }
}

async function createVapidJwt(audience: string, config: VapidConfig): Promise<string> {
  const rawPub = base64UrlToUint8Array(config.publicKey)
  const rawPriv = base64UrlToUint8Array(config.privateKey)

  // Uncompressed P-256 point is 65 bytes (0x04 + 32-byte X + 32-byte Y)
  const x = uint8ArrayToBase64Url(rawPub.subarray(1, 33))
  const y = uint8ArrayToBase64Url(rawPub.subarray(33, 65))
  const d = uint8ArrayToBase64Url(rawPriv)

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d,
    ext: true,
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const headerJson = JSON.stringify({ typ: 'JWT', alg: 'ES256' })
  const payloadJson = JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600, // 12 hours
    sub: config.subject,
  })

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(headerJson))
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(payloadJson))
  const unsignedToken = `${headerB64}.${payloadB64}`

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  )

  const signatureB64 = uint8ArrayToBase64Url(new Uint8Array(signature))
  return `${unsignedToken}.${signatureB64}`
}

export async function broadcastPushNotification(
  database: D1DatabaseLike,
  env: Record<string, unknown> | undefined,
  notification: PushNotificationPayload,
): Promise<PushBroadcastResult> {
  const config = await getVapidConfig(database, env)
  const subscriptions = await d1All<{ id: number; endpoint: string; p256dh_key: string; auth_key: string }>(
    database,
    'SELECT id, endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE is_active = 1',
  )

  let sentCount = 0
  let failedCount = 0
  let expiredCount = 0

  const expiredIds: number[] = []

  // Process in batches of 25 to respect concurrency limits
  const chunkSize = 25
  for (let i = 0; i < subscriptions.length; i += chunkSize) {
    const chunk = subscriptions.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (sub) => {
        try {
          const endpointUrl = new URL(sub.endpoint)
          const audience = `${endpointUrl.protocol}//${endpointUrl.host}`
          const jwt = await createVapidJwt(audience, config)

          const res = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'TTL': '86400',
              'Urgency': 'high',
              'Authorization': `vapid t=${jwt}, k=${config.publicKey}`,
            },
          })

          if (res.status === 404 || res.status === 410) {
            // Subscription has expired or unsubscribed
            expiredCount++
            failedCount++
            expiredIds.push(sub.id)
          } else if (res.ok || res.status === 201 || res.status === 202) {
            sentCount++
          } else {
            failedCount++
          }
        } catch {
          failedCount++
        }
      }),
    )
  }

  // Deactivate expired subscriptions
  if (expiredIds.length > 0) {
    for (const id of expiredIds) {
      try {
        await d1Run(database, "UPDATE push_subscriptions SET is_active = 0, updated_at = datetime('now') WHERE id = ?", id)
      } catch {}
    }
  }

  // Record broadcast log in D1
  try {
    await d1Run(
      database,
      `INSERT INTO push_notification_logs (title, body, target_url, sent_count, failed_count, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      notification.title,
      notification.body,
      notification.url,
      sentCount,
      failedCount,
    )
  } catch (err) {
    console.error('Failed to log push notification to D1:', err)
  }

  return {
    totalSubscribers: subscriptions.length,
    sentCount,
    failedCount,
    expiredCount,
  }
}

export async function broadcastBreakingNewsPush(
  database: D1DatabaseLike,
  env: Record<string, unknown> | undefined,
  article: { id: number; title: string; summary?: string; category?: string },
): Promise<PushBroadcastResult> {
  const cat = article.category || 'major'
  return broadcastPushNotification(database, env, {
    title: `[속보] ${article.title}`,
    body: article.summary || '체크인데일리 데스크의 실시간 검증 속보를 확인하세요.',
    url: `/news/${cat}/article/${article.id}`,
  })
}
