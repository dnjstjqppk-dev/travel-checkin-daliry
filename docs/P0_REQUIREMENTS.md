<USER_REQUEST>
# [P0 최종 통합 개발 지시서]
# Check-in Daily — Vue 3 + Go + Flutter 전체 전환, 뉴스 CMS 구축 및 Cloudflare 실배포

## 0. 프로젝트 정의

**플랫폼:** Check-in Daily (체크인데일리)

**현재 운영 URL:** https://travel-checkin-daily.dnjstjqppk.workers.dev/news

**플랫폼 유형:** 글로벌 여행 전문 뉴스·디지털 미디어 플랫폼

**공식 개발 기술:** Vue 3 + TypeScript / Go / Flutter + Dart

**인프라:** Cloudflare

**버전 관리:** 기존 공식 GitHub Repository

너는 이번 프로젝트의 Chief Software Architect, Senior Full-Stack Developer, Go Backend Engineer, Flutter Mobile Architect, Database Architect, Cloudflare Infrastructure Engineer, News CMS Architect, Editorial QA Lead다.

이번 작업은 현재 Check-in Daily의 전체 코드를 감사한 뒤, 공식 기술 스택으로 전환하고 글로벌 여행 뉴스 플랫폼에 필요한 전체 기능을 실제 구현하는 프로젝트다.

단순 뉴스 메인 화면이나 디자인 리뉴얼만 수행해서는 안 된다.

**뉴스 수집 → 원문·출처 검증 → 기사 작성·편집 → 승인 → 다국어 발행 → 독자 노출 → 검색·랭킹 → 모바일 알림 → 기사 정정·관리까지 전체 시스템을 구현하라.**

최종 작업 범위:

1. 기존 GitHub 및 Cloudflare 전체 감사
2. Vue 3 + Go + Flutter 기술 스택 표준화
3. 전체 데이터베이스 스키마 설계
4. 전체 기사·뉴스 데이터 관리 시스템 구현
5. 독자용 뉴스 포털 구현
6. 편집국 관리자 콘솔 구현
7. 외부 기고자·제휴사 콘솔 구현
8. Go 기반 뉴스 수집·검색·CMS API 구현
9. Flutter 독자·기자 모바일 앱 구현
10. 다국어 기사 관리 및 번역 시스템
11. 글로벌 SEO 및 Google News 최적화
12. 저작권·출처·팩트체크·편집 승인 체계
13. 환율·여행 데이터 등 외부 API 검증
14. 인증·권한·보안·로그 구현
15. 모바일·태블릿·PC 전수 QA
16. GitHub 전체 코드 Commit·Push
17. Cloudflare 개별 서비스 배포
18. GitHub ↔ Cloudflare CI/CD 자동 연동
19. 실제 운영 URL 전수 QA
20. 최종 결과 및 검증 자료 제출

---

# 1. 공식 기술 스택 강제

Check-in Daily의 공식 기술 스택을 아래와 같이 확정한다.

| 구분 | 필수 기술 |
|---|---|
| 독자용 뉴스 웹 | Vue 3 + TypeScript |
| 편집국 관리자 콘솔 | Vue 3 + TypeScript |
| 파트너·기고자 콘솔 | Vue 3 + TypeScript |
| Backend API | Go |
| 뉴스 수집·처리 엔진 | Go |
| 독자용 모바일 앱 | Flutter + Dart |
| 기자·기고자 모바일 앱 | Flutter + Dart |
| DB | 적합한 관계형 데이터베이스 |
| 인프라 | Cloudflare |

### 필수 원칙

- Vue 3 Composition API 및 TypeScript 사용
- Vue Router 및 Pinia 등 적합한 상태관리 적용
- Backend 핵심 비즈니스 로직은 Go 사용
- 모바일 앱은 Flutter 사용
- 모든 클라이언트는 공통 Go API 사용
- SQL, CSS, HTML 및 필수 인프라 코드는 허용
- Vue 개발·빌드용 Node.js 사용은 허용
- Cloudflare Gateway에 필요한 최소 JavaScript·TypeScript 코드 허용

기존 코드가 React, Next.js, Express, NestJS, Python, PHP 등 다른 핵심 스택이라면 해당 기능을 Vue 3 또는 Go로 전환한다.

기존 데이터와 정상 작동 중인 기능을 잃지 않도록 한다.

기존 기능을 대체할 준비가 되기 전에 운영 코드를 삭제하지 마라.

**파일명과 폴더명만 바꾸는 형식적인 기술 전환은 허용하지 않는다.**

---

# 2. GitHub Repository 및 소스코드 전체 감사

현재 Cloudflare Worker에 연결된 공식 GitHub Repository를 확인하라.

확인 대상:

- Git Remote
- GitHub Owner
- Repository Name
- Branch
- 최신 Commit SHA
- 현재 배포 Commit
- 기존 프론트엔드 구조
- Backend
- DB 스키마
- 뉴스 수집 시스템
- 관리자 로그인
- 기존 API
- Cloudflare 설정
- 모바일 앱 존재 여부
- CI/CD
- Secret 및 환경변수 설정

