# CHECK-IN DAILY — 데이터 무결성 및 콘텐츠 포렌식 감사 보고서
**문서 ID:** `AUDIT-DOC-02`  
**감사 대상:** 콘텐츠 일관성, 타임스탬프 왜곡, 팩트체크 증빙, 조회수 무결성, 환율 데이터 신뢰성  
**발행일:** 2026년 10월 17일  
**감사관:** Check-in Daily 시스템 아키텍트 & 데이터 포렌식 팀

---

## 1. 개요 및 감사 배경
Check-in Daily 플랫폼의 상용화 및 마스터 아키텍처화를 위한 전수 데이터 감사 결과, 기존 시스템에서 발견된 5대 핵심 결함(일자 왜곡, 근거 없는 수치, 난수 조회수, 환율 시각 왜곡, 껍데기 UI)을 포렌식 조사하고, 이를 영구적으로 방지하기 위한 D1 스키마 확장 및 백엔드 로직 재구축을 완료하였습니다.

---

## 2. 결함별 정밀 분석 및 수정 내역 (Defect Tracking)

### [결함 2-1] 기사 발행일 및 수정 시각 불일치 (Timestamp Drift)
- **결함 ID:** `DEFECT-001` (우선순위: P0 - Critical)
- **현상:** 동일 기사(예: 항공 화물 수요 기사)가 목록에서는 2026년 10월 15일로 표시되나, 상세 페이지에서 2026년 1월 29일로 조회되는 등 조회 시점 및 캐시 상태에 따라 발행 시각이 뒤바뀌는 현상 발생.
- **원인 분석:**
  1. 기사 엔터티에 `published_at`과 `created_at` 단일 필드만 존재하여, AI 재작성 또는 번역 스크립트 실행 시 `published_at`이 `CURRENT_TIMESTAMP`로 덮어쓰기됨.
  2. 상세 뷰 컴포넌트(`ArticleDetailView.vue`) 내에 `if (!date) return '14 OCT 2026'`와 같은 하드코딩된 Fallback 코드가 존재하여 DB 조회 지연 시 잘못된 일자가 독자에게 렌더링됨.
- **조치 및 수정 내용:**
  1. D1 데이터베이스 스키마 확장(`0006_forensic_pipeline.sql`):
     - `source_first_published_at`: 원문 언론사/기관 최초 게시 시각
     - `source_updated_at`: 원문 수정 시각
     - `first_published_at`: Check-in Daily 최초 공개 배포 시각 (불변 필드)
     - `updated_at`: Check-in Daily 본문 수정 시각
     - `ingested_at`: RSS/API 수집 시각
     - `fact_checked_at`: 팩트체크 검증 완료 시각
  2. 기존 66개 전체 기사에 대해 `first_published_at`을 일괄 영구 고정(Backfill).
  3. `ArticleDetailView.vue` 내 하드코딩 제거 및 `PUBLISHED : [최초게시일] | UPDATED : [수정일] | FACT-CHECKED : [검증일]` 3중 타임스탬프 체계 구현.
  4. Google News Schema.org JSON-LD의 `datePublished`와 `dateModified`를 실제 DB 필드와 1:1 매핑.

---

### [결함 2-2] 기사 수치 및 정책 주장의 사실 검증 결여 (Hallucination Risk)
- **결함 ID:** `DEFECT-002` (우선순위: P0 - Critical)
- **현상:** 항공 수요 증가율(14.8%), 호텔 예약률, 비자 발급 통계 등 구체적 숫자가 원문 1차 출처 검증 없이 AI에 의해 생성될 위험 노출.
- **원인 분석:**
  - 기사 테이블에 1차 공식 출처(`source_url`)와 검증 근거를 연결하는 구조화된 팩트체크 메타데이터 테이블 부재.
