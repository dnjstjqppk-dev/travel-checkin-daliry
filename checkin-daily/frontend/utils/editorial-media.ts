// Category stock photography used when an article has no rights-cleared original
// media. Images are Unsplash-licensed (free for commercial use) and are always
// captioned as file photos, never as on-site reporting.

const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`

export const EDITORIAL_IMAGE_POOL: Record<string, string[]> = {
  airline: [
    unsplash('photo-1436491865332-7a61a109cc05'),
    unsplash('photo-1542296332-2e4473faf563'),
    unsplash('photo-1520607162513-77705c0f0d4a'),
    unsplash('photo-1488646953014-85cb44e25828'),
    unsplash('photo-1508009603885-50cf7c579365'),
  ],
  hotel: [
    unsplash('photo-1566073771259-6a8506099945'),
    unsplash('photo-1582719508461-905c673771fd'),
    unsplash('photo-1540541338287-41700207dee6'),
    unsplash('photo-1571896349842-33c89424de2d'),
    unsplash('photo-1520250497591-112f2f40a3f4'),
  ],
  destination: [
    unsplash('photo-1528181304800-259b08848526'),
    unsplash('photo-1493976040374-85c8e12f0c0e'),
    unsplash('photo-1506744038136-46273834b3fb'),
    unsplash('photo-1533105079780-92b9be482077'),
    unsplash('photo-1508009603885-50cf7c579365'),
  ],
  major: [
    unsplash('photo-1488646953014-85cb44e25828'),
    unsplash('photo-1486406146926-c627a92ad1ab'),
    unsplash('photo-1469854523086-cc02fe5d8800'),
    unsplash('photo-1503220317375-aaad61436b1b'),
    unsplash('photo-1473496169904-658ba7c44d8a'),
  ],
  realtime: [
    unsplash('photo-1517840901100-8179e982acb7'),
    unsplash('photo-1526778548025-fa2f459cd5c1'),
    unsplash('photo-1507525428034-b723cf961d3e'),
    unsplash('photo-1518684079-3c830dcef090'),
    unsplash('photo-1544620347-c4fd4a3d5957'),
  ],
}

/** Local, always-available fallback used by <img @error> handlers. */
export const FALLBACK_COVER_IMAGE = '/images/og-default.svg'

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Deterministic cover + body images for a category so re-renders stay stable. */
export function pickEditorialImages(category: string, seed: string, bodyCount = 4): { cover: string; body: string[] } {
  const pool = EDITORIAL_IMAGE_POOL[category] ?? EDITORIAL_IMAGE_POOL.major!
  const start = hashSeed(seed) % pool.length
  const ordered = pool.map((_, i) => pool[(start + i) % pool.length]!)
  return { cover: ordered[0]!, body: ordered.slice(1, 1 + bodyCount) }
}

export function categoryCoverImage(category: string): string {
  return (EDITORIAL_IMAGE_POOL[category] ?? EDITORIAL_IMAGE_POOL.major!)[0]!
}
