// checkin-daily/frontend/server/utils/feed-parser.ts
// Robust RSS 2.0 / Atom Feed Parser for Cloudflare Workers Environment

export interface ParsedFeedItem {
  guid: string
  title: string
  link: string
  pubDate: string
  summary: string
  category: string
  contentHash: string
}

function cleanCdataAndXml(text: string): string {
  if (!text) return ''
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function computeContentHash(title: string, link: string): Promise<string> {
  const norm = `${title.toLowerCase().trim()}|${link.toLowerCase().trim()}`
  const msgUint8 = new TextEncoder().encode(norm)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function parseRssOrAtomXml(xmlText: string): Promise<ParsedFeedItem[]> {
  const items: ParsedFeedItem[] = []

  // Check if Atom (<entry>) or RSS (<item>)
  const isAtom = /<feed\b[^>]*>/i.test(xmlText) && /<entry\b[^>]*>/i.test(xmlText)

  if (isAtom) {
    const entryRegex = /<entry\b[^>]*>(.*?)<\/entry>/gis
    let match: RegExpExecArray | null
    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entryXml = match[1] || ''
      const titleMatch = /<title\b[^>]*>(.*?)<\/title>/is.exec(entryXml)
      const linkMatch = /<link\b[^>]*href=["']([^"']+)["']/is.exec(entryXml)
      const idMatch = /<id\b[^>]*>(.*?)<\/id>/is.exec(entryXml)
      const updatedMatch = /<(?:updated|published)\b[^>]*>(.*?)<\/(?:updated|published)>/is.exec(entryXml)
      const summaryMatch = /<(?:summary|content)\b[^>]*>(.*?)<\/(?:summary|content)>/is.exec(entryXml)
      const categoryMatch = /<category\b[^>]*term=["']([^"']+)["']/is.exec(entryXml)

      const title = cleanCdataAndXml(titleMatch?.[1] || '')
      const link = linkMatch?.[1] || ''
      const guid = cleanCdataAndXml(idMatch?.[1] || link || title)
      const pubDate = cleanCdataAndXml(updatedMatch?.[1] || new Date().toISOString())
      const summary = cleanCdataAndXml(summaryMatch?.[1] || title).slice(0, 500)
      const category = cleanCdataAndXml(categoryMatch?.[1] || 'destination')

      if (title && link) {
        const contentHash = await computeContentHash(title, link)
        items.push({ guid, title, link, pubDate, summary, category, contentHash })
      }
    }
  } else {
    // Standard RSS 2.0 (<item>)
    const itemRegex = /<item\b[^>]*>(.*?)<\/item>/gis
    let match: RegExpExecArray | null
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1] || ''
      const titleMatch = /<title\b[^>]*>(.*?)<\/title>/is.exec(itemXml)
      const linkMatch = /<link\b[^>]*>(.*?)<\/link>/is.exec(itemXml)
      const guidMatch = /<guid\b[^>]*>(.*?)<\/guid>/is.exec(itemXml)
      const pubDateMatch = /<pubDate\b[^>]*>(.*?)<\/pubDate>/is.exec(itemXml)
      const descMatch = /<description\b[^>]*>(.*?)<\/description>/is.exec(itemXml)
      const categoryMatch = /<category\b[^>]*>(.*?)<\/category>/is.exec(itemXml)

      const title = cleanCdataAndXml(titleMatch?.[1] || '')
      const link = cleanCdataAndXml(linkMatch?.[1] || '')
      const guid = cleanCdataAndXml(guidMatch?.[1] || link || title)
      const pubDate = cleanCdataAndXml(pubDateMatch?.[1] || new Date().toISOString())
      const summary = cleanCdataAndXml(descMatch?.[1] || title).slice(0, 500)
      const category = cleanCdataAndXml(categoryMatch?.[1] || 'major')

      if (title && link) {
        const contentHash = await computeContentHash(title, link)
        items.push({ guid, title, link, pubDate, summary, category, contentHash })
      }
    }
  }

  return items
}

