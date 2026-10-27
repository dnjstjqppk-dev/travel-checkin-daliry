-- 0010_site_settings_and_seo_config.sql
-- Production Site Settings, Domain Configuration, ads.txt and SEO metadata

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('site_url', 'https://travel-checkin-daily.dnjstjqppk.workers.dev'),
  ('site_domain', 'travel-checkin-daily.dnjstjqppk.workers.dev'),
  ('company_name', '체크인데일리 미디어그룹'),
  ('representative', '원섭'),
  ('business_number', '2026-04-52914'),
  ('mail_order_number', '2026-서울중구-0123'),
  ('newspaper_number', '서울 아-52914'),
  ('youth_protection_officer', '원섭'),
  ('publisher', '원섭'),
  ('address', '서울특별시 중구 을지로 100 파인에비뉴 B동'),
  ('contact_email', 'editorial@checkindaily.com'),
  ('contact_phone', '02-738-2026'),
  ('brand_name', 'CHECK-IN'),
  ('brand_subname', 'DAILY'),
  ('slogan', '글로벌 여행 인텔리전스 & 마켓 트렌드 뉴스 미디어'),
  ('description', '전 세계 항공, 호텔, 여행지 트렌드 및 여행 정책을 가장 빠르고 깊이 있게 전달하는 글로벌 여행 전문 디지털 뉴스룸'),
  ('google_news_publication_name', 'Check-in Daily'),
  ('ads_txt_content', 'google.com, pub-9201847192847192, DIRECT, f08c47fec0942fa0'),
  ('google_site_verification', ''),
  ('naver_site_verification', ''),
  ('gemini_api_key', ''),
  ('default_og_image', '/images/og-default.png');

