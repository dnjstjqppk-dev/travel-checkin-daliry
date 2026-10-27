-- Migration 0008: Workflow and Security Fixes
-- 1. Add approval status to article_corrections to prevent public defacement
-- Note: SQLite does not support IF NOT EXISTS in ADD COLUMN, so we check or create
CREATE TABLE IF NOT EXISTS article_corrections_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  original_statement TEXT NOT NULL,
  corrected_statement TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  corrected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO article_corrections_new (id, article_id, original_statement, corrected_statement, reason, corrected_at)
SELECT id, article_id, original_statement, corrected_statement, reason, corrected_at FROM article_corrections;

DROP TABLE IF EXISTS article_corrections;
ALTER TABLE article_corrections_new RENAME TO article_corrections;

-- 2. Contact Inquiries Table for /contact endpoint
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'press',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. Rate Limits Table for public submission rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);

-- 4. Contributor Submissions review columns
ALTER TABLE contributor_submissions ADD COLUMN reviewed_by TEXT;
ALTER TABLE contributor_submissions ADD COLUMN reviewed_at TEXT;


-- 5. Article Reactions table
CREATE TABLE IF NOT EXISTS article_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('helpful', 'insightful', 'recommend')),
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(article_id, reaction_type, ip_hash)
);
CREATE INDEX IF NOT EXISTS idx_reactions_art_type ON article_reactions(article_id, reaction_type);

-- 6. Newsletter Subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
