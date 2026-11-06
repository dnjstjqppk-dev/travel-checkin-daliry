import test from 'node:test'
import assert from 'node:assert/strict'
import { testDatabase } from './sqlite-d1'
import {
  hashIp,
  hashCommentPassword,
  verifyCommentPassword,
  containsAbuseKeywords,
  buildCommentTree,
} from '../server/utils/comments-guard'
import { dispatchNewsletterBatch } from '../server/utils/email-dispatcher'
import { getVapidConfig, broadcastPushNotification } from '../server/utils/web-push'

test('Comments Guard - IP and Password Hashing & Abuse Detection', async () => {
  // 1. IP Hashing
  const hash1 = await hashIp('192.168.1.100')
  const hash2 = await hashIp('192.168.1.100')
  const hash3 = await hashIp('10.0.0.1')

  assert.equal(hash1, hash2, 'Identical IPs should generate identical hashes')
  assert.notEqual(hash1, hash3, 'Different IPs should generate different hashes')
  assert.equal(hash1.length, 32, 'Pseudonymized IP hash should be 32 characters long')

  // 2. Password Hashing & Verification
  const hashed = await hashCommentPassword('mySecretPass123!')
  assert.ok(hashed.length > 20)
  assert.ok(await verifyCommentPassword('mySecretPass123!', hashed), 'Valid password must match')
  assert.ok(!await verifyCommentPassword('wrongPass', hashed), 'Invalid password must be rejected')

  // 3. Abuse Keywords Detection
  assert.ok(containsAbuseKeywords('바카라 사이트 추천합니다'), 'Should catch gambling spam')
  assert.ok(containsAbuseKeywords('viagra online shop discount'), 'Should catch spam keywords')
  assert.ok(!containsAbuseKeywords('이번 방콕 수완나품 공항 관련 기사 유익하네요!'), 'Clean comment should pass')
})

test('Comments Hierarchy Builder - 2-Level Threading', () => {
  const flatComments = [
    {
      id: 1,
      article_id: 10,
      parent_id: null,
      author_name: '독자1',
      author_email: null,
      password_hash: null,
      content: '기사 내용 좋습니다.',
      status: 'approved',
      like_count: 5,
      created_at: '2026-10-31T10:00:00Z',
      updated_at: '2026-10-31T10:00:00Z',
    },
    {
      id: 2,
      article_id: 10,
      parent_id: 1,
      author_name: '독자2',
      author_email: null,
      password_hash: null,
      content: '동의합니다. 특히 항공권 정보가 빠르네요.',
      status: 'approved',
      like_count: 2,
      created_at: '2026-10-31T10:05:00Z',
      updated_at: '2026-10-31T10:05:00Z',
    },
    {
      id: 3,
      article_id: 10,
      parent_id: null,
      author_name: '독자3',
      author_email: null,
      password_hash: null,
      content: '추가 업데이트 기대합니다.',
      status: 'approved',
      like_count: 0,
      created_at: '2026-10-31T10:10:00Z',
      updated_at: '2026-10-31T10:10:00Z',
    },
  ]

  const tree = buildCommentTree(flatComments)
  assert.equal(tree.length, 2, 'Should have 2 root comments')
  assert.equal(tree[0]?.id, 1)
  assert.equal(tree[0]?.replies.length, 1, 'Root comment 1 should have 1 child reply')
  assert.equal(tree[0]?.replies[0]?.id, 2)
  assert.equal(tree[1]?.id, 3)
  assert.equal(tree[1]?.replies.length, 0, 'Root comment 3 should have 0 replies')
})

