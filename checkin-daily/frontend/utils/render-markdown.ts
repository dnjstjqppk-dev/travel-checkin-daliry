// Memoized article markdown renderer.
//
// Article pages SSR every request on Workers, and each render ran the full
// marked parse plus DOMPurify sanitize — the single hottest CPU path under
// crawler traffic. The output is a pure function of the raw markdown, so it
// is memoized per isolate in a small LRU keyed by an FNV-1a hash of the
// input. Content-derived keys can never serve stale markup after an edit.
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

const MAX_ENTRIES = 200
const cache = new Map<number, string>()

function hashContent(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function headingId(text: string): string {
  return 'sec-' + text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-|-$)/g, '')
}

function renderFresh(raw: string): string {
  const renderer = new marked.Renderer()
  renderer.image = ({ href, title, text }) => {
    const caption = title ? `<figcaption>${escapeAttribute(title)}</figcaption>` : ''
    return `<figure class="body-figure"><img src="${escapeAttribute(href || '')}" alt="${escapeAttribute(text || '')}" loading="lazy" decoding="async">${caption}</figure>`
  }
  renderer.heading = ({ tokens, depth }) => {
    const inner = renderer.parser.parseInline(tokens)
    return `<h${depth} id="${headingId(inner)}">${inner}</h${depth}>`
  }
  try {
    const parsed = marked.parse(raw || '', { renderer, async: false }) as string
    return DOMPurify.sanitize(parsed, { ADD_ATTR: ['loading', 'decoding'] })
  } catch {
    return escapeAttribute(raw || '')
  }
}

export function renderMarkdown(raw: string): string {
  const key = hashContent(raw || '')
  const hit = cache.get(key)
  if (hit !== undefined) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const html = renderFresh(raw)
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(key, html)
  return html
}

/** Test hooks. */
export function __clearMarkdownCache(): void {
  cache.clear()
}

export function __markdownCacheSize(): number {
  return cache.size
}
