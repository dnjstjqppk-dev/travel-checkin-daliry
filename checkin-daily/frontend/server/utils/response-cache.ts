// In-Worker response cache for public GETs.
//
// Cloudflare does not cache Worker HTML/JSON responses by default (no Cache
// Rule), so every crawler hit re-ran the full handler: D1 round-trips plus
// response building. This tiny per-isolate LRU absorbs those repeats with a
// TTL + stale-while-revalidate window. Rules:
//
// - GET only, never /api/admin/*, never nullish bodies (404-style misses stay
//   fresh so scheduled publishes appear immediately), never thrown errors.
// - Revalidation runs via event.waitUntil when available (production Workers);
//   runtimes without it (tests, CLI) revalidate inline for determinism.
// - Cached bodies are returned by reference and must be treated as immutable.
import { getRequestURL, type H3Event } from 'h3'

interface CacheEntry {
  body: unknown
  storedAt: number
  revalidating: Promise<unknown> | null
}

const store = new Map<string, CacheEntry>()
const MAX_ENTRIES = 500

export interface PublicCacheOptions {
  /** Fresh window in ms. */
  ttlMs: number
  /** Extra window in ms after ttlMs where stale is served while revalidating. */
  swrMs: number
  /** Cache key override. Defaults to `GET <pathname><search>`. */
  key?: string
}

/** Test hook: drops every cached entry. */
export function __clearResponseCache(): void {
  store.clear()
}

/** Test hook: current entry count. */
export function __responseCacheSize(): number {
  return store.size
}

function waitUntilOf(event: H3Event): ((promise: Promise<unknown>) => void) | undefined {
  const candidate = (event as unknown as { waitUntil?: unknown }).waitUntil
  return typeof candidate === 'function' ? candidate as (promise: Promise<unknown>) => void : undefined
}

function touch(key: string, entry: CacheEntry): void {
  store.delete(key)
  store.set(key, entry)
}

function remember(key: string, body: unknown): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next()
    if (!oldest.done) store.delete(oldest.value)
  }
  store.set(key, { body, storedAt: Date.now(), revalidating: null })
}

export async function cachedPublic<T>(event: H3Event, options: PublicCacheOptions, loader: () => Promise<T>): Promise<T> {
  const url = getRequestURL(event)
  if (event.method !== 'GET' || url.pathname.startsWith('/api/admin/')) return loader()

  const key = options.key ?? `GET ${url.pathname}${url.search}`
  const entry = store.get(key)
  if (entry) {
    const age = Date.now() - entry.storedAt
    if (age < options.ttlMs) {
      touch(key, entry)
      return entry.body as T
    }
    if (age < options.ttlMs + options.swrMs) {
      const waitUntil = waitUntilOf(event)
      if (waitUntil) {
        if (!entry.revalidating) {
          const refresh = loader().then(
            (fresh) => {
              if (fresh !== null && fresh !== undefined) remember(key, fresh)
              else store.delete(key)
            },
            () => {},
          ).finally(() => {
            const current = store.get(key)
            if (current) current.revalidating = null
          })
          entry.revalidating = refresh
          touch(key, entry)
          waitUntil(refresh)
        }
        return entry.body as T
      }
      const fresh = await loader()
      if (fresh === null || fresh === undefined) {
        store.delete(key)
        return fresh
      }
      remember(key, fresh)
      return fresh
    }
    store.delete(key)
  }

  const fresh = await loader()
  if (fresh === null || fresh === undefined) return fresh
  remember(key, fresh)
  return fresh
}