확인된 기존 공식 Repository를 계속 사용한다.

다른 프로젝트인 OpenMarket이나 getforTrip의 Repository를 사용하지 않는다.

공식 저장소를 확인할 수 없다면 임의 저장소에 Push하지 말고 BLOCKED 사유로 보고한다.

### 제출 문서

`docs/TECH_STACK_AUDIT.md`

필수 내용:

- 실제 사용 언어
- 현재 프레임워크
- 전환 대상 파일
- 현재 데이터베이스
- API 구조
- 현재 뉴스 수집 방식
- Cloudflare 배포 구조
- 기존 정상 기능
- 오류 및 미구현 기능
- 전환 완료 여부

감사 후 실제 코드 수정까지 진행한다.

---

# 3. Cloudflare 3개 콘솔 및 API 분리

현재 뉴스 사이트를 다음 4개 독립 서비스로 재구성하라.

## 3.1 Reader / Public News Portal

Worker Name:

`checkindaily-web`

역할:

독자용 글로벌 여행 뉴스 웹사이트

## 3.2 Admin / Editorial CMS

Worker Name:

`checkindaily-admin`

역할:

기사 편집·발행·팩트체크·언론사 운영을 위한 관리자 콘솔

## 3.3 Contributor / Partner Portal

Worker Name:

`checkindaily-partner`

역할:

외부 기자, 기고자, 제휴 언론사, 관광청 및 호텔·항공 PR 담당자의 자료 제출·관리 콘솔

## 3.4 Go Backend API

Worker/Gateway Name:

`checkindaily-api`

역할:

기사, 사용자, 인증, CMS, 뉴스 수집, 검색, 통계, 번역 및 모든 백엔드 비즈니스 로직

### Cloudflare 목표 URL 예시

```text
Reader
https://checkindaily-web.dnjstjqppk.workers.dev/

Admin
https://checkindaily-admin.dnjstjqppk.workers.dev/

Partner
https://checkindaily-partner.dnjstjqppk.workers.dev/

API
https://checkindaily-api.dnjstjqppk.workers.dev/
```

실제 Worker 이름과 URL은 기존 계정 내 충돌 및 배포 구조를 확인하여 결정한다.

커스텀 도메인은 소유권과 설정 권한이 확인될 때 연결한다.

### 기존 URL 유지

현재 URL:

https://travel-checkin-daily.dnjstjqppk.workers.dev/news

기존 기사 URL과 검색엔진에 노출된 URL을 유지하라.

필요하다면 새 리더 웹서비스로 연결하되 적절한 301 Redirect와 Canonical을 설정한다.

기존 기사 링크, 스크랩북, 카테고리 URL, 외부 공유 링크를 파괴하지 마라.

---

# 4. Vue 3 독자용 글로벌 뉴스 포털

현재 Check-in Daily 디자인을 기반으로 전문적인 글로벌 여행 언론사 웹사이트를 구현하라.

최소 구현해야 하는 전체 페이지:

## 4.1 뉴스 메인

- 뉴스 메인 홈페이지
- 주요 뉴스
- 헤드라인 뉴스
- 최신 뉴스
- 속보
- 실시간 인기 뉴스
- 에디터 추천
- 심층 분석
- 여행 트렌드
- 주요 국가·도시 뉴스
- 관련 기사 추천
- 인기 검색어
- 뉴스레터 구독
- 광고·스폰서 영역

## 4.2 뉴스 카테고리

- 항공
- 항공사
- 마일리지
- 공항
- 항공 안전
- 호텔
- 리조트
- 럭셔리 호텔
- 여행지
- 관광청
- 여행 산업
- 글로벌 OTA
- 여행 기술
- 기차·철도
- 렌터카·교통
- 크루즈
- 여행 정책
- 출입국·비자
- 여행 경보
- 여행 행사
- 여행 트렌드
- 데이터 분석
- 주요 보도
- 사설·칼럼
- 인터뷰

관리자가 카테고리를 추가·수정·정렬·비활성화할 수 있도록 한다.

## 4.3 기사 상세페이지

- 기사 제목
- 부제
- 대표 이미지
- 이미지 출처
- 작성자
- 기자 프로필
- 출처
- 최초 발행일
- 수정일
- 기사 본문
- 소제목
- 인용문
- 관련 자료
- 출처 링크
- 관련 기사
- 기사 공유
- 스크랩
- 글꼴 크기 조절
- 이전·다음 기사
- 정정·업데이트 안내
- 구조화 데이터

기사 페이지를 새로고침하거나 직접 URL로 접근해도 정상 출력되어야 한다.

## 4.4 검색

- 뉴스 통합 검색
- 검색 자동완성
- 기사 제목 검색
- 본문 검색
- 기자별 검색
- 카테고리별 검색
- 국가·도시별 검색
- 날짜별 검색
- 최신순·관련도순 정렬
- 검색 결과 없음
- 페이지네이션

