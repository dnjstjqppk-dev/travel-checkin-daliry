-- Migration: 0014_community_email_and_webpush.sql
-- Adds tables for:
-- 1. Reader comments & threaded discussions with moderation
-- 2. High-volume newsletter dispatch logs & metrics
-- 3. Web Push notification subscriptions & delivery logs

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  password_hash TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved', -- 'approved', 'pending_review', 'flagged', 'deleted'
  like_count INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_article_status ON comments(article_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

CREATE TABLE IF NOT EXISTS comment_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON comment_reports(status);

CREATE TABLE IF NOT EXISTS newsletter_dispatch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'resend', -- 'resend', 'sendgrid', 'cloudflare', 'mock'
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'partial', 'failed'
  error_detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ko',
  topics TEXT NOT NULL DEFAULT 'all',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active);

CREATE TABLE IF NOT EXISTS push_notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_url TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

