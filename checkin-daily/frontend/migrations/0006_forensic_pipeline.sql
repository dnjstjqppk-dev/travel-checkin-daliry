-- Migration 0006: Forensic Editorial Pipeline & Publishing Automation Schema

-- 1. Extend articles table with granular timestamps, editorial verification, and attribution
ALTER TABLE articles ADD COLUMN subtitle TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN source_name TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN license_info TEXT NOT NULL DEFAULT 'Editorial Fair Citation';
ALTER TABLE articles ADD COLUMN is_breaking INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN source_first_published_at TEXT;
ALTER TABLE articles ADD COLUMN source_updated_at TEXT;
ALTER TABLE articles ADD COLUMN first_published_at TEXT;
ALTER TABLE articles ADD COLUMN ingested_at TEXT;
ALTER TABLE articles ADD COLUMN fact_checked_at TEXT;
ALTER TABLE articles ADD COLUMN scheduled_at TEXT;
ALTER TABLE articles ADD COLUMN retracted_at TEXT;
ALTER TABLE articles ADD COLUMN retraction_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN quality_score INTEGER NOT NULL DEFAULT 85;
ALTER TABLE articles ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('ingested', 'candidate', 'draft', 'needs_review', 'approved', 'scheduled', 'published', 'rejected', 'failed', 'correction_required', 'retracted', 'archived'));

-- 2. Ingestion Runs Tracker
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES news_sources(id),
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  fetched_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_detail TEXT NOT NULL DEFAULT ''
);

-- 3. Publish Jobs & Scheduled Queue
CREATE TABLE IF NOT EXISTS publish_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 4. Granular Real Analytics Events (filtering bots vs real user interactions)
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'affiliate_click', 'share', 'bookmark', 'search', 'correction_request')),
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  bot_classification TEXT NOT NULL DEFAULT 'human' CHECK (bot_classification IN ('human', 'crawler', 'suspected_bot')),
  referrer_category TEXT NOT NULL DEFAULT 'direct',
  target_platform TEXT NOT NULL DEFAULT '',
  meta_json TEXT NOT NULL DEFAULT '{}'
);

-- 5. Dynamic Automation Policy Settings
CREATE TABLE IF NOT EXISTS automation_policies (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Initialize Default Automation Policies
INSERT OR IGNORE INTO automation_policies (key, value, description) VALUES
  ('is_automation_paused', '0', 'Global Automation Kill-Switch (1=Paused, 0=Active)'),
  ('auto_publish_enabled', '0', 'Auto-Publish without Human Review (0=Review Mandatory, 1=Allowed for trusted sources)'),
  ('auto_draft_enabled', '1', 'Automatic AI Draft Generation from Feeds'),
  ('auto_translation_enabled', '1', 'Automatic Multilingual Translation Generation'),
  ('min_quality_score_threshold', '80', 'Minimum Quality Score required for publication'),
  ('daily_publish_limit', '50', 'Max articles published per day'),
  ('dedup_similarity_threshold', '0.85', 'Threshold for duplicate detection'),
  ('restricted_keywords', '사망,테러,추락,사고,전쟁,비상사태,폭탄,피랍,의혹', 'Keywords that strictly require human editorial approval');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_timestamps ON articles(published_at, first_published_at, fact_checked_at);
CREATE INDEX IF NOT EXISTS idx_articles_review_status ON articles(review_status, status);
CREATE INDEX IF NOT EXISTS idx_analytics_events_article ON analytics_events(article_id, event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_scheduled ON publish_jobs(status, scheduled_at);