검색 결과는 실제 DB 또는 검색 인덱스에서 가져온다.

## 4.5 국가·도시별 뉴스

- 대륙별 뉴스
- 국가별 뉴스
- 도시별 뉴스
- 국가·도시 필터
- 지역별 인기 기사
- 지역별 관련 기사

현재 `/news/region` 라우트를 분석하여 실제 지역별 필터링이 적용되는지 검증하라.

## 4.6 독자 서비스

- 회원가입
- 로그인
- 내 프로필
- 스크랩북
- 최근 읽은 기사
- 관심 분야
- 관심 국가
- 관심 항공사·호텔
- 뉴스 알림
- 뉴스레터 구독
- 언어 변경
- 다크모드
- 개인정보 설정
- 계정 탈퇴

비회원 스크랩도 지원할 수 있으나 로그인 시 안전하게 동기화되도록 한다.

---

# 5. Vue 3 편집국 관리자 CMS

기존 `/admin/login` 구조를 조사하여 별도의 관리자 웹서비스로 안전하게 이전하거나 연동하라.

관리자 콘솔은 다음 전체 기능을 지원해야 한다.

### 기사 CMS

- 관리자 대시보드
- 기사 작성
- 기사 수정
- 임시저장
- 기사 미리보기
- 예약 발행
- 발행 승인
- 즉시 발행
- 발행 취소
- 기사 숨김
- 기사 삭제 정책
- 기사 복원
- 기사 버전 관리
- 기사 변경 이력
- 정정 기사
- 관련 기사 설정
- 메인 헤드라인 설정

### 콘텐츠 관리

- 카테고리 관리
- 국가·도시 관리
- 태그 관리
- 기자·필진 관리
- 이미지·동영상
- 미디어 출처·저작권
- 번역 관리
- 검색 키워드
- SEO 메타데이터
- RSS 설정
- 뉴스레터 콘텐츠
- 배너·광고
- 사이트 공지

### 뉴스 소스 관리

- 뉴스 공급사 등록
- 공식 RSS 피드
- 공식 API
- 관광청 보도자료
- 항공사 보도자료
- 호텔·리조트 PR 자료
- 수집 결과
- 중복 기사
- 출처 확인
- 팩트체크 상태
- 저작권·라이선스 상태
- 기사 승인 대기
- 수집 실패 로그

### 운영 관리

- 독자 회원 관리
- 기고자 승인
- 관리자 권한
- 기자·편집자 역할
- 뉴스 통계
- 실시간 랭킹
- 조회수
- 광고 통계
- 검색 분석
- 시스템 로그
- 보안 로그
- 외부 API 관리
- 배포·장애 상태

### 권한 구조

- Super Admin
- Editor-in-Chief
- Managing Editor
- Editor
- Reporter
- Translator
- Fact Checker
- Contributor
- Viewer

각 역할의 접근 권한을 Go Backend에서 강제한다.

---

# 6. Vue 3 외부 기고자·제휴사 콘솔

외부 기자 및 제휴 언론사가 뉴스 자료를 제출할 수 있도록 파트너 콘솔을 개발하라.

필수 기능:

- 기고자 등록
- 기고자 승인
- 조직·언론사 프로필
- 기자 프로필
- 기사 초안 작성
- 기사 제출
- 보도자료 제출
- 이미지·동영상 업로드
- 원문 출처 기재
- 저작권 및 사용권 증빙
- 제출 상태 확인
- 편집자 피드백
- 수정 요청 대응
- 기사 승인·반려 결과
- 발행 완료 기사
- 기사 성과 확인
- 공지·알림
- 계정·권한 관리

외부 기고자는 자신의 자료만 수정할 수 있어야 한다.

기고자가 관리자의 승인 없이 공식 뉴스로 발행하는 것을 차단하라.

홍보성 콘텐츠와 유료 기사는 적절한 광고·협찬 표시를 적용할 수 있도록 한다.

---

# 7. Go Backend API 전면 구현

전체 뉴스 플랫폼의 핵심 비즈니스 로직은 Go로 구현한다.

권장 도메인 구조:

```text
apps/api/
├── cmd/server/
├── internal/
│   ├── auth/
│   ├── users/
│   ├── articles/
│   ├── categories/
│   ├── authors/
│   ├── contributors/
│   ├── sources/
│   ├── ingestion/
│   ├── editorial/
│   ├── factcheck/
│   ├── translations/
│   ├── media/
│   ├── search/
│   ├── bookmarks/
│   ├── analytics/
│   ├── rankings/
│   ├── newsletters/
│   ├── notifications/
│   ├── advertising/
│   ├── currencies/
│   └── admin/
├── migrations/
├── Dockerfile
├── go.mod
└── go.sum
```

### 필수 API

