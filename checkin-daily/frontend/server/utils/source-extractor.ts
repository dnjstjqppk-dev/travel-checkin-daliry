// Fetches a source article page under SSRF protection and extracts readable text
// so the AI writer works from the original reporting rather than a bare headline.
import { assertSafeExternalUrl } from './ssrf-guard'

export interface SourceContext {
  text: string
  siteName: string
  description: string
  ogImage: string
  finalUrl: string
}

const MAX_BYTES = 1_500_000
const MAX_REDIRECTS = 3
// Aggregator redirect pages contain no article body; their feed summary is used instead.
const NON_ARTICLE_HOSTS = ['news.google.com']

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
}

export function htmlToText(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function metaContent(html: string, key: string): string {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i')
  const tag = pattern.exec(html)?.[0] || ''
  return decodeEntities(/content=["']([^"']*)["']/i.exec(tag)?.[1] || '').trim()
}

export function extractArticleText(html: string): Omit<SourceContext, 'finalUrl'> {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(nav|footer|header|aside|form)\b[\s\S]*?<\/\1>/gi, ' ')
  const scope = /<article\b[\s\S]*?<\/article>/i.exec(cleaned)?.[0] || cleaned
  const paragraphs: string[] = []
  const seen = new Set<string>()
  for (const match of scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const paragraph = htmlToText(match[1] || '')
    if (paragraph.length < 40 || seen.has(paragraph)) continue
    if (/cookie|subscribe|newsletter|all rights reserved|javascript/i.test(paragraph) && paragraph.length < 160) continue
    seen.add(paragraph)
    paragraphs.push(paragraph)
    if (paragraphs.join('\n').length > 7000) break
  }
  return {
    text: paragraphs.join('\n').slice(0, 7000),
    siteName: metaContent(html, 'og:site_name'),
    description: metaContent(html, 'og:description') || metaContent(html, 'description'),
    ogImage: metaContent(html, 'og:image'),
  }
}

export async function fetchSourceContext(url: string, fetchImpl: typeof fetch = fetch): Promise<SourceContext | null> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = assertSafeExternalUrl(current)
    if (NON_ARTICLE_HOSTS.includes(parsed.hostname)) return null
    const response = await fetchImpl(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsroomBot/2.1)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return null
      current = new URL(location, parsed).toString()
      continue
    }
    if (!response.ok) return null
    if (!/text\/html|application\/xhtml/i.test(response.headers.get('content-type') || '')) return null
    const reader = response.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        chunks.push(value)
        if (size > MAX_BYTES) break
      }
    } finally {
      await reader.cancel().catch(() => {})
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return { ...extractArticleText(new TextDecoder().decode(bytes)), finalUrl: parsed.toString() }
  }
  return null
}
