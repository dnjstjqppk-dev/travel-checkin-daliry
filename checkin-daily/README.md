# 체크인데일리 | Check-in Daily

항공권 발권 분석, 호텔 체크인 및 티어 혜택, 여행 업계 뉴스를 다루는 여행 전문 미디어 초기 프로젝트입니다.

## 구성

- `backend/`: 로컬 Docker 개발용 Go, Gin, GORM, SQLite REST API. 첫 실행 때 기사, 뉴스 카테고리, 국가·도시 및 광고 슬롯 샘플을 저장합니다.
- `frontend/`: Nuxt 4 SSR, Vue 3, Pinia. 국가 > 도시 뉴스 라우팅, 종속 지역 필터, 관리자 Markdown CMS 및 AdSense 슬롯 관리를 제공합니다.
- 운영 배포는 Nuxt Cloudflare Worker가 HTTP API도 제공하고 D1에 저장합니다. 별도 Go API 호스트나 유료 디스크는 사용하지 않습니다.
- `mobile/`: Flutter, Riverpod, Dio 기반 기사 목록 앱.
- `shared/openapi.yaml`: API 명세.

## 빠른 실행

### Docker Compose

초기 관리자 계정은 SQLite 데이터베이스에 생성합니다. 먼저 저장소 루트의 `.env`에 세션 키와 로컬 origin을 설정합니다. `SESSION_SECRET`에는 32바이트 이상의 암호학적 난수를 넣고, `.env`는 Git에서 제외됩니다.

```dotenv
SESSION_SECRET=replace-with-at-least-64-random-hex-characters
COOKIE_SECURE=false
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

초기 계정과 임시 비밀번호를 DB에 만들고 비밀번호를 안전한 곳에 저장하세요. 임시 비밀번호는 한 번만 출력되며 DB에는 bcrypt 해시만 저장됩니다.

```sh
docker compose run --build --rm backend ./create-admin
```

이후 서비스를 실행합니다.

```sh
docker compose up --build
```

`ADMIN_USERNAME` 환경 변수를 지정하면 초기 계정 이름을 바꿀 수 있으며, 기본값은 `admin`입니다. 초기 관리자가 생성된 후 로그인은 DB의 계정 정보를 사용합니다. 운영 환경에서는 `COOKIE_SECURE=true` 및 실제 HTTPS 프론트엔드 origin을 설정하세요. `SESSION_SECRET`은 암호학적으로 안전한 난수여야 하며 필수입니다.

웹은 `http://localhost:3000`, 관리자 로그인은 `http://localhost:3000/admin/login`, API 상태 확인은 `http://localhost:8080/health`에서 확인합니다. SQLite 데이터 및 관리자 계정은 `checkin-data` 볼륨에 유지됩니다.

### 로컬 개발

Go 1.22 이상과 Node.js 20 이상이 필요합니다. 각 명령은 별도 터미널에서 실행합니다.

로컬에서 Go API를 직접 실행할 때는 `.env`의 값들을 현재 셸 환경 변수로도 설정하세요. `.env`는 Docker Compose가 자동 로드하지만 `go run`은 자동 로드하지 않습니다. 먼저 `backend` 디렉터리에서 `go run ./cmd/create-admin`을 실행해 기본 DB에 관리자 계정을 만든 뒤 `go run .`을 실행합니다.

```sh
cd backend
go mod tidy
go run .
```

```sh
cd frontend
npm install
npm run dev
```

Nuxt 개발 서버는 `http://localhost:3000`에서 열립니다. 기본적으로 Nuxt 서버 API 프록시가 `http://localhost:8080`으로 요청을 전달합니다. 다른 API 주소를 쓸 때는 `API_INTERNAL_BASE` 환경 변수를 지정하세요.

### Cloudflare Workers 배포

운영 API와 프론트엔드는 같은 Nuxt Cloudflare Worker에서 제공됩니다. D1은 SQLite 호환 데이터베이스이며 `checkin-daily/frontend/migrations/`의 마이그레이션이 기본 카테고리·지역·샘플 기사를 만듭니다. 운영 API를 위해 별도의 Go 서버, API HTTPS 주소, DB 호스트, Render 디스크 또는 결제 계정은 필요하지 않습니다.

**0원 유지:** Cloudflare 대시보드에서 Workers 요금제가 **Free**인지 확인하고 유료 요금제로 업그레이드하지 마세요. Free 한도를 넘으면 요청/쿼리가 거부되며 유료 사용량으로 넘어가지 않습니다. 현재 공개된 무료 한도는 Workers 요청 100,000회/일, D1 읽기 5백만 행/일, 쓰기 100,000행/일, 전체 저장 공간 5GB입니다. Worker CPU 시간은 Free 플랜의 기본 제한이 적용되며, Free 플랜은 별도의 CPU 제한 설정을 지원하지 않습니다. 계정의 유료 요금제나 다른 Cloudflare 리소스 요금은 이 설정이 막아주지 않으므로 무료 요금제만 사용해야 합니다.

먼저 Cloudflare 대시보드에서 Workers 요금제가 **Free**인지 확인하고, 저장소 루트에서 Wrangler에 로그인합니다. 무료 요금제임을 확인할 수 없으면 원격 리소스를 만들거나 배포하지 마세요.

```sh
npx wrangler login
npx wrangler d1 create checkin-daily-db
```

`d1 create` 출력의 실제 ID를 루트 `wrangler.toml`의 `database_id`에 입력한 다음 마이그레이션을 적용하고 배포하세요.

```sh
npx wrangler d1 migrations apply checkin-daily-db --remote
npx wrangler deploy
```