```text
/api/auth/*
/api/users/*
/api/news/*
/api/articles/*
/api/categories/*
/api/regions/*
/api/authors/*
/api/search/*
/api/bookmarks/*
/api/rankings/*
/api/news-sources/*
/api/ingestion/*
/api/editorial/*
/api/fact-checks/*
/api/translations/*
/api/media/*
/api/newsletters/*
/api/notifications/*
/api/admin/*
/api/partners/*
```

각 API는 다음을 갖추어야 한다.

- 명확한 요청·응답 모델
- 입력 검증
- 인증·인가
- 페이지네이션
- 검색·필터
- 오류 코드
- Rate Limiting
- Audit Log
- 테스트 코드
- OpenAPI 문서

핵심 Go API 대신 JavaScript Mock API를 운영에 사용하는 행위는 금지한다.

---

# 8. 글로벌 뉴스 수집·콘텐츠 파이프라인

Check-in Daily는 글로벌 여행 뉴스를 전문적으로 제공하는 플랫폼이다.

단순히 소수의 기사를 하드코딩해 놓은 웹사이트로 운영해서는 안 된다.

### 데이터 소스

승인된 다음 유형의 소스를 지원한다.

- 항공사 공식 뉴스룸
- 공항 공식 발표
- 관광청 뉴스룸
- 호텔 체인 공식 발표
- 여행 산업 기관
- 공식 통계기관
- 계약된 뉴스 API
- 이용이 허용된 RSS
- 제휴 언론사 콘텐츠
- 직접 취재 및 기고 기사

모든 소스에 출처와 사용 권한을 기록한다.

### 수집 파이프라인

```text
Approved News Source
       ↓
Go Ingestion Worker
       ↓
Source Validation
       ↓
Duplicate Detection
       ↓
Metadata Extraction
       ↓
Fact & Attribution Review
       ↓
Copyright / License Check
       ↓
Editorial Draft
       ↓
Translation
       ↓
Editor Approval
       ↓
Publishing
       ↓
SEO / RSS / Sitemap
       ↓
Reader Web / Flutter App
```

### 필수 기능

- 뉴스 소스별 등록·비활성화
- 수집 일정
- RSS/API 연결
- 실패한 소스 감지
- 재시도
- 중복 기사 탐지
- 원문 URL 보존
- 공개일·수집일 구분
- 작성자·기관 보존
- 언론사별 정책
- 콘텐츠 권한 확인
- 기사 초안 자동 생성 지원
- 편집 검토
- 번역 검토
- 발행 예약
- 수정·철회

기사 자동 생성과 실제 기사 발행은 명확히 구분한다.

**외부 원문을 무단 복제하거나 출처 표시만으로 전체 재배포 권한이 확보된다고 가정하지 마라.**

AI가 생성한 기사 초안을 실제 현장 취재 기사로 오인되게 표시해서는 안 된다.

검증되지 않은 기사와 중대한 사실관계 오류가 있는 콘텐츠는 자동 발행하지 않는다.

---

# 9. 기사 품질 및 팩트체크 강제

현재 사이트에 노출된 실제 기사들을 검토하라.

특히 다음 문제를 집중 감사한다.

1. 제목과 본문 내용 불일치
2. 관계없는 일반 분석 문구 삽입
3. 모든 기사에 반복되는 동일 템플릿
4. 실제 확인되지 않은 현장 취재 주장
5. 출처가 불분명한 통계
6. 원문에 없는 숫자·인용
7. 사실 여부를 확인하지 않은 번역
8. 원문과 다른 발행 날짜
9. 무관한 대표 이미지
10. 기사 출처 및 저작권 정보 누락

### 기사 검증 구조

각 기사에는 다음 정보를 저장하라.

- 기사 원문 출처
- 출처 URL
- 원문 게시 시각
- 기사 작성자
- 사용 허가 상태
- 팩트체크 결과
- 번역 상태
- 편집 승인자
- 발행일
- 최종 수정일
- 정정 이력

원문에 없는 분석이나 전망을 사실인 것처럼 생성하는 것을 금지한다.

검증 불가 기사는 발행 보류 처리한다.

---

# 10. 전체 DB 스키마 설계

Check-in Daily 전체 시스템의 관계형 DB 스키마를 설계하고 실행 가능한 Migration을 작성하라.

## 10.1 회원·인증

```text
users
user_profiles
user_sessions
roles
permissions
user_roles
oauth_accounts
user_consents
reader_preferences
```

## 10.2 뉴스·기사

```text
articles
article_translations
article_revisions
article_status_history
article_categories
article_tags
article_sources
article_citations
article_fact_checks
article_corrections
article_publication_jobs
article_related
article_seo
```

## 10.3 카테고리·지역

```text
categories
category_translations
tags
tag_translations
countries
regions
cities
article_regions
```

## 10.4 기자·파트너

```text
authors
author_profiles
contributors
contributor_organizations
contributor_submissions
contributor_feedback
editorial_assignments
editorial_reviews
editorial_approvals
```

## 10.5 수집·출처

