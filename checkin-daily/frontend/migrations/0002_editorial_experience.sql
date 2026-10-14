ALTER TABLE articles
  ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0);

CREATE INDEX IF NOT EXISTS idx_articles_view_count
  ON articles(status, view_count DESC, published_at DESC);

CREATE TABLE IF NOT EXISTS exchange_rate_cache (
  base_code TEXT PRIMARY KEY,
  rates_json TEXT NOT NULL,
  provider_updated_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  fetched_at TEXT NOT NULL
);

INSERT OR IGNORE INTO ad_placements (id, name, format) VALUES
  ('main_mid', '메인 피드 중간 · 히어로와 갤러리 사이', 'auto'),
  ('main_bottom', '메인 갤러리 하단', 'auto'),
  ('list_inline_1', '뉴스 목록 · 4번째 카드 다음', 'auto'),
  ('list_inline_2', '뉴스 목록 · 8번째 카드 다음', 'auto'),
  ('list_inline_3', '뉴스 목록 · 12번째 카드 다음', 'auto'),
  ('article_mid', '기사 상세 · 본문 하단', 'auto'),
  ('article_related', '기사 상세 · 추천 기사 위', 'auto');

UPDATE ad_placements SET name = '메인 상단 · 헤드라인 위' WHERE id = 'main_top';
UPDATE ad_placements SET name = '기사 상세 · 제목과 본문 사이' WHERE id = 'article_top';
UPDATE ad_placements SET name = '기사 상세 · 본문 다음' WHERE id = 'article_bottom';