배포 뒤 Worker HTTPS 주소에서 API도 함께 동작합니다. 초기 관리자 생성은 일회용 부트스트랩 토큰으로 보호됩니다. 긴 임의 토큰을 입력해 Worker secret으로 등록합니다.

```sh
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN
```

그 토큰을 `Authorization: Bearer <토큰>` 헤더에 넣고, `/api/auth/bootstrap`으로 관리자 이름과 직접 정한 12자 이상의 비밀번호를 JSON POST 요청으로 보냅니다. 계정 생성이 끝나면 부트스트랩 토큰을 즉시 제거하세요.

```sh
npx wrangler secret delete ADMIN_BOOTSTRAP_TOKEN
```

초기 계정 생성 이후에는 부트스트랩 요청이 거부됩니다.

마이그레이션은 새 D1에 샘플 데이터를 넣습니다. 기존 로컬 SQLite 데이터베이스의 관리자가 작성한 기사는 자동 복사되지 않으므로, 운영 배포 전에 필요한 데이터를 별도로 내보내 D1로 가져와야 합니다.

로컬 `npm run dev`와 Docker Compose는 기존 Go API를 사용하므로 로컬 개발 흐름은 유지됩니다. 이 Go 프로세스는 Cloudflare 운영 배포에는 포함되지 않습니다.

### Flutter 앱

Flutter 3.19 이상에서:

```sh
cd mobile
flutter pub get
flutter run
```

기본 API 주소는 Android 에뮬레이터의 `http://10.0.2.2:8080`입니다. 별도 주소는 `flutter run --dart-define=API_BASE_URL=http://<host>:8080`으로 지정할 수 있습니다.

## 화면 및 API

- `/news`: 메인 뉴스 대시보드
- `/news/:category`, `/news/:category/:countryCode`, `/news/:category/:countryCode/:cityId`: 카테고리별 국가·도시 뉴스
- `/news/region/:countryCode`, `/news/region/:countryCode/:cityId`: 전체 뉴스의 국가·도시 필터
- `/news/:category/article/:id`: 기사 상세 및 지역 태그
- `/admin/news`: 기사 관리 (기존 `/admin/dashboard`로 이동)
- `/flights`, `/hotels`: 카테고리별 기사
- `/articles/:slug`: Markdown 기사 상세
- `/admin/dashboard`: 초안 및 발행 기사 관리
- `/admin/articles/new`, `/admin/articles/:id`: Markdown 작성 및 수정. 새 기사는 기본적으로 발행되어 사용자 뉴스 페이지에 공개되며, 초안으로 저장하면 비공개로 유지됩니다.
- `/admin/locations`: 국가·도시 등록 및 관리
- `/admin/ads`: AdSense 광고 슬롯 등록, 활성화 및 관리
- `/admin/login`: 별도 관리자 로그인 (세션 미인증 시 관리자 경로에서 자동 이동)
- `/admin/categories`: 카테고리 추가 및 삭제 (기사에서 사용하는 카테고리 삭제는 차단)
- `GET /api/articles?category=airline&country=JP&city=tyo&q=travel&limit=12&offset=0`
- `GET /api/articles/:slug`
- `GET /api/countries`, `GET /api/countries/:code/cities`
- `GET|POST /api/admin/countries`, `PUT|DELETE /api/admin/countries/:code`
- `GET|POST /api/admin/countries/:code/cities`, `PUT|DELETE /api/admin/cities/:id`
- `GET /api/ads`, `GET|POST /api/admin/ads`, `PUT|DELETE /api/admin/ads/:id`
- `GET|POST /api/admin/articles`, `PUT|DELETE /api/admin/articles/:id`
- `GET /api/categories`, `GET|POST /api/admin/categories`, `PUT|DELETE /api/admin/categories/:id`

### 편집 기사 초기 데이터

Cloudflare D1의 `0003_seed_verified_travel_articles.sql` 마이그레이션은 주요뉴스, 항공, 호텔, 여행지, 인기뉴스(실시간) 카테고리에 출처 링크가 포함된 편집 기사 각 10건을 등록합니다. 기업·정부·국제기구 원문 링크와 발표 기준일은 기사 본문에서 확인할 수 있습니다. 통계 전망은 확정 실적과 구분해 표기하며, 썸네일은 Unsplash CDN을 사용합니다. 이 데이터는 초기 편집 콘텐츠이며 뉴스 자동 수집·갱신 기능은 아닙니다.

## 개발 단계 보안 안내

관리자 계정은 SQLite의 `admin_accounts` 테이블에 bcrypt 해시로 저장하며 로그인과 권한 확인은 DB 계정을 사용합니다. `create-admin` 명령은 암호학적으로 안전한 임시 비밀번호를 생성하고 한 번만 출력합니다. 세션 쿠키는 `HttpOnly`, `SameSite=Strict`, 운영 환경에서 `Secure`, 8시간 TTL을 적용합니다. 로그인 시도 제한과 관리자 변경 요청의 exact-origin/Fetch Metadata 검증도 적용됩니다. CORS는 `CORS_ALLOWED_ORIGINS` allowlist만 허용합니다. 이 초기 CMS에는 일반 사용자 계정이나 별도 사용자 역할 저장소가 없습니다. 스크랩 기능은 사용자 역할에 포함되어 있으나 현재 계정/동기화 백엔드는 구현되지 않았습니다.

보안 의존성 감사는 `cd frontend && npm audit`으로 다시 실행할 수 있습니다. 기준 감사 결과와 조치 현황은 [보안 감사 보고서](./docs/security-audit-report.md)를 참고하세요. 이 감사는 패키지별 취약 advisory 집계이며 “20”은 20개의 독립적인 앱 취약점 보고서를 뜻하지 않습니다.