import { defineEventHandler, setResponseHeader } from 'h3'
import { d1All, d1First, getD1Database } from '../utils/d1'

interface AdPlacementRow {
  id: string
  ad_client_id: string
  is_active: number
}

interface SettingRow {
  value: string
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')

  const database = getD1Database(event)
  const lines: string[] = [
    '# Check-in Daily (체크인데일리) Official ads.txt',
    '# IAB OpenRTB / Google Authorized Digital Sellers Specification',
    '# https://iabtechlab.com/ads-txt/',
    '',
  ]

  let customAdsTxt = ''
  if (database) {
    try {
      const setting = await d1First<SettingRow>(
        database,
        "SELECT value FROM site_settings WHERE key = 'ads_txt_content' LIMIT 1",
      )
      if (setting?.value) {
        customAdsTxt = setting.value.trim()
      }
    } catch {}
  }

  if (customAdsTxt) {
    lines.push(customAdsTxt)
  }

  // Also query active Google AdSense placements to ensure all active publisher accounts are declared
  if (database) {
    try {
      const placements = await d1All<AdPlacementRow>(
        database,
        "SELECT id, ad_client_id, is_active FROM ad_placements WHERE is_active = 1 AND ad_client_id LIKE 'ca-pub-%'",
      )
      const addedPubIds = new Set<string>()
      for (const p of placements) {
        const pubId = p.ad_client_id.replace(/^ca-/, '')
        if (!addedPubIds.has(pubId) && !customAdsTxt.includes(pubId)) {
          addedPubIds.add(pubId)
          lines.push(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0`)
        }
      }
    } catch {}
  }

  // Default fallback if nothing configured
  if (lines.length <= 4) {
    lines.push('google.com, pub-9201847192847192, DIRECT, f08c47fec0942fa0')
  }

  return lines.join('\n') + '\n'
})
