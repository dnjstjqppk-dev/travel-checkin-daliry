# 🏭 Check-in Daily Master Architecture — Clone Factory Guide
**10-Minute Rapid Deployment Runbook for Derivative Media Platforms (Travel / Coin / Stock / Tech)**

---

## 1. 마스터 아키텍처 개요 (Master Architecture Overview)

본 리포지토리(`checkin-daily`)는 고효율 트래픽 유입 및 자매 플랫폼(`tripscanner`, `getfortrip`)으로의 즉각적인 전환을 위해 설계된 **100% 무결점 상용 뉴스 미디어 엔진**입니다.

이 시스템은 단일 도메인에 종속되지 않고, 환경설정(`config/brand.config.ts` 및 `config/site.config.ts`)과 D1 `site_settings` 전환만으로 **코인(Coin), 주식(Stock), 테크(Tech) 등 모든 산업 도메인의 전문 미디어로 10분 이내에 복제(Clone) 및 상용 배포**될 수 있도록 완전히 모듈화(White-Label Ready)되어 있습니다.

```
                      ┌────────────────────────────────────────┐
                      │    Check-in Daily Master Engine        │
                      │  (Nuxt 4 + Nitro + Cloudflare Workers)  │
                      └──────────────────┬─────────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         ▼                               ▼                               ▼
 ✈️ Travel News Hub             🪙 Crypto News Hub              📈 Equity News Hub
 (Check-in Daily)               (CoinPulse Daily)               (MarketPulse Daily)
    │                               │                               │
    ├─► tripscanner.com             ├─► coinscanner.io              ├─► stockscanner.io
    └─► getfortrip.com              └─► dexradar.io                 └─► etffinder.com
```

---

## 2. 복제 배포 5단계 런북 (10-Minute Clone Runbook)

### [Step 1] 저장소 복제 및 브랜드 프리셋 선택 (2분)

1. 새 도메인용 Git Repository 생성 후 본 마스터 브랜치를 클론합니다:
   ```bash
   git clone https://github.com/dnjstjqppk-dev/travel-checkin-daliry.git coinpulse-daily
   cd coinpulse-daily
   ```

2. `checkin-daily/frontend/config/site.config.ts`에서 사용할 프리셋을 지정하거나 직접 수정합니다:
   ```ts
   import { brandPresets } from './brand.config'
   
   // 'travel' | 'coin' | 'stock' 중 선택 또는 신규 브랜드 추가
   export const siteConfig = brandPresets.coin
   ```

3. `wrangler.toml`의 워커 명칭 변경:
   ```toml
   name = "coinpulse-daily"
   main = "./.output/server/index.mjs"
   compatibility_date = "2025-02-01"
   ```

---

### [Step 2] Cloudflare D1 데이터베이스 및 R2 버킷 생성 (2분)

1. D1 데이터베이스 생성:
   ```bash
   npx wrangler d1 create coinpulse-db
   ```
   생성된 `database_id`를 `wrangler.toml`의 `[[d1_databases]]` 섹션에 반영합니다.

2. 미디어 업로드용 R2 버킷 생성:
   ```bash
   npx wrangler r2 bucket create coinpulse-media
   ```
   생성된 버킷명을 `wrangler.toml`의 `[[r2_buckets]]` 섹션에 반영합니다.

---

### [Step 3] D1 초기 스키마 및 마이그레이션 실행 (2분)

마스터 엔진은 자동 테이블 생성 및 자가 복구(Auto-Migration) 기능을 포함하고 있으나, 즉각적인 초기화를 위해 아래 스크립트를 실행합니다:
```bash
# 로컬 테스트용
npx wrangler d1 execute coinpulse-db --local --command "SELECT 1"

# 운영(Production) D1 배포
npx wrangler d1 execute coinpulse-db --remote --file=./schema.sql
```
*Note: `site_settings`, `articles`, `categories`, `media_assets`, `login_attempts` 테이블은 첫 API 호출 시 자동 생성되므로 누락 시에도 안전합니다.*

---

### [Step 4] 관리자 부트스트랩 계정 및 시크릿 설정 (2분)

1. 초기 관리자 비밀번호를 안전하게 설정:
   ```bash
   npx wrangler secret put ADMIN_BOOTSTRAP_PASSWORD
   # 프롬프트에 강력한 비밀번호 입력 (예: ComplexPass#2026!)
   ```

2. 세션 암호화 키 설정:
   ```bash
   npx wrangler secret put SESSION_SECRET
   ```