```text
news_sources
news_source_credentials
news_source_licenses
news_feeds
feed_ingestion_jobs
feed_ingestion_items
ingestion_errors
source_content_records
duplicate_candidates
```

## 10.6 이미지·미디어

```text
media_assets
media_translations
media_licenses
media_attributions
article_media
media_uploads
```

## 10.7 독자 서비스

```text
bookmarks
reading_history
reader_interests
notification_preferences
newsletter_subscriptions
```

## 10.8 검색·통계

```text
article_view_events
article_view_aggregates
search_queries
search_analytics
ranking_snapshots
ranking_rules
engagement_events
```

## 10.9 광고·뉴스레터

```text
advertisers
ad_campaigns
ad_placements
sponsored_contents
newsletter_campaigns
newsletter_deliveries
```

## 10.10 글로벌·시스템

```text
languages
currencies
exchange_rates
translation_jobs
seo_redirects
sitemap_entries
system_settings
feature_flags
api_integrations
background_jobs
audit_logs
security_events
```

위 테이블들은 논리적인 설계 범위다.

중복되는 테이블은 정규화할 수 있고, 실제 필요한 테이블을 추가할 수 있다.

### DB 설계 필수사항

- 전체 ERD
- 모든 컬럼 정의
- PK / FK / Unique
- Check Constraint
- 인덱스
- 데이터 관계
- 기사 버전 관리
- 기사 발행 상태 관리
- 다국어 참조 관계
- 출처 및 라이선스 보존
- 삭제·정정 정책
- 조회수 집계 정확성
- Migration
- Backup / Recovery

실제 DB와 Go API가 연결되어야 한다.

운영 DB를 임의로 초기화하거나 기존 기사를 삭제하지 마라.

---

# 11. 다국어 글로벌 뉴스 서비스

현재 한국어·영어·중국어·태국어·베트남어·스페인어 등의 언어 UI를 조사하라.

기존에 제공되는 언어는 유지하고 번역 누락을 검증한다.

### 필수 요구사항

- 다국어 UI
- 다국어 기사 제목
- 다국어 요약
- 다국어 본문
- 언어별 고유 URL
- 언어별 SEO
- hreflang
- canonical
- 번역 상태 관리
- 원문 언어 표시
- 번역 검토 상태
- 언어 변경 후 동일 기사 유지
- 지원 번역이 없는 경우 정확한 안내
- 언어별 사이트맵

언어 선택만 바뀌고 실제 기사가 번역되지 않는 형태는 정상 다국어 지원으로 인정하지 않는다.

기사 번역 시 원문의 의미, 날짜, 수치, 고유명사 및 인용을 보존해야 한다.

AI 번역은 초안으로 사용하되 정확성 검토 절차를 적용한다.

---

# 12. 글로벌 SEO 및 뉴스 검색 최적화

뉴스 미디어에 적합한 검색엔진 최적화를 수행한다.

필수 기능:

- SSR 또는 SEO에 적합한 서버 렌더링
- Google News Sitemap
- 일반 XML Sitemap
- RSS Feed
- robots.txt
- canonical
- hreflang
- NewsArticle JSON-LD
- Author 정보
- Publisher 정보
- DatePublished
- DateModified
- 대표 이미지 메타데이터
- Open Graph
- X/Twitter Card
- Breadcrumb
- 기사별 Slug
- 기존 URL Redirect
- 중복 콘텐츠 차단
- 페이지 인덱싱 상태 확인

실제 발행하지 않은 기사나 존재하지 않는 기자·언론사 정보를 구조화 데이터로 생성하지 마라.

공식 Google News Publisher 관련 서비스의 등록·적격성은 실제 기준과 상태를 확인한다.

---

# 13. 실시간 환율 및 외부 데이터

현재 뉴스 포털에 있는 TRAVEL FX 위젯을 감사하라.

### 필수 확인

- 실제 환율 API 제공자
- API Credentials
- 마지막 성공 업데이트 시각
- 갱신 주기
- 캐시 TTL
- 환율 계산식
- 기준 통화
- JPY·VND 등의 표시 단위
- 장애 시 처리
- 오래된 환율 표시
- 출처 표시

### 금지사항

- 고정 환율을 실시간이라고 표시
- 실제 업데이트 없이 갱신 시간만 변경
- API 실패를 숨기고 기존 수치를 최신값으로 표시
- 통화별 기준 단위를 잘못 적용

실패 시 마지막 성공 갱신 시각과 오래된 데이터 여부를 명확히 표시한다.

---

# 14. Flutter 모바일 앱

## 14.1 독자용 Flutter 앱

Android와 iOS를 지원한다.

필수 기능:

- 뉴스 메인
- 카테고리별 기사
- 속보
- 주요 뉴스
- 기사 상세
- 검색
- 국가별 뉴스
- 관심 카테고리
- 스크랩북
- 읽기 기록
- 푸시 알림
- 다국어
- 다크모드
- 글꼴 크기 설정
- 공유
- 알림 설정

