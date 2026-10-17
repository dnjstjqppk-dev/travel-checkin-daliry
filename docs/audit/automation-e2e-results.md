# CHECK-IN DAILY — 자동화 파이프라인 E2E 시나리오 테스트 결과 보고서
**문서 ID:** `AUDIT-DOC-12`  
**발행일:** 2026년 10월 17일  
**테스트 환경:** Cloudflare Workers Runtime & Remote D1 (`checkin-daily-db`)

---

## 1. 개요 및 테스트 목적
편집국 자동화 파이프라인의 안전성, 사실 검증 절차, 기사 예약 및 철회, 다국어 동기화가 실제 운영 환경에서 결함 없이 동작하는지 26개 전수 시나리오를 통해 E2E 검증을 수행하였습니다.

---

## 2. 26대 E2E 시나리오 테스트 결과 매트릭스

| 번호 | 검증 시나리오 | 검증 내용 및 입력값 | 기대 결과 | 실제 테스트 결과 | 판정 |
|---|---|---|---|---|---|
| **01** | 관리자 로그인 | `/admin/login` 정상 계정/비밀번호 입력 | 8시간 세션 발급 및 `/admin/dashboard` 이동 | 정상 세션 발급 및 대시보드 진입 성공 | **PASS** |
| **02** | 새 출처 등록 | `tat_news` (https://www.tatnews.org/feed/) | D1 `news_sources` 테이블 정상 적재 | 정상 등록 및 파싱 주기 설정 완료 | **PASS** |
| **03** | 출처 검증 (SSRF) | `http://127.0.0.1:8080` 등록 시도 | 사설 IP 검증 실패로 등록 차단 (HTTP 400) | Forbidden host address 차단 정상 | **PASS** |
| **04** | RSS 수집 실행 | `/api/cron/crawl` 트리거 실행 | 피드 파싱 및 신규 XML 엔트리 추출 | 5개 신규 아이템 파싱 및 D1 적재 | **PASS** |
| **05** | 기사 후보 생성 | 피드 엔트리 기반 `candidate` 생성 | `feed_ingestion_items`에 비중복 항목 적재 | `processed_to_draft = 1` 갱신 | **PASS** |
| **06** | 중복 기사 차단 | 동일 GUID/URL 2회차 인입 시도 | SHA-256 해시 대조로 중복 감지 및 건너뛰기 | duplicate_count 증가 및 중복 차단 | **PASS** |
| **07** | AI 초안 생성 | 키워드 기반 자동 기사 생성기 작동 | 공백 포함 300~1,000자 규격 기사 작성 | 560자 본문 및 마크다운 헤딩 생성 | **PASS** |
| **08** | 원문 근거 대조 | 1차 출처 및 증빙 URL 대조 | `article_citations` 테이블 레코드 생성 | TAT 공식 URL과 1:1 바인딩 확인 | **PASS** |
| **09** | 사실검증 실패 처리 | 고위험 키워드(사망, 사고) 포함 기사 | 자동 발행 차단 및 `needs_review` 이관 | 검토 대기열(`/admin/review`) 격리 확인 | **PASS** |
| **10** | 기사 본문 수정 | `/admin/articles/:id`에서 본문 문장 편집 | 수정 내역 저장 및 `updated_at` 갱신 | 본문 정상 수정 및 타임스탬프 갱신 | **PASS** |
| **11** | 검토 요청 | 취재기자 작성 후 데스크 검토 요청 | `review_status = 'needs_review'` 전환 | 검토 대기열에 알림 표시 | **PASS** |
| **12** | 데스크 기사 승인 | `/admin/review`에서 [최종 승인] 클릭 | `review_status = 'approved'`, 상태 전환 | 원자적 승인 완료 | **PASS** |
| **13** | 예약 발행 등록 | 특정 일시(`scheduled_at`) 지정 승인 | `publish_jobs` 큐에 pending 작업 등록 | 예약 큐(`/admin/schedules`) 등재 | **PASS** |
| **14** | 예약 발행 취소 | `/admin/schedules`에서 [취소] 클릭 | 작업 상태 `cancelled` 전환 | 자동 발행 배포 차단 완료 | **PASS** |
| **15** | 즉시 공개 배포 | [즉시 발행] 액션 실행 | `status = 'published'`, `first_published_at` 고정 | 공개 사이트에서 즉시 노출 확인 | **PASS** |
| **16** | 공개 기사 확인 | `/news/:cat/article/:id` 직접 URL 접근 | 바이라인, 출처 박스, 제휴 CTA 정상 렌더링 | HTTP 200 및 신문사 UI 렌더링 확인 | **PASS** |
| **17** | 5개국어 번역 생성 | 기사 발행 시 자동 다국어 번역 동기화 | `article_translations` (en, zh, th, vi, es) 적재 | 5개 언어 번역 레코드 100% 생성 | **PASS** |
| **18** | 번역 검토 | `/en/news/...`, `/th/news/...` 접근 | 해당 국가 언어로 제목 및 본문 렌더링 | 고유명사 및 통화 정합성 확인 | **PASS** |
| **19** | 기사 정정 고지 | `/api/corrections/request` 접수 및 반영 | 본문에 '⚠️ 기사 정정 고지' 배너 노출 | 정정 일시 및 전후 문장 표시 확인 | **PASS** |
| **20** | 기사 비공개 철회 | 기사 상세에서 [기사 철회] 클릭 및 사유 입력 | `status = 'draft'`, `review_status = 'retracted'` | 일반 독자 접근 차단 및 철회 사유 보존 | **PASS** |
| **21** | 사이트맵 자동 갱신 | `/sitemap.xml` 및 `/rss.xml` 확인 | 신규 발행 기사 URL 및 피드 아이템 자동 포함 | XML 파싱 및 최신 일자 반영 확인 | **PASS** |
| **22** | 발행 실패 재시도 | API 타임아웃 모의 장애 주입 | `attempts` 카운트 증가 및 지수 백오프 | 재시도 후 정상 복구 확인 | **PASS** |
| **23** | 반복 실패 격리 | 비정상 피드 URL 호출 시도 | 해당 출처 `error_count` 증가 및 작업 격리 | 전체 수집 프로세스 중단 없이 격리 | **PASS** |
| **24** | 킬스위치 긴급 가동 | `/admin/automation` 킬스위치 ON | 모든 백그라운드 수집 및 AI 작성 올스톱 | 파이프라인 즉시 안전 정지 확인 | **PASS** |
| **25** | 권한 검증 (RBAC) | 비인증 상태로 `/api/admin/*` 호출 | 세션 토큰 부재로 HTTP 401 Unauthorized 반환 | 비인가 접근 전면 차단 확인 | **PASS** |
| **26** | 불변 감사 로그 확인 | `/admin/logs` 감사 대시보드 확인 | 관리자 행위 스냅샷 및 JSON 페이로드 보존 | 100건 이상의 전체 감사 로그 열람 성공 | **PASS** |

---

## 3. 최종 평가
전체 26대 시나리오가 100% 성공(Pass Rate: 100%)하여 상용 뉴스룸 운영을 위한 모든 파이프라인이 결함 없이 검증되었습니다.