- **조치 및 수정 내용:**
  1. 관계형 검증 테이블 활성화 및 원격 D1 마이그레이션 적용:
     - `article_fact_checks`: 개별 주장(Claim), 검증 상태(Verified / Unverified / Disputed), 증빙 원문 URL(`evidence_url`), 검증자 기록
     - `article_citations`: 공식 1차 출처명, 출처 URL, 라이선스 유형 기록
  2. 본문 상단에 **'✓ FACT CHECKED' 공식 인증 박스** 탑재:
     - 1차 공식 발표 주체(예: 태국관광청 TAT, 태항공항공국 AOT, IATA) 및 원문 증빙 링크를 독자에게 투명하게 공개.
  3. 인명 사고, 전쟁, 테러 등 고위험 키워드 감지 시 자동 발행 차단 및 사람 편집자 승인 큐(`review_status = 'needs_review'`) 강제 라우팅.

---

### [결함 2-3] 임의 난수(Fake) 조회수 생성 로직
- **결함 ID:** `DEFECT-003` (우선순위: P0 - Critical)
- **현상:** 자동 수집 스크립트(`crawl.post.ts`) 내 `Math.floor(Math.random() * 200) + 50` 코드로 가짜 조회수가 삽입되고 있었음.
- **원인 분석:** 초기 목업 단계에서 작성된 임의 수치 코드가 방치됨.
- **조치 및 수정 내용:**
  1. `crawl.post.ts` 내 모든 난수 조회수 코드 영구 삭제 (초기 조회수 0 고정).
  2. `analytics_events` 테이블 신설: `event_type = 'page_view'`, `bot_classification = 'human' | 'crawler'` 구분 저장.
  3. `d1-api.ts`의 `incrementArticleView` 함수에 User-Agent 검사 엔진 탑재:
     - Googlebot, Bingbot, Yandex, 웹 크롤러의 요청은 `bot_classification = 'crawler'`로 기록하고 실제 기사 `view_count`를 절대 증가시키지 않음.
     - 검증된 인간 독자의 실제 조회 이벤트만 카운트 증가.

---

### [결함 2-4] 환율 위젯의 '실시간' 허위 표기 및 갱신 주기 불일치
- **결함 ID:** `DEFECT-004` (우선순위: P1 - High)
- **현상:** 1시간 단위 캐시 데이터임에도 화면에 '실시간 (LIVE)' 배지로 표기되어 실제 외환 시장 호가와 시차가 발생함.
- **원인 분석:** 공급자(`open.er-api.com`)는 일일/시간 단위 고시 환율을 제공하는데, UI에서 '실시간'이라는 상업적 용어를 오용함.
- **조치 및 수정 내용:**
  1. `CurrencyRates.vue`의 '실시간 (LIVE)' 배지를 **'공식 고시 (MARKET)'**로 수정.
  2. 툴팁 및 푸터에 **'기준시각: YYYY-MM-DD HH:mm (1시간 주기 캐시 갱신)'** 명확히 고시.
  3. 새로고침 버튼 툴팁을 '실시간 환율 새로고침'에서 '환율 데이터 새로고침'으로 정정.

---

### [결함 2-5] 검색, 스크랩북, 번역의 작동 일관성
- **결함 ID:** `DEFECT-005` (우선순위: P1 - High)
- **점검 결과:**
  1. **검색:** D1 `LIKE %keyword%` 쿼리와 프론트엔드 연동 정상 작동 확인.
  2. **스크랩북:** `localStorage` 기반 상태 관리(`useSavedStore`)와 `/saved` 화면 간의 토글 및 영구 보존 정상 작동 확인.
  3. **번역:** `article_translations` 테이블과 `/en`, `/zh`, `/th`, `/vi`, `/es` 라우트 연동 및 fallback 체계 정상 작동 확인.

---

## 3. 포렌식 감사 결론
상기 5대 핵심 결함은 원격 Cloudflare D1 데이터베이스 마이그레이션(`0004`, `0005`, `0006`) 및 프론트/백엔드 코드 전면 수정을 통해 100% 해소되었으며, 현재 운영 서버(`travel-checkin-daily.dnjstjqppk.workers.dev`)에 실시간 반영되어 완전한 데이터 무결성을 확보하였습니다.

