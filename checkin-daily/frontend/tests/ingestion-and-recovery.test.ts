import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testDatabase } from './sqlite-d1'
import { executeCronTasks } from '../server/utils/cron-runner'
import { assertSafeExternalUrl } from '../server/utils/ssrf-guard'

test('ingestion creates a source-linked draft without invented body, city or translations and deduplicates retries', async () => {
  const { database, sqlite } = testDatabase()
  sqlite.exec("UPDATE news_sources SET is_active = 0; UPDATE automation_policies SET value = '1' WHERE key = 'auto_publish_enabled'")
  sqlite.prepare(`INSERT INTO news_sources (id, name, source_type, endpoint_url, license_info, is_active, fetch_interval_minutes)
    VALUES ('test-source', 'Fixture publisher', 'rss', 'https://example.org/feed.xml', 'Review only', 1, 1)`).run()
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture</title><item>
    <title>Source headline</title><link>https://example.org/source-story</link><guid>fixture-story-1</guid><description>Original summary</description></item></channel></rss>`, { headers: { 'content-type': 'application/rss+xml' } })
  try {
    const result = await executeCronTasks(database)
    assert.equal(result.totalDrafts, 1, JSON.stringify({ result, sources: sqlite.prepare('SELECT id, last_status FROM news_sources').all(), policies: sqlite.prepare('SELECT * FROM automation_policies').all() }))
    const article = sqlite.prepare("SELECT * FROM articles WHERE source_url = 'https://example.org/source-story'").get()!
    assert.equal(article.status, 'draft')
    assert.equal(article.content, '')
    assert.equal(article.published_at, null)
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM article_cities WHERE article_id = ?').get(article.id as number)?.n, 0)
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM article_translations WHERE article_id = ?').get(article.id as number)?.n, 0)
    sqlite.prepare("UPDATE news_sources SET last_fetched_at = NULL WHERE id = 'test-source'").run()
    assert.equal((await executeCronTasks(database)).totalDuplicates, 1)
  } finally { globalThis.fetch = originalFetch; sqlite.close() }
})

test('private and ambiguous network endpoints are rejected before fetching', () => {
  for (const url of ['http://example.org', 'https://127.0.0.1', 'https://2130706433', 'https://[::ffff:127.0.0.1]',
    'https://[fd12::1]', 'https://localhost.', 'https://metadata.internal', 'https://user:pass@example.org', 'https://example.org:8443']) {
    assert.throws(() => assertSafeExternalUrl(url), url)
  }
  assert.equal(assertSafeExternalUrl('https://example.org/feed').hostname, 'example.org')
})

test('a database snapshot restores articles, translations, schema and integrity', () => {
  const { sqlite } = testDatabase()
  const directory = mkdtempSync(join(tmpdir(), 'news-restore-'))
  const file = join(directory, 'snapshot.sqlite')
  try {
    const before = sqlite.prepare('SELECT COUNT(*) n FROM articles').get()?.n
    sqlite.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
    const restored = new DatabaseSync(file)
    try {
      assert.equal(restored.prepare('SELECT COUNT(*) n FROM articles').get()?.n, before)
      assert.equal(restored.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok')
      assert.equal(restored.prepare('SELECT COUNT(*) n FROM article_translations').get()?.n, 330)
      assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length, 0)
    } finally { restored.close() }
  } finally { sqlite.close(); rmSync(directory, { recursive: true, force: true }) }
})
