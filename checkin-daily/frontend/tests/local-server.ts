/** Disposable browser-QA server. Never run against production data. */
import { testDatabase } from './sqlite-d1'
import { hashPassword } from '../server/utils/d1-auth'
const { database, sqlite } = testDatabase()
sqlite.prepare('INSERT INTO admin_accounts (username, password_hash, role) VALUES (?, ?, ?)')
  .run('qa-admin', await hashPassword('Local-QA-only-password-2026'), 'admin')
;(globalThis as any).__cf_db = database
process.env.NITRO_HOST = '127.0.0.1'
process.env.NITRO_PORT = '4173'
process.env.SITE_URL = 'http://127.0.0.1:4173'
process.env.NUXT_PUBLIC_SITE_URL = process.env.SITE_URL
sqlite.prepare("UPDATE site_settings SET value = ? WHERE key IN ('site_url', 'site_domain')").run(process.env.SITE_URL)
// @ts-ignore
await import(String('../.output/server/index.mjs'))