test('Email Dispatcher - Fails closed without provider keys', async () => {
  const { database } = testDatabase()
  const savedResend = process.env.RESEND_API_KEY
  const savedSendgrid = process.env.SENDGRID_API_KEY
  delete process.env.RESEND_API_KEY
  delete process.env.SENDGRID_API_KEY
  try {
    const recipients = ['reader1@example.com', 'reader2@example.com', 'reader3@example.com']
    await assert.rejects(
      dispatchNewsletterBatch({
        database,
        subject: '[Check-in Daily] 10월 31일 모닝 브리핑',
        html: '<p>모닝 뉴스레터 본문 테스트</p>',
        recipients,
      }),
      (err: any) => err?.statusCode === 503,
      'Dispatch without provider keys must reject with 503, never report mock delivery',
    )

    // No fabricated success may be logged
    const logCount = await database.prepare('SELECT COUNT(*) AS n FROM newsletter_dispatch_logs').first<any>()
    assert.equal(logCount?.n ?? 0, 0, 'Unconfigured dispatch must not write a delivery log')
  } finally {
    if (savedResend !== undefined) process.env.RESEND_API_KEY = savedResend
    if (savedSendgrid !== undefined) process.env.SENDGRID_API_KEY = savedSendgrid
  }
})

test('Email Dispatcher - Provider selection without network delivery', async () => {
  const { database } = testDatabase()

  const result = await dispatchNewsletterBatch({
    database,
    env: { RESEND_API_KEY: 're_test_key_for_provider_selection' },
    subject: '[Check-in Daily] test',
    html: '<p>test</p>',
    recipients: [],
  })

  assert.equal(result.provider, 'resend', 'Valid Resend key format must select the resend provider')
  assert.equal(result.totalRecipients, 0)
  assert.equal(result.status, 'completed')
})

test('Web Push Notification - Fails closed without VAPID keys', async () => {
  const { database } = testDatabase()
  const savedPub = process.env.VAPID_PUBLIC_KEY
  const savedPriv = process.env.VAPID_PRIVATE_KEY
  delete process.env.VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
  try {
    await assert.rejects(
      getVapidConfig(database),
      (err: any) => err?.statusCode === 503,
      'Missing VAPID keys must reject with 503, never fall back to embedded keys',
    )
  } finally {
    if (savedPub !== undefined) process.env.VAPID_PUBLIC_KEY = savedPub
    if (savedPriv !== undefined) process.env.VAPID_PRIVATE_KEY = savedPriv
  }
})

test('Web Push Notification - VAPID Key Loading & Subscription Broadcast', async () => {
  const { database } = testDatabase()

  // 1. VAPID Config from site_settings (test-only keys, never production secrets)
  await database.prepare(`INSERT OR REPLACE INTO site_settings (key, value) VALUES ('vapid_public_key', 'test-vapid-public-key-not-for-production-use-0123456789abcdef')`).run()
  await database.prepare(`INSERT OR REPLACE INTO site_settings (key, value) VALUES ('vapid_private_key', 'test-vapid-private-key-not-for-production-00')`).run()
  const vapid = await getVapidConfig(database)
  assert.equal(vapid.publicKey, 'test-vapid-public-key-not-for-production-use-0123456789abcdef')
  assert.equal(vapid.privateKey, 'test-vapid-private-key-not-for-production-00')

  // 2. Insert test push subscription
  await database.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh_key, auth_key, lang, is_active)
    VALUES ('https://fcm.googleapis.com/fcm/send/fake-test-token', 'fake-p256dh', 'fake-auth', 'ko', 1)
  `).run()

  const sub = await database.prepare('SELECT * FROM push_subscriptions WHERE endpoint LIKE ?').bind('%fake-test-token').first<any>()
  assert.ok(sub)
  assert.equal(sub.is_active, 1)

  // 3. Broadcast test (will handle network failure gracefully without crashing)
  const broadcastResult = await broadcastPushNotification(database, undefined, {
    title: '[속보] 태국 항공편 증편 안내',
    body: '인천-방콕 직항 증편이 결정되었습니다.',
    url: '/news/airline/article/999',
  })

  assert.equal(broadcastResult.totalSubscribers, 1)
  assert.equal(typeof broadcastResult.sentCount, 'number')
  assert.equal(typeof broadcastResult.failedCount, 'number')

  // 4. Verify push notification logs in D1
  const pushLog = await database.prepare('SELECT * FROM push_notification_logs ORDER BY id DESC LIMIT 1').first<any>()
  assert.ok(pushLog, 'Push broadcast log must be persisted to D1')
  assert.equal(pushLog.title, '[속보] 태국 항공편 증편 안내')
  assert.equal(pushLog.target_url, '/news/airline/article/999')
})