## 14.2 기자·기고자 Flutter 앱

- 기자 로그인
- 기사 초안 조회
- 기사 작성
- 현장 사진 업로드
- 자료 제출
- 승인 상태 조회
- 수정 요청 확인
- 기사 발행 상태 조회
- 편집자 알림

중요 승인·관리 기능은 권한에 따라 제한한다.

두 Flutter 앱은 동일한 Go API를 사용한다.

Android 빌드·테스트를 수행하고, iOS는 환경과 서명 자격증명이 확보되면 검증한다.

앱스토어 등록을 실제로 진행하지 않았는데 완료했다고 보고하지 마라.

---

# 15. Cloudflare + Go 아키텍처

Cloudflare에서 Go Backend를 정상적으로 실행할 수 있는 구조를 구성한다.

권장 구성:

```text
Vue 3 Reader Web ─────┐
Vue 3 Admin CMS ──────┼── Cloudflare API Gateway
Vue 3 Partner Portal ─┘            │
                                   ▼
                            Go Backend
                                   │
                     ┌─────────────┼──────────────┐
                     ▼             ▼              ▼
                  Database        R2         Queues / Cron
                     │
                     ▼
               News Source APIs

Flutter Reader App ──────┐
Flutter Reporter App ─────┴── Go API
```

Cloudflare Containers에서 Go Backend를 실행하는 구성을 우선 검토한다.

필요한 Workers 요금제 및 Containers 사용 가능 여부를 확인한다.

사용할 수 없다면 독립 Go 런타임과 Cloudflare Gateway를 조합하는 방안을 마련한다.

Go Backend를 단순히 Workers 내부의 JavaScript로 바꾸는 것은 금지한다.

Cloudflare R2에는 라이선스가 확인된 기사 이미지 등 미디어 자산을 저장한다.

Queues와 Cron은 실제 뉴스 수집, 이미지 처리, 번역 작업, 랭킹 집계 등의 비동기 처리에 활용한다.

---

# 16. 전체 보안 및 접근제어

다음 보안 요구사항을 구현한다.

- 독자 인증
- 관리자 인증
- 기고자 인증
- RBAC
- 관리자 MFA
- Session 관리
- 비밀번호 해시
- API Rate Limit
- XSS 방어
- CSRF 방어
- SQL Injection 방어
- 파일 업로드 보안
- SSRF 방어
- 보도자료 첨부파일 검증
- 민감 데이터 보호
- Secret 관리
- 감사 로그
- 권한 없는 기사 발행 방지

### 중요

외부 기고자는 자신의 초안과 자료에만 접근해야 한다.

일반 독자는 비공개 기사와 미발행 기사를 조회할 수 없어야 한다.

관리자 로그인이 별도 URL에 존재한다는 사실만으로 보안이 확보되는 것은 아니다.

모든 접근 권한은 Go Backend에서 검증한다.

---

# 17. 전체 반응형 UX/UI

웹서비스 3개 모두 반응형으로 구현한다.

### 필수 화면 크기

```text
Mobile
320 / 360 / 390 / 430

Tablet
768 / 820 / 1024

Desktop
1280 / 1440 / 1920
```

검증 항목:

- 모바일 뉴스 헤더
- 카테고리 메뉴
- 기사 카드
- 기사 이미지
- 기사 본문 가독성
- 기사 제목 줄바꿈
- 다국어 레이아웃
- 검색창
- 스크랩 버튼
- 뉴스 랭킹
- 환율 위젯
- 편집국 CMS 테이블
- 기사 에디터
- 파트너 자료 업로드
- 접근성
- 다크모드
- 브라우저 새로고침
- 직접 URL 접근

모바일 뉴스 사이트에서는 광고·배너·사이드바가 기사의 가독성을 해치지 않도록 한다.

---

# 18. 자동화 테스트 및 QA

반드시 다음 E2E 시나리오를 검증한다.

### 독자 테스트

1. 메인 접속
2. 카테고리 선택
3. 기사 리스트
4. 기사 상세
5. 검색
6. 국가별 필터
7. 기사 스크랩
8. 스크랩북 확인
9. 언어 변경
10. 다크모드
11. 기사 공유
12. 모바일 직접 URL 접근

### 관리자 테스트

1. 관리자 로그인
2. 신규 기사 작성
3. 초안 저장
4. 출처 등록
5. 팩트체크
6. 번역 작성
7. 기사 승인
8. 예약 발행
9. 공개 기사 확인
10. 수정 및 정정
11. 기사 비공개 전환
12. 감사 로그 확인

### 파트너 테스트

1. 기고자 등록
2. 승인
3. 기사 제출
4. 이미지 업로드
5. 출처·권한 등록
6. 편집자 검토
7. 수정 요청
8. 재제출
9. 발행 상태 조회

### 시스템 테스트

