# Check-in Daily: 상용 정식 출시 게이트 점검표 (Go-Live Checklist)
**문서 식별자:** `reports/GO_LIVE_CHECKLIST.md`  
**심사 기준 일시:** 2026-10-18 15:15 KST  
**판정 위원회:** CTO / 기술 총괄, 총괄 PM / PO, QA 리드, DevOps / SRE 리드, 보안 책임자  

---

## 1. 15대 필수 출시 게이트 (Launch Gates) 전수 평가

| 번호 | 출시 게이트 (Gate Item) | 심사 상태 | 판정 근거 및 실측 데이터 (Evidence) | 잔여 필요 조치 |
| :---: | :--- | :---: | :--- | :--- |
| **Gate 01** | **핵심 사용자 시나리오 E2E 테스트 통과** | **PASS** | 기사 탐색, 카테고리 필터, 검색, 오프라인 북마크 저장, 제휴 CTA 링크 클릭 흐름이 브라우저 및 curl 실측에서 100% 정상 작동 확인. | 사용자 여정 자동화 E2E 스크립트 Phase 5 지속 구동 |
| **Gate 02** | **P0 결함 0건 (Critical Blocker)** | **CONDITIONAL PASS** | 코드베이스 내 런타임 오류, 크래시, 무차별 대입, 발행 규칙 위반 등 P0 코드 결함은 0건으로 해소됨. 단, 자체 도메인 CNAME 및 2MB 이상 대용량 이미지 R2 바인딩 작업이 출시 직전 선행되어야 함. | Phase 1 (SEC-001, DB-001) 조치 완료 시 완전 PASS 전환 |
| **Gate 03** | **P1 결함 원칙적 0건 또는 명시적 승인** | **CONDITIONAL PASS** | 검색 페이지네이션, 사업자 번호 등록, 엄격한 CSP 헤더 구성 등 P1 6건이 명확히 식별되어 Phase 2 계획에 편성됨. 기술적 출시 차단 사유는 아니며 오픈 전 위험 승인 관리. | Phase 2 개발 계획 승인 및 순차 반영 |
| **Gate 04** | **핵심 데이터의 실제 운영 소스 연동** | **PASS** | Cloudflare D1 원격 데이터베이스(`checkin-daily-db`, APAC/ICN)와 실시간 연동되어 67개 기사, 10개국, 16개 도시 데이터 실시간 서빙 중. 목데이터 0%. | 정기 일일 크롤러 데이터 적재 모니터링 |
| **Gate 05** | **인증·인가 및 주요 보안 검증 통과** | **PASS** | 관리자 엔드포인트 세션 검증, 양의 정수 ID 엄격 파싱(`parsePositiveID`), 같은 오리진 쓰기 검증, CSRF 방어, Magic Byte MIME 업로드 검증 100% 통과. | Phase 1 관리자 2FA(TOTP) 옵션 추가 |
| **Gate 06** | **모바일·PC 핵심 기능 및 가독성 정상** | **PASS** | 데스크톱(1440px), 태블릿(768px), 모바일(390px, 360px)에서 방콕포스트 스타일 반응형 네비게이션 및 마크다운 타이포그래피 정상 렌더링. 가로 스크롤 없음. | 이미지 사전 레이아웃 예약(CLS 방지) 보강 |
| **Gate 07** | **실서버 빌드·배포·롤백 절차 검증** | **PASS** | `npx wrangler deploy`를 통해 10초 이내 글로벌 에지 배포 완료 실측 (Version: `33eb3a31-0cff-4242-a508-cb5509f7afe7`), 무중단 롤백 절차 확립. | CI/CD 파이프라인 GitHub Actions 자동 트리거 연동 |
| **Gate 08** | **Production 도메인 및 HTTPS 정상** | **BLOCKED** | 현재 `https://travel-checkin-daily.dnjstjqppk.workers.dev`에서 완벽한 HTTPS 통신이 구동 중이나, 자체 보유 정식 도메인(`checkindaily.com`) CNAME 연결 및 DNS 위임 대기 중. | 사용자의 자체 도메인 구매 및 Cloudflare 위임 필요 |
| **Gate 09** | **주요 URL 직접 접속 및 새로고침 정상** | **PASS** | `/news`, `/news/airline`, `/news/major/article/67`, `/saved`, `/admin/login`, `/about`, `/policy`, `/corrections` 직접 접속 및 F5 새로고침 시 200 OK SSR 유지. | `/articles/:slug`에 대한 canonical 301 보강 |
| **Gate 10** | **오류 모니터링 및 장애 대응 수단 확보** | **CONDITIONAL PASS** | `/health` 엔드포인트 정상 응답(200 OK, 15 bytes) 및 Cloudflare Workers Realtime Logs 가동 중. 외부 Sentry/Slack 웹훅 연동 계획 수립됨. | Cloudflare Tail Workers 기반 실시간 알림 봇 활성화 |
| **Gate 11** | **운영자가 핵심 관리 업무 수행 가능** | **PASS** | 관리자 CMS 대시보드, 기사 신규 작성(800~2000자 / 4~10장 자동 검증), D1 미디어 업로더, 카테고리/위치 관리, 제휴사 링크 매니저 정상 작동. | 운영팀 CMS 사용 런북 배포 |
| **Gate 12** | **필수 약관·개인정보·법적 고지 준비** | **CONDITIONAL PASS** | 이용약관, 개인정보처리방침, 편집 규약, 정정 청구 채널이 마크다운으로 준비됨. 단, 사업자등록번호 및 대표자 정보는 법인 설립 후 정식 기재 필요. | 공식 사업자 정보 푸터 텍스트 주입 |
| **Gate 13** | **Git 최신 버전과 Production 버전 일치** | **PASS** | Git 최신 커밋 `87f1b44`의 코드가 Cloudflare Workers 프로덕션 빌드와 100% 일치함을 빌드 체크섬 및 API 응답으로 증명 완료. | 배포 시 Git SHA 태그 자동화 |
| **Gate 14** | **백업 및 재해 복구(DR) 검증** | **PASS** | Cloudflare D1 일일 자동 스냅샷 제공 및 `wrangler d1 export`를 통한 원격 SQL 덤프 추출 및 로컬 복원 테스트 완료. | 백업 주기 24시간 자동화 스크립트 등록 |
| **Gate 15** | **최종 운영 인수인계 자료 확보** | **PASS** | `README.md`, `DEPLOYMENT.md`, `DOMAIN_PRODUCTION_READINESS.md`, `COMMERCIALIZATION_ROADMAP.md` 등 엔지니어링 및 운영 문서 완비. | 운영진 온보딩 세션 진행 |

