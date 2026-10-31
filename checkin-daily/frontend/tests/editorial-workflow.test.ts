import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testDatabase } from './sqlite-d1'
import { transitionArticle } from '../server/utils/editorial-workflow'

function fixture() {
  const db = testDatabase()
  const body = 'Verified editorial text. '.repeat(45) + [1,2,3,4].map(n => `\n![Evidence](https://example.org/${n}.jpg)`).join('')
  const result = db.sqlite.prepare(`INSERT INTO articles (title, slug, content, category, license_info, status, review_status)
    VALUES ('Test', 'workflow-test', ?, 'major', 'Original work, author grant recorded', 'draft', 'needs_review')`).run(body)
  return { ...db, id: Number(result.lastInsertRowid) }
}
test('schedule, reject and obsolete worker execution preserve rejection', async () => {
  const { database, sqlite, id } = fixture()
  await transitionArticle(database, { articleId: id, actor: 'editor', decision: 'approve', scheduledAt: '2099-01-01T00:00:00Z' })
  const job = sqlite.prepare('SELECT id FROM publish_jobs WHERE article_id = ?').get(id)!
  await transitionArticle(database, { articleId: id, actor: 'editor', decision: 'reject' })
  await assert.rejects(transitionArticle(database, { articleId: id, actor: 'cron-scheduler', decision: 'approve', jobId: Number(job.id) }), { statusCode: 409 })
  assert.equal(sqlite.prepare('SELECT status FROM articles WHERE id = ?').get(id)?.status, 'draft')
  assert.equal(sqlite.prepare('SELECT status FROM publish_jobs WHERE id = ?').get(job.id as number)?.status, 'cancelled')
  sqlite.close()
})
test('publication and audit roll back together when the audit write fails', async () => {
  const { database, sqlite, id } = fixture()
  sqlite.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END")
  await assert.rejects(transitionArticle(database, { articleId: id, actor: 'editor', decision: 'approve' }))
  assert.equal(sqlite.prepare('SELECT status FROM articles WHERE id = ?').get(id)?.status, 'draft')
  sqlite.close()
})
test('worker publication is idempotent and preserves first publication date', async () => {
  const { database, sqlite, id } = fixture()
  await transitionArticle(database, { articleId: id, actor: 'editor', decision: 'approve', scheduledAt: '2099-01-01T00:00:00Z' })
  const job = sqlite.prepare('SELECT id FROM publish_jobs WHERE article_id = ?').get(id)!
  await transitionArticle(database, { articleId: id, actor: 'cron-scheduler', decision: 'approve', jobId: Number(job.id) })
  await assert.rejects(transitionArticle(database, { articleId: id, actor: 'cron-scheduler', decision: 'approve', jobId: Number(job.id) }), { statusCode: 409 })
  const article = sqlite.prepare('SELECT published_at, first_published_at FROM articles WHERE id = ?').get(id)!
  assert.equal(article.first_published_at, article.published_at)
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE target_resource = ? AND action = 'editorial_approved'").get(`article:${id}`)?.n, 1)
  sqlite.close()
})
test('unproven rights and invalid bodies cannot publish through workflow', async () => {
  const { database, sqlite, id } = fixture()
  sqlite.prepare("UPDATE articles SET license_info = 'Editorial Fair Citation' WHERE id = ?").run(id)
  await assert.rejects(transitionArticle(database, { articleId: id, actor: 'editor', decision: 'approve' }), { statusCode: 422 })
  sqlite.close()
})

test('a concurrent article edit prevents stale publication and its audit record', async () => {
  const { database, sqlite, id } = fixture()
  const batch = database.batch.bind(database)
  database.batch = async statements => {
    sqlite.prepare("UPDATE articles SET content = 'Changed after approval check' WHERE id = ?").run(id)
    return batch(statements)
  }
  await assert.rejects(transitionArticle(database, { articleId: id, actor: 'editor', decision: 'approve' }), { statusCode: 409 })
  assert.equal(sqlite.prepare('SELECT status FROM articles WHERE id = ?').get(id)?.status, 'draft')
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM audit_logs WHERE target_resource = ?').get(`article:${id}`)?.n, 0)
  sqlite.close()
})