- RSS/API 뉴스 수집
- 중복 탐지
- 실제 DB 저장
- 기사 번역
- 뉴스 검색
- 조회수 집계
- 실시간 랭킹
- 환율 API
- SEO Sitemap
- 관리자 접근제어
- 미발행 기사 비공개
- 기사 이미지 권한
- 실패 작업 재처리
- 배포 및 복구

---

# 19. GitHub Repository 및 CI/CD

기존 공식 GitHub Repository를 확인하고 동일 저장소에 전체 작업을 반영한다.

권장 구조:

```text
checkindaily/
├── apps/
│   ├── reader-web/       # Vue 3
│   ├── admin-web/        # Vue 3
│   ├── partner-web/      # Vue 3
│   ├── api/              # Go
│   └── gateway/
│
├── mobile/
│   ├── reader-app/       # Flutter
│   └── reporter-app/     # Flutter
│
├── database/
│   ├── schemas/
│   └── migrations/
│
├── infrastructure/
│   ├── cloudflare/
│   └── containers/
│
├── tests/
├── docs/
└── .github/workflows/
```

### CI/CD 필수 파이프라인

```text
GitHub Push / PR
       ↓
Vue 3 Type Check
       ↓
Vue Build
       ↓
Go Vet / Test / Build
       ↓
Flutter Analyze / Test
       ↓
Database Migration Validation
       ↓
Security Scan
       ↓
Staging Deployment
       ↓
E2E Test
       ↓
Production Approval
       ↓
Cloudflare Deploy
       ↓
Smoke Test
```

### Git 규칙

- 기존 정상 기능 보존
- Git History 보존
- 적절한 Commit Message
- 실제 코드 변경 커밋
- 원격 Push
- Protected Branch 규칙 준수
- Secret Git 커밋 금지
- 최종 Commit SHA 제출

로컬 Commit만 하고 Push하지 않은 상태를 완료로 인정하지 않는다.

---

# 20. Cloudflare 실제 배포

다음 4개 서비스를 Cloudflare에 각각 배포하라.

```text
checkindaily-web
checkindaily-admin
checkindaily-partner
checkindaily-api
```

각 서비스별 필수 검증:

- 실제 Cloudflare Project 확인
- GitHub 연동
- Build Command
- Deploy Command
- Secret 및 환경변수
- DB 연결
- R2 연결
- API Gateway
- 인증 및 접근제어
- Production Deployment
- 실제 URL 접속
- 오류 로그
- 배포 후 Smoke Test

기존 사이트를 무작정 삭제하지 마라.

기존 기사 URL과 SEO 상태를 보존하면서 신규 버전으로 이전한다.

안전한 단계적 배포와 롤백 계획을 작성한다.

---

# 21. 현재 사이트 전용 P0/P1 시정 지시

다음은 실제 운영 사이트를 기반으로 추가하는 필수 감사 항목이다.

## P0 — 기사 내용과 출처

기사의 제목, 원문, 출처, 게시일, 수치, 인용문, 사진을 비교 검증하라.

기사마다 반복되는 일반적인 템플릿 문장이나 원문에서 확인되지 않은 분석이 존재하는지 조사한다.

검증되지 않은 내용을 실제 취재 결과처럼 발행하지 마라.

## P0 — 미발행 콘텐츠 및 관리자 보안

기존 `/admin/login`과 내부 CMS 라우트를 검사한다.

관리자 인증·세션·권한, 미발행 기사 접근 제한, 기고자 데이터 격리를 검증한다.

## P1 — 언어 혼합 문제

한국어 UI에서 영어 기사 제목과 본문이 혼재되는 부분을 조사한다.

언어별 번역 상태를 DB에서 관리하고, 검증된 번역이 존재하는 경우 해당 언어의 기사로 표시한다.

## P1 — 지역 뉴스 라우트

`/news/region`의 실제 기사 필터 동작을 검증하고 국가·도시별 분류가 정상 작동하도록 수정한다.

## P1 — 환율 데이터

실시간 환율의 마지막 성공 갱신과 실제 API 데이터를 비교한다.

고정값 또는 오래된 캐시값을 최신 환율로 잘못 표시하지 않는다.

## P1 — 조회수·랭킹

조회수가 실제 집계되는지 확인한다.

새로고침·봇·중복 요청으로 인한 부정확한 조회수와 조작 가능한 랭킹을 방지한다.

랭킹의 기준과 갱신 주기를 문서화한다.

## P1 — 이미지 라이선스

기사 대표 이미지와 출처 표기를 점검한다.

무관한 스톡 이미지를 실제 사건 현장 사진으로 오인되도록 사용하지 않는다.

적법한 사용권과 이미지 설명을 기록한다.

---

# 22. 전체 DB·코드·인프라 최종 검증

작업을 마친 후 다음 검증을 수행한다.

### Technology

- Vue 3 실제 사용
- Go 실제 Backend 실행
- Flutter 실제 앱 구현
- 비표준 핵심 코드 제거
- API 계약 일치

### Database