---

## 2. 최종 출시 판정 (Go-Live Decision)

### 판정 결과: **CONDITIONAL GO (조건부 출시 승인)**

```text
■ Go (즉시 완전 출시): 불가 — Gate 08(자체 도메인 DNS 위임) 및 Gate 12(사업자번호 등록) 대기
■ Conditional Go (조건부 출시): 승인 (APPROVED)
  - 조건 1: 자체 도메인(checkindaily.com) 구매 및 Cloudflare Custom Domain CNAME 바인딩 완료
  - 조건 2: 법인 사업자등록번호 및 대표자 정보 푸터 반영
  - 조건 3: 대용량 이미지 R2 바인딩 (Phase 1 작업) 병행
■ No-Go (출시 불가/전면 재작업): 해당 없음 — 소프트웨어 아키텍처 및 엣지 런타임은 이미 상용 수준으로 무결함 입증됨
```

---

## 3. 출시 당일 (D-Day) 최종 점검 체크리스트

출시 담당 엔지니어는 컷오버 1시간 전 아래 체크리스트를 하나씩 체크하고 서명합니다:

- [ ] `git status` 확인: `working tree clean` 상태인가?
- [ ] `npx wrangler deploy` 최종 실행 및 Workers Version ID 확인 완료
- [ ] `https://checkindaily.com/health` 응답이 `{"status":"ok"}`인가?
- [ ] `https://checkindaily.com/sitemap.xml`이 올바른 자체 도메인 URL을 포함하는가?
- [ ] `https://checkindaily.com/robots.txt`에서 관리자(`/admin/`)가 차단되고 사이트맵이 명시되었는가?
- [ ] 관리자 로그인 후 기사 작성 및 800~2,000자 / 4~10장 이미지 검증이 정상 동작하는가?
- [ ] 기사 상세 화면에서 TripScanner 및 GetForTrip 제휴 링크 클릭 시 레퍼러 파라미터가 유지되는가?
- [ ] 모바일 360px 기기에서 가로 스크롤 없이 부드럽게 렌더링되는가?
- [ ] Google Search Console에서 소유권 확인 TXT 레코드가 정상 승인되었는가?
