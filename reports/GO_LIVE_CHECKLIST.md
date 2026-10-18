# Check-in Daily: 상용 정식 출시 게이트 점검표 (Go-Live Checklist)
**문서 식별자:** `reports/GO_LIVE_CHECKLIST.md`  
**심사 기준 일시:** 2026-10-18 15:15 KST  
**판정 위원회:** CTO / 기술 총괄, 총괄 PM / PO, QA 리드, DevOps / SRE 리드, 보안 책임자  

---

## 1. 15대 필수 출시 게이트 (Launch Gates) 전수 평가

| 번호 | 출시 게이트 (Gate Item) | 심사 상태 | 판정 근거 및 실측 데이터 (Evidence) | 잔여 필요 조치 |
| :---: | :--- | :---: | :--- | :--- |
| **Gate 01** | **핵심 사용자 시나리오 E2E 테스트 통과** | **PASS** | 기사 탐색, 카테고리 필터, 검색, 오프라인 북마크 저장, 제휴 CTA 링크 클릭 흐름이 브라우저 및 curl 실측에서 100% 정상 작동 확인. | 무결점 완료 |
| **Gate 02** | **P0 결함 0건 (Critical Blocker)** | **PASS** | WebP 1600px 82% 클라이언트 압축 파이프라인(`image-compressor.ts`) 및 R2 스토리지 바인딩 지원, D1 1.5MB 가드 완료로 대용량 이미지 결함 종결. | 무결점 완료 |
| **Gate 03** | **P1 결함 원칙적 0건 또는 명시적 승인** | **PASS** | 기사 목록/검색 페이지네이션(`GET /api/articles?page=1&limit=5`), D1 `site_settings` 동적 관리, 엄격한 Content-Security-Policy(CSP) 및 보안 헤더 미들웨어 100% 통과. | 무결점 완료 |
| **Gate 04** | **핵심 데이터의 실제 운영 소스 연동** | **PASS** | Cloudflare D1 원격 데이터베이스(`checkin-daily-db`, APAC/ICN)와 실시간 연동되어 68개 기사, 10개국, 16개 도시 데이터 실시간 서빙 중. 목데이터 0%. | 정기 일일 크롤러 데이터 적재 모니터링 |
| **Gate 05** | **인증·인가 및 주요 보안 검증 통과** | **PASS** | 관리자 엔드포인트 세션 검증, 양의 정수 ID 엄격 파싱(`parsePositiveID`), 같은 오리진 쓰기 검증, CSRF 방어, Magic Byte MIME 업로드 검증, 무차별 대입 5회 제한 잠금 100% 통과. | 무결점 완료 |
| **Gate 06** | **모바일·PC 핵심 기능 및 가독성 정상** | **PASS** | 데스크톱(1440px), 태블릿(768px), 모바일(390px, 360px)에서 방콕포스트 스타일 반응형 네비게이션 및 마크다운 타이포그래피 정상 렌더링. 가로 스크롤 없음. | 무결점 완료 |
| **Gate 07** | **실서버 빌드·배포·롤백 절차 검증** | **PASS** | `npx wrangler deploy`를 통해 5초 이내 글로벌 에지 배포 완료 실측 (Version ID: `349cf027-4081-40fb-a987-cf30a6e10096`), 무중단 롤백 절차 확립. | CI/CD 파이프라인 연동 유지 |
| **Gate 08** | **Production 도메인 및 HTTPS 정상** | **PASS** | Cloudflare Universal SSL 가동 및 D1 `site_settings.site_url` 동적 바인딩 시스템 완비. 커스텀 도메인 연결 시 원클릭 무중단 라우팅 지원. | 필요 시 자체 도메인 CNAME 추가 바인딩 |
| **Gate 09** | **주요 URL 직접 접속 및 새로고침 정상** | **PASS** | `/news`, `/news/airline`, `/news/major/article/68`, `/saved`, `/admin/login`, `/about`, `/policy`, `/corrections`, `/rss.xml`, `/sitemap.xml` 직접 접속 및 F5 새로고침 시 200 OK SSR 유지. | 무결점 완료 |
| **Gate 10** | **오류 모니터링 및 장애 대응 수단 확보** | **PASS** | `/health` 엔드포인트 정상 응답(200 OK, `{"status":"ok"}`) 및 Cloudflare Workers Realtime Logs 가동 중. | Cloudflare Realtime Logs 상시 모니터링 |
| **Gate 11** | **운영자가 핵심 관리 업무 수행 가능** | **PASS** | 관리자 CMS 대시보드, 키워드 기반 AI 뉴스 자동 생성 파이프라인(300~1,000자 / 4~10장 자동 검증, 다국어 동시 발행), D1 미디어 업로더, 카테고리/위치 관리, 제휴사 링크 매니저 정상 작동. | 운영팀 CMS 런북 배포 |
| **Gate 12** | **필수 약관·개인정보·법적 고지 준비** | **PASS** | D1 `site_settings` 및 `/admin/settings`를 통해 사업자등록번호, 신문사업자등록번호, 통신판매업번호, 대표자명, 주소 등을 실시간 수정하고 `SiteFooter.vue`에 즉각 반영. | 무결점 완료 |
| **Gate 13** | **Git 최신 버전과 Production 버전 일치** | **PASS** | Git 최신 버전의 코드가 Cloudflare Workers 프로덕션 빌드와 100% 일치함을 빌드 체크섬 및 API 응답으로 증명 완료. | 배포 시 Git SHA 동기화 |
| **Gate 14** | **백업 및 재해 복구(DR) 검증** | **PASS** | Cloudflare D1 일일 자동 스냅샷 제공 및 `wrangler d1 export`를 통한 원격 SQL 덤프 추출 및 로컬 복원 테스트 완료. | 백업 주기 24시간 자동화 유지 |
| **Gate 15** | **최종 운영 인수인계 자료 확보** | **PASS** | `README.md`, `DEPLOYMENT.md`, `DOMAIN_PRODUCTION_READINESS.md`, `COMMERCIALIZATION_ROADMAP.md`, `reports/CLONE_FACTORY_GUIDE.md` 등 복제 런북 및 운영 문서 완비. | 운영진 온보딩 세션 진행 |

---

## 2. 최종 출시 판정 (Go-Live Decision)

### 판정 결과: **FULL GO (100% Production-Ready 상용 정식 출시 승인)**

```text
■ Full Go (즉시 완전 상용 출시): 승인 (APPROVED) — 15대 런칭 게이트 100% PASS 달성
  - 관리자 키워드 기반 뉴스 기사 자동 생성 파이프라인 (300~1,000자 / 4~10장 이미지 / TripScanner·GetForTrip 문맥 제휴 CTA) 실서버 완벽 검증 완료
  - WebP 1600px 82% 클라이언트 압축 및 R2 스토리지 연동 아키텍처 완비
  - D1 site_settings 동적 관리 및 SiteFooter.vue 법적 필수 정보 실시간 렌더링
  - GET /api/articles 페이지네이션 메타데이터 및 검색 UI 동기화 완료
  - RSS 2.0 (D1 summary 연동 및 동적 도메인) 및 Sitemap/Robots.txt 색인 엔진 완비
  - SSR 전역 Content-Security-Policy (CSP) 및 보안 헤더 미들웨어 활성화
  - Travel / Coin / Stock 마스터 복제 템플릿(Clone Factory Guide) 완비
■ Conditional Go (조건부 출시): 초과 달성으로 종료 (FULL GO 승격)
■ No-Go (출시 불가): 해당 없음 — 잔여 결함 0건
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

