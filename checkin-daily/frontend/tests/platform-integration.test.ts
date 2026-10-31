import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createApp, eventHandler, getRequestURL, toWebHandler } from 'h3'
import { testDatabase } from './sqlite-d1'
import { handleD1Api } from '../server/utils/d1-api'
import { hashPassword } from '../server/utils/d1-auth'
import { canAccessStaff } from '../server/utils/staff-permissions'
import { articleSitemap } from '../server/utils/sitemap-data'
import rss from '../server/routes/rss.xml'
import atom from '../server/routes/atom.xml'
import news from '../server/routes/news-sitemap.xml'
import sitemap from '../server/routes/sitemap.xml'
const { JSDOM } = createRequire(import.meta.url)('jsdom')

function appFixture() {
  const fixture = testDatabase()
  const app = createApp()
  app.use(eventHandler(async event => {
    event.context.cloudflare = { env: { DB: fixture.database } }
    const path = getRequestURL(event).pathname
    if (path === '/rss.xml') return rss(event)
    if (path === '/atom.xml') return atom(event)
    if (path === '/news-sitemap.xml') return news(event)
    if (path === '/sitemap.xml') return sitemap(event)
    return handleD1Api(event, fixture.database)
  }))
  const fetch = (path: string, init?: RequestInit) => toWebHandler(app)(new Request(`https://local.test${path}`, { ...init, headers: { host: 'local.test', 'x-forwarded-proto': 'https', ...Object.fromEntries(new Headers(init?.headers).entries()) } }))
  return { ...fixture, fetch }
}
function parseXml(text: string) { return new JSDOM(text, { contentType: 'application/xml' }).window.document }

test('HTTP feeds serialize hostile text, preserve GUID and exclude drafts/future/retracted content', async () => {
  const { sqlite, fetch } = appFixture()
  sqlite.exec("UPDATE articles SET status = 'draft'")
  const insert = sqlite.prepare(`INSERT INTO articles (title, slug, category, status, published_at, updated_at)
    VALUES (?, ?, 'major', ?, ?, ?)`)
  const now = new Date().toISOString()
  const title = 'A & <test> ]]> text'
  const id = Number(insert.run(title, 'xml-test', 'published', now, now).lastInsertRowid)
  insert.run('Hidden draft', 'hidden-draft', 'draft', now, now)
  insert.run('Future article', 'future-article', 'published', '2099-01-01T00:00:00Z', now)
  const response = await fetch('/rss.xml')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /application\/rss\+xml/)
  const xml = parseXml(await response.text())
  assert.equal(xml.querySelectorAll('item').length, 1)
  assert.equal(xml.querySelector('item title').textContent, title)
  assert.match(xml.querySelector('guid').textContent, new RegExp(`/article/${id}$`))
  const atomXml = parseXml(await (await fetch('/atom.xml')).text())
  assert.equal(atomXml.getElementsByTagName('entry').length, 1)
  const untranslated = parseXml(await (await fetch('/rss.xml?lang=en')).text())
  assert.equal(untranslated.querySelectorAll('item').length, 0)
  sqlite.prepare('UPDATE articles SET retracted_at = ? WHERE id = ?').run(now, id)
  assert.equal(parseXml(await (await fetch('/rss.xml')).text()).querySelectorAll('item').length, 0)
  sqlite.close()
})

test('sitemap splits past a shard and advertises only real translations', async () => {
  const { sqlite, database, fetch } = appFixture()
  sqlite.exec("UPDATE articles SET status = 'draft'")
  const insert = sqlite.prepare(`INSERT INTO articles (title, slug, category, status, published_at, updated_at)
    VALUES ('Story', ?, 'major', 'published', ?, ?)`)
  const now = new Date().toISOString()
  sqlite.exec('BEGIN')
  for (let i = 0; i < 2001; i++) insert.run(`shard-${i}`, now, now)
  sqlite.exec('COMMIT')
  const first = parseXml(await articleSitemap(database, 'https://local.test', 1))
  const second = parseXml(await articleSitemap(database, 'https://local.test', 2))
  assert.equal(first.getElementsByTagName('url').length, 2000)
  assert.equal(second.getElementsByTagName('url').length, 1)
  assert.equal(first.querySelector('[hreflang="en"]'), null)
  const index = parseXml(await (await fetch('/sitemap.xml')).text())
  assert.match(index.documentElement.textContent, /sitemap-articles.xml\?page=2/)
  const newsXml = parseXml(await (await fetch('/news-sitemap.xml?page=2')).text())
  assert.equal(newsXml.getElementsByTagName('url').length, 1000)
  assert.equal((await fetch('/news-sitemap.xml?page=0')).status, 400)
  sqlite.close()
})

test('staff sessions retain assigned role and enforce API permissions over HTTP', async () => {
  const { sqlite, fetch } = appFixture()
  sqlite.prepare('INSERT INTO admin_accounts (username, password_hash, role) VALUES (?, ?, ?)')
    .run('reporter-test', await hashPassword('unique-test-password-123'), 'reporter')
  const login = await fetch('/api/auth/login', { method: 'POST', headers: { origin: 'https://local.test', 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'reporter-test', password: 'unique-test-password-123' }) })
  assert.equal(login.status, 200, await login.clone().text())
  assert.equal((await login.json() as { role: string }).role, 'reporter')
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  const allowed = await fetch('/api/admin/articles', { headers: { cookie } })
  assert.equal(allowed.status, 200)
  const denied = await fetch('/api/admin/settings', { headers: { cookie } })
  assert.equal(denied.status, 403)
  const noSession = await fetch('/api/admin/articles')
  assert.equal(noSession.status, 401)
  const crossOrigin = await fetch('/api/admin/articles', { method: 'POST', headers: { cookie, origin: 'https://attacker.test', 'content-type': 'application/json' }, body: '{}' })
  assert.equal(crossOrigin.status, 403)
  sqlite.close()
})

test('permission matrix fails closed for editorial, translation and audit roles', () => {
  assert.equal(canAccessStaff('reporter', '/api/admin/review', 'POST'), false)
  assert.equal(canAccessStaff('editor', '/api/admin/articles/1', 'DELETE'), false)
  assert.equal(canAccessStaff('translator', '/api/admin/articles', 'POST'), false)
  assert.equal(canAccessStaff('auditor', '/api/admin/logs', 'GET'), true)
  assert.equal(canAccessStaff('auditor', '/api/admin/automation', 'POST'), false)
  assert.equal(canAccessStaff('editor_in_chief', '/api/admin/review', 'POST'), true)
})
