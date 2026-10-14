PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  continent TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES countries(code),
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS article_cities (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, city_id)
);

CREATE TABLE IF NOT EXISTS ad_placements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ad_client_id TEXT NOT NULL DEFAULT '',
  ad_slot_id TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'auto',
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS admin_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_cities_country ON cities(country_code);
CREATE INDEX IF NOT EXISTS idx_article_cities_city ON article_cities(city_id, article_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions(expires_at);

INSERT OR IGNORE INTO categories (name, slug) VALUES
  ('주요뉴스', 'major'),
  ('항공', 'airline'),
  ('호텔', 'hotel'),
  ('여행지', 'destination'),
  ('실시간 뉴스', 'realtime');

INSERT OR IGNORE INTO countries (code, name_ko, name_en, continent, sort_order) VALUES
  ('KR', '대한민국', 'South Korea', 'Asia', 1),
  ('JP', '일본', 'Japan', 'Asia', 2),
  ('US', '미국', 'United States', 'North America', 3),
  ('FR', '프랑스', 'France', 'Europe', 4),
  ('IT', '이탈리아', 'Italy', 'Europe', 5),
  ('TH', '태국', 'Thailand', 'Asia', 6),
  ('VN', '베트남', 'Vietnam', 'Asia', 7),
  ('SG', '싱가포르', 'Singapore', 'Asia', 8),
  ('GB', '영국', 'United Kingdom', 'Europe', 9),
  ('AU', '호주', 'Australia', 'Oceania', 10);

INSERT OR IGNORE INTO cities (id, country_code, name_ko, name_en) VALUES
  ('sel', 'KR', '서울', 'Seoul'),
  ('pus', 'KR', '부산', 'Busan'),
  ('cju', 'KR', '제주', 'Jeju'),
  ('tyo', 'JP', '도쿄', 'Tokyo'),
  ('osa', 'JP', '오사카', 'Osaka'),
  ('sap', 'JP', '삿포로', 'Sapporo'),
  ('nyc', 'US', '뉴욕', 'New York'),
  ('sfo', 'US', '샌프란시스코', 'San Francisco'),
  ('lax', 'US', '로스앤젤레스', 'Los Angeles'),
  ('par', 'FR', '파리', 'Paris'),
  ('rom', 'IT', '로마', 'Rome'),
  ('bkk', 'TH', '방콕', 'Bangkok'),
  ('sgn', 'VN', '호찌민', 'Ho Chi Minh City'),
  ('sin', 'SG', '싱가포르', 'Singapore'),
  ('lon', 'GB', '런던', 'London'),
  ('syd', 'AU', '시드니', 'Sydney');

INSERT OR IGNORE INTO ad_placements (id, name, format) VALUES
  ('main_top', '메인 상단 배너', 'auto'),
  ('sidebar_rect', '사이드바 사각형', 'rectangle'),
  ('article_top', '기사 상단', 'auto'),
  ('article_bottom', '기사 하단', 'auto');

INSERT OR IGNORE INTO articles (id, title, slug, summary, content, category, author, status, published_at) VALUES
  (1, '마일리지 발권, 유류할증료까지 계산해야 하는 이유', 'mileage-ticket-fees', '마일리지 좌석만 보던 시대는 끝났습니다. 발권 전 체크할 비용과 조건을 정리했습니다.', '## 발권 전에 총액을 보세요\n\n마일리지 차감액뿐 아니라 유류할증료와 공항세를 함께 비교해야 합니다.\n\n- 출발일별 부과액 확인\n- 변경 및 취소 수수료 확인\n- 편도 여정도 별도 검색', 'airline', '체크인데일리 편집팀', 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (2, '호텔 티어 혜택, 체크인 전에 확인할 세 가지', 'hotel-status-checkin-benefits', '객실 업그레이드부터 레이트 체크아웃까지, 예약 채널과 투숙 조건이 혜택을 바꿉니다.', '## 예약 조건이 혜택을 좌우합니다\n\n공식 채널 예약 여부와 체크인 시점의 객실 상황을 함께 살펴보세요.\n\n1. 회원 번호가 예약에 연결됐는지 확인합니다.\n2. 조식 및 라운지 동반 규정을 확인합니다.\n3. 레이트 체크아웃 시간을 프런트에 재확인합니다.', 'hotel', '체크인데일리 편집팀', 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (3, '여행 업계 브리핑: 이번 주의 변화', 'travel-industry-briefing', '항공과 호텔 업계의 주요 정책 변화를 한눈에 확인하세요.', '## 이번 주 핵심\n\n새로운 운임 조건과 호텔 멤버십 정책은 예약 전에 공식 안내를 확인하는 것이 좋습니다.', 'major', '체크인데일리 편집팀', 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (4, '도쿄 공항 이동 전 확인할 교통 안내', 'tokyo-airport-transit-update', '여행 당일 공항과 도심을 잇는 교통편 운행 정보를 확인하세요.', '## 출발 전 교통편을 확인하세요\n\n공항철도와 버스는 운행 시간 및 승차 위치가 변경될 수 있으므로 출발 전에 운영사 공지를 확인하세요.', 'realtime', '체크인데일리 편집팀', 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (5, '파리 여행 전 알아둘 도심 이동 팁', 'paris-city-transit-guide', '박물관과 주요 명소를 둘러보기 전 대중교통 이용 정보를 확인하세요.', '## 파리 도심 이동\n\n방문 시기별 교통 운영 정보와 박물관 휴관일을 공식 안내에서 미리 확인하세요.', 'destination', '체크인데일리 편집팀', 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO article_cities (article_id, city_id) VALUES
  (1, 'tyo'),
  (2, 'tyo'),
  (2, 'par'),
  (4, 'tyo'),
  (5, 'par');
