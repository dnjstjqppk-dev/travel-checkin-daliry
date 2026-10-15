-- Migration 0005: Enterprise News CMS Relational Schema
-- Supports Full Editorial Workflow, Fact-Checking, Sources, Partners, Multilingual, Bookmarks & Audit

-- 10.1 Users & Authentication
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  preferred_lang TEXT NOT NULL DEFAULT 'ko',
  country_code TEXT NOT NULL DEFAULT 'KR'
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS reader_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dark_mode INTEGER NOT NULL DEFAULT 0,
  font_size TEXT NOT NULL DEFAULT 'medium',
  newsletter_opt_in INTEGER NOT NULL DEFAULT 1,
  breaking_news_opt_in INTEGER NOT NULL DEFAULT 1
);

-- 10.2 Editorial & Article Quality
CREATE TABLE IF NOT EXISTS article_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  revision_num INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  author_id INTEGER,
  editor_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS article_fact_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'unverified', 'disputed')),
  evidence_url TEXT NOT NULL DEFAULT '',
  checked_by TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS article_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_date TEXT NOT NULL DEFAULT '',
  license_type TEXT NOT NULL DEFAULT 'Press Release / Editorial Quotation'
);

CREATE TABLE IF NOT EXISTS article_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  original_statement TEXT NOT NULL,
  corrected_statement TEXT NOT NULL,
  reason TEXT NOT NULL,
  corrected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 10.4 Contributors & Partners
CREATE TABLE IF NOT EXISTS contributor_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('airline', 'tourism_board', 'hotel_chain', 'media_partner', 'freelance')),
  contact_email TEXT NOT NULL,
  website_url TEXT NOT NULL DEFAULT '',
  is_verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contributor_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT REFERENCES contributor_organizations(id),
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  city_ids TEXT NOT NULL DEFAULT '[]',
  attachment_urls TEXT NOT NULL DEFAULT '[]',
  source_url TEXT NOT NULL DEFAULT '',
  copyright_proof TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'revision_requested', 'approved', 'rejected')),
  editorial_feedback TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 10.5 Ingestion & News Sources
CREATE TABLE IF NOT EXISTS news_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'press_room', 'official_api', 'partner_wire')),
  endpoint_url TEXT NOT NULL,
  fetch_interval_minutes INTEGER NOT NULL DEFAULT 60,
  license_info TEXT NOT NULL DEFAULT 'Fair Use / Editorial Fair Citation',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_fetched_at TEXT,
  last_status TEXT NOT NULL DEFAULT 'ok'
);

CREATE TABLE IF NOT EXISTS feed_ingestion_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES news_sources(id),
  guid TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  pub_date TEXT NOT NULL,
  raw_content TEXT NOT NULL DEFAULT '',
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  processed_to_draft INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 10.7 Reader Services (Bookmarks, History, Newsletter)
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, article_id)
);

CREATE TABLE IF NOT EXISTS reading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  lang TEXT NOT NULL DEFAULT 'ko',
  is_active INTEGER NOT NULL DEFAULT 1,
  subscribed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 10.8 Analytics & Audit Logs
CREATE TABLE IF NOT EXISTS ranking_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL CHECK (period IN ('realtime', 'daily', 'weekly')),
  rankings_json TEXT NOT NULL,
  captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'editor', 'partner', 'system')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_resource TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Seed Essential Roles and Sources
INSERT OR IGNORE INTO roles (id, name, description) VALUES
  ('super_admin', 'Super Admin', '최고 관리자 - 전체 시스템 및 설정 권한'),
  ('editor_in_chief', 'Editor in Chief', '편집국장 - 기사 최종 승인 및 정정 권한'),
  ('editor', 'Editor', '에디터 - 기사 작성 및 검토 권한'),
  ('reporter', 'Reporter', '취재기자 - 기사 초안 작성 권한'),
  ('contributor', 'Contributor', '외부 기고자 - 보도자료 투고 권한');

INSERT OR IGNORE INTO news_sources (id, name, source_type, endpoint_url, license_info, is_active) VALUES
  ('aot_press', 'Airports of Thailand (AOT)', 'press_room', 'https://www.mot.go.th/', 'Official Government PR', 1),
  ('tat_news', 'Tourism Authority of Thailand (TAT)', 'press_room', 'https://www.tatnews.org/', 'Official Tourism Board PR', 1),
  ('pha_phuket', 'Phuket Hotels Association', 'press_room', 'https://www.phukethotelsassociation.com/', 'Industry Association Report', 1),
  ('srt_railway', 'State Railway of Thailand (SRT)', 'press_room', 'https://www.railway.co.th/', 'State Enterprise PR', 1);

CREATE INDEX IF NOT EXISTS idx_revisions_article ON article_revisions(article_id, revision_num DESC);
CREATE INDEX IF NOT EXISTS idx_fact_checks_article ON article_fact_checks(article_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON contributor_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