- 모든 테이블 생성
- Migration 성공
- ERD 일치
- 기사 관계 및 버전 일치
- 인덱스
- 데이터 무결성
- 기존 기사 데이터 보존
- 백업 및 복구 테스트

### News CMS

- 수집
- 초안
- 출처 검증
- 팩트체크
- 번역
- 승인
- 발행
- 수정
- 정정·철회
- 검색
- 독자 표시

### Cloudflare

- Reader Worker
- Admin Worker
- Partner Worker
- API Gateway
- Go Runtime
- R2
- DB
- CI/CD
- 실제 URL

### QA

- 기능 테스트
- E2E
- 보안 테스트
- 반응형 테스트
- SEO 테스트
- 성능 테스트
- 콘텐츠 품질 테스트

---

# 23. 최종 보고서 제출 의무

작업 완료 후 반드시 다음 정보를 제출하라.

## A. GitHub

```text
Repository:
Branch:
Latest Commit SHA:
Push Status:
CI/CD Status:
```

## B. 기술 스택

```text
Vue 3 Version:
TypeScript Version:
Go Version:
Flutter Version:
Dart Version:
Database Engine:
Go Hosting Runtime:
```

## C. Cloudflare

```text
Reader URL:
Admin URL:
Partner URL:
API URL:

Reader Deployment:
Admin Deployment:
Partner Deployment:
API Deployment:

Database Status:
R2 Status:
CI/CD Status:
```

## D. 뉴스 시스템

```text
Total Articles:
Total Categories:
Total Languages:
Active News Sources:
Working RSS/API Integrations:
Editorial CMS:
Contributor Portal:
Search:
Rankings:
Bookmarks:
Translation:
Fact Check:
SEO:
```

## E. 모바일 앱

```text
Reader Android Build:
Reader iOS Build:
Reporter Android Build:
Reporter iOS Build:
Flutter Tests:
```

## F. 전체 QA

각 항목에 다음 판정을 사용한다.

- PASS
- FAIL
- BLOCKED
- NOT IMPLEMENTED

테스트 결과 및 증거가 없는 항목은 PASS 처리하지 않는다.

## G. 최종 출시 판정

**Technical Deployment:** PASS / FAIL / BLOCKED

**Editorial System Readiness:** GO / CONDITIONAL GO / NO-GO

**Commercial Launch Readiness:** GO / CONDITIONAL GO / NO-GO

출시 차단 결함과 미확정 외부 의존성을 명확하게 구분하라.

---

# 24. 절대 금지사항

1. 웹 메인 페이지만 만들고 전체 완료 보고
2. Vue 3 프로젝트 이름만 생성하고 기존 다른 프레임워크 계속 사용
3. Go Backend 없이 Mock API 사용
4. Flutter 앱 없이 완료 보고
5. DB 테이블명만 작성하고 Migration 미구현
6. 기사 내용을 하드코딩하여 실제 뉴스로 표시
7. 출처 불명 기사를 검증 완료로 표시
8. AI 생성 기사를 실제 취재 기사로 허위 표시
9. 출처 링크만 기재하고 저작권 문제를 해결했다고 간주
10. 원문에 없는 정보나 인용문 임의 생성
11. 실제 환율이 아닌 값을 실시간이라고 표시
12. 관리자 인증을 프론트엔드에서만 검증
13. 테스트하지 않은 기능을 PASS 보고
14. 기존 기사 및 사용자 데이터 임의 삭제
15. GitHub Push 없이 완료 보고
16. Cloudflare 실배포 없이 완료 보고
17. 기존 URL을 무단 삭제하여 SEO 훼손
18. Secret과 API Key를 Repository에 노출
19. 가짜 테스트 결과 작성
20. 실제 확인하지 않은 배포 URL 제출

---

# 25. 최종 강제 실행 명령

Check-in Daily의 공식 기술 스택은 다음으로 확정한다.

**Vue 3 + TypeScript / Go / Flutter + Dart**

현재 Repository와 Cloudflare 실배포 환경을 감사하라.

기존 코드가 위 기술
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-16T01:28:39+09:00.

The user's current state is as follows:
Active Document: c:\Users\dnjst\Desktop\travel-news\scripts\batch100\thailand_20.cjs (LANGUAGE_UNSPECIFIED)
Cursor is on line: 350
Other open documents:
- c:\Users\dnjst\Desktop\travel-news\checkin-daily\frontend\pages\news\index.vue (LANGUAGE_UNSPECIFIED)
- c:\Users\dnjst\Desktop\travel-news\checkin-daily\frontend\server\utils\d1.ts (LANGUAGE_UNSPECIFIED)
- c:\Users\dnjst\Desktop\travel-news\checkin-daily\frontend\stores\articles.ts (LANGUAGE_UNSPECIFIED)
- c:\Users\dnjst\Desktop\travel-news\checkin-daily\frontend\components\NewsHomeView.vue (LANGUAGE_UNSPECIFIED)
- c:\Users\dnjst\Desktop\travel-news\checkin-daily\frontend\components\RegionHubView.vue (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>