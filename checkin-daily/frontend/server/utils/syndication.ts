/** XML 1.0 text, including removal of characters XML cannot represent. */
export function escapeXml(value: string): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function cdata(value: string): string {
  return `<![CDATA[${String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`
}

export function publicationDate(value: string | null): Date | null {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T') + 'Z' : value
  const date = new Date(normalized)
  return Number.isFinite(date.getTime()) ? date : null
}

export function isRecentPublication(value: string | null, now = Date.now()): boolean {
  const date = publicationDate(value)
  return date !== null && date.getTime() <= now && date.getTime() >= now - 48 * 60 * 60 * 1000
}
