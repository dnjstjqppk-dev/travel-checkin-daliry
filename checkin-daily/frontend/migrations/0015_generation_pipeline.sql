-- Migration 0015: AI auto-publishing pipeline contract
-- Adds generation logs, tags, SEO metadata and title-hash deduplication so the
-- ingestion -> generation -> quality gate -> publish pipeline is auditable end to end.

ALTER TABLE articles ADD COLUMN meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN key_takeaways_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE articles ADD COLUMN title_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN generated_by TEXT NOT NULL DEFAULT '';
-- SHA-256 of the normalized source headline: rejects re-processing a source before any LLM call.
ALTER TABLE articles ADD COLUMN source_hash TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_articles_source_hash ON articles(source_hash);

CREATE INDEX IF NOT EXISTS idx_articles_title_hash ON articles(title_hash);
CREATE INDEX IF NOT EXISTS idx_articles_source_url ON articles(source_url);
CREATE INDEX IF NOT EXISTS idx_articles_public_feed ON articles(status, published_at);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag_id, article_id);

CREATE TABLE IF NOT EXISTS generation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron', 'manual', 'api')),
  source_id TEXT,
  ingestion_item_id INTEGER REFERENCES feed_ingestion_items(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL DEFAULT '',
  keyword TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('started', 'drafted', 'published', 'rejected', 'duplicate', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  error_code TEXT NOT NULL DEFAULT '',
  error_detail TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_generation_logs_created ON generation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_generation_logs_status ON generation_logs(status, created_at);

INSERT OR IGNORE INTO automation_policies (key, value, description) VALUES
  ('max_generations_per_run', '3', 'Maximum AI articles generated per cron run (Workers time budget)'),
  ('min_source_context_chars', '160', 'Minimum source text required before the AI may write an article'),
  ('min_generated_body_chars', '1200', 'Minimum Korean body length (chars incl. spaces) accepted from the AI writer'),
  ('use_source_media', '0', 'Use the source RSS media / og:image as the cover (1) or licensed stock photography only (0)');
