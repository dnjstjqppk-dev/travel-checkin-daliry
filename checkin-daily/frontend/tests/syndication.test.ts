import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cdata, escapeXml, isRecentPublication, publicationDate } from '../server/utils/syndication.ts'

test('XML text escapes reserved characters and removes invalid controls', () => {
  assert.equal(escapeXml('A&B <news> "x"\u0000'), 'A&amp;B &lt;news&gt; &quot;x&quot;')
})
test('CDATA terminators cannot inject feed nodes', () => {
  assert.equal(cdata('a]]><item>b'), '<![CDATA[a]]]]><![CDATA[><item>b]]>')
})
test('News sitemap excludes stale, future, missing and invalid dates', () => {
  const now = Date.parse('2026-10-31T12:00:00Z')
  assert.equal(isRecentPublication('2026-10-29T12:00:00Z', now), true)
  for (const value of [null, 'invalid', '2026-10-29T11:59:59Z', '2026-10-31T12:00:01Z']) {
    assert.equal(isRecentPublication(value, now), false)
  }
})
test('SQLite UTC timestamps retain their time zone', () => {
  assert.equal(publicationDate('2026-10-31 12:00:00')?.toISOString(), '2026-10-31T12:00:00.000Z')
})