3. AI 기사 생성용 Gemini / Claude API Key 설정 (선택):
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```

---

### [Step 5] 빌드, 배포 및 자체 도메인 라우팅 (2분)

1. 프론트엔드 프로덕션 빌드:
   ```bash
   cd checkin-daily/frontend
   npm.cmd run build
   ```

2. Cloudflare Edge Workers 실서버 배포:
   ```bash
   npx.cmd wrangler deploy
   ```

3. 자체 도메인(Custom Domain) 연결:
   Cloudflare Dashboard -> Workers & Pages -> `coinpulse-daily` -> Settings -> Domains & Routes:
   - Add Custom Domain: `news.coinpulse.io` 또는 `coinpulsedaily.com`
   - SSL/TLS: Automatic Universal SSL (1분 이내 발급 완료)

---

## 3. 전략적 트래픽 전달 파이프라인 (Strategic Affiliate Traffic Pipeline)

마스터 엔진의 핵심 수익 모델은 기사 본문과 하단에 **고효율 문맥 매칭 CTA(Affiliate Banner)**를 노출하여 자매 플랫폼으로의 이탈 없는 고전환 트래픽을 전달하는 것입니다.

### 문맥 기반 자동 타겟팅 알고리즘 (`frontend/server/utils/ai-generator.ts`)
기사 본문의 키워드를 정밀 분석하여 연관 플랫폼의 배너와 인라인 링크를 100% 자동 배치합니다:

| 도메인 | 기사 감지 키워드 | 전환 타겟 플랫폼 | 배너 문구 |
|---|---|---|---|
| **Travel** | 항공권, 노선, 특가, 공항, 발권, 호텔 | **트립스캐너 (TripScanner)** | "실시간 전 세계 최저가 항공권 & 호텔 가격 비교" |
| **Travel** | 투어, 액티비티, 입장권, 비자, eSIM | **겟포트립 (GetForTrip)** | "현지 투어·입장권·eSIM 최저가 즉시 예약" |
| **Coin** | 비트코인, 이더리움, 거래소, 시세, 김프 | **코인스캐너 (CoinScanner)** | "실시간 거래소 호가 & 김치프리미엄 1초 비교" |
| **Coin** | 온체인, 고래, 디파이, 덱스, 에어드랍 | **덱스레이더 (DexRadar)** | "스마트머니 지갑 추적 & 신규 유동성 풀 스나이핑" |
| **Stock** | 나스닥, 코스피, 삼성전자, 실적, 수급 | **스탁스캐너 (StockScanner)** | "글로벌 대형주 실시간 밸류에이션 & 기관 수급 포착" |
| **Stock** | ETF, 배당, 슈드, 채권, 월배당 | **ETF파인더 (ETFFinder)** | "국내외 배당 & 테마 ETF 총보수 비교 및 포트폴리오 설계" |

---

## 4. 기사 생성 엔진 규격 준수 (AI Engine Calibration)

새 도메인 클론 시에도 아래 품질 기준이 코드 레벨에서 강제됩니다:

1. **텍스트 글자수 엄격 제한:** 공백 제외 **300자 이상 1,000자 이하** (검색엔진 최적화 및 모바일 가독성 최적화).
2. **본문 이미지 탑재 규격:** 기사당 **4장 이상 10장 이하** 고해상도 WebP 이미지 필수 삽입.
3. **WebP 자동 경량화 파이프라인:** 업로드 시 클라이언트 측에서 1600px 리사이즈 및 82% WebP 압축(용량 85% 절감, D1/R2 성능 극대화).
4. **완전한 저널리즘 포맷:** 리드 단락(Lead) -> 핵심 사실(Fact Sheet) -> 데이터/수치 분석 -> 공식 입장/전망 -> 문맥 매칭 전환 CTA.

---

## 5. 무결점 검증 체크리스트 (Post-Deployment Verification)

배포 직후 터미널에서 다음 명령어로 100% 정상 작동을 확인합니다:

```bash
# 1. 헬스 체크
curl -s -o /dev/null -w "%{http_code}" https://<your-worker-url>/api/health
# 출력: 200

# 2. RSS 2.0 피드 유효성 검증
curl -s https://<your-worker-url>/rss.xml | grep "<rss version="

# 3. 사이트맵 및 검색엔진 색인 확인
curl -s https://<your-worker-url>/sitemap.xml | grep "<urlset"
curl -s https://<your-worker-url>/robots.txt | grep "Sitemap:"

# 4. Content-Security-Policy 및 보안 헤더 검증
curl -I https://<your-worker-url>/news | grep -E "Content-Security-Policy|X-Frame-Options"

# 5. 기사 목록 페이지네이션 검증
curl -s "https://<your-worker-url>/api/articles?page=1&limit=5" | grep "total_pages"
```

모든 단계가 정상 통과하면 즉시 상용 트래픽을 안전하게 수신할 수 있습니다.

