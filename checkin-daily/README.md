# 체크인데일리 | Check-in Daily

항공권 발권 분석, 호텔 체크인 및 티어 혜택, 여행 업계 뉴스를 다루는 여행 전문 미디어 초기 프로젝트입니다.

## 구성

- `backend/`: Go, Gin, GORM, SQLite REST API. 첫 실행 때 기사, 뉴스 카테고리, 국가·도시 및 광고 슬롯 샘플을 저장합니다.
- `frontend/`: Nuxt 4 SSR, Vue 3, Pinia. 국가 > 도시 뉴스 라우팅, 종속 지역 필터, 관리자 Markdown CMS 및 AdSense 슬롯 관리를 제공합니다.
- `mobile/`: Flutter, Riverpod, Dio 기반 기사 목록 앱.
- `shared/openapi.yaml`: API 명세.

## 빠른 실행

### Docker Compose

관리자 자격 증명은 환경 변수로만 전달합니다. 먼저 `backend` 디렉터리에서 아래 명령을 실행해 bcrypt 해시를 만듭니다. 입력한 비밀번호는 터미널에 표시되지 않습니다.

```sh
cd backend
go run ./cmd/hash-password
```

출력된 해시와 관리자 계정, 32바이트 이상의 임의 세션 키를 저장소 루트의 `.env` 파일에 설정합니다. `.env`는 Git에서 제외됩니다.

```dotenv
ADMIN_USERNAME=editor@example.com
ADMIN_PASSWORD_HASH='$2a$10$replace-with-the-generated-bcrypt-hash'
SESSION_SECRET=replace-with-at-least-64-random-hex-characters
COOKIE_SECURE=false
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

운영 환경에서는 `COOKIE_SECURE=true` 및 실제 HTTPS 프론트엔드 origin을 설정하세요. `SESSION_SECRET`은 암호학적으로 안전한 난수여야 합니다. 인증 설정이 없거나 잘못됐으면 백엔드는 시작하지 않습니다.

Docker Desktop을 실행한 뒤 프로젝트 루트에서:

```sh
docker compose up --build
```

웹은 `http://localhost:3000`, API 상태 확인은 `http://localhost:8080/health`에서 확인합니다. SQLite 데이터는 `checkin-data` 볼륨에 유지됩니다.

### 로컬 개발

Go 1.22 이상과 Node.js 20 이상이 필요합니다. 각 명령은 별도 터미널에서 실행합니다.

로컬에서 Go API를 직접 실행할 때는 `.env`의 값들을 현재 셸 환경 변수로도 설정하세요. `.env`는 Docker Compose가 자동 로드하지만 `go run`은 자동 로드하지 않습니다.

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

Cloudflare Workers 빌드/배포 명령은 저장소 루트에서 `npx wrangler deploy`를 실행합니다. 루트의 `wrangler.toml`이 프론트엔드를 빌드해 Nuxt Worker와 정적 자산을 배포합니다. Cloudflare Workers 환경 변수 `NUXT_API_INTERNAL_BASE`를 외부에서 접근 가능한 Go API 주소로 설정해야 기사 및 관리자 API가 서버 렌더링과 브라우저 요청에서 동작합니다. API 서버는 이 Worker 배포에 포함되지 않습니다.

Go API 운영 환경에는 `CORS_ALLOWED_ORIGINS=https://<실제-프론트엔드-도메인>` 및 `COOKIE_SECURE=true`를 설정합니다. 세션 키와 bcrypt 해시는 프론트엔드 Worker가 아닌 Go API 호스트의 비밀 환경 변수로 주입합니다. 관리자 브라우저는 세션 쿠키를 사용할 수 있도록 Worker의 same-origin `/api/*` 프록시를 이용해야 합니다.

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
- `/admin/articles/new`, `/admin/articles/:id`: Markdown 작성 및 수정
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

## 개발 단계 보안 안내

관리자 계정은 단일 환경 설정 계정이며 bcrypt 해시와 HMAC 서명 세션을 사용합니다. 세션 쿠키는 `HttpOnly`, `SameSite=Strict`, 운영 환경에서 `Secure`, 8시간 TTL을 적용합니다. 로그인 시도 제한과 관리자 변경 요청의 exact-origin/Fetch Metadata 검증도 적용됩니다. CORS는 `CORS_ALLOWED_ORIGINS` allowlist만 허용합니다. 이 초기 CMS에는 일반 사용자 계정이나 별도 사용자 역할 저장소가 없습니다. 스크랩 기능은 사용자 역할에 포함되어 있으나 현재 계정/동기화 백엔드는 구현되지 않았습니다.

보안 의존성 감사는 `cd frontend && npm audit`으로 다시 실행할 수 있습니다. 기준 감사 결과와 조치 현황은 [보안 감사 보고서](./docs/security-audit-report.md)를 참고하세요. 이 감사는 패키지별 취약 advisory 집계이며 “20”은 20개의 독립적인 앱 취약점 보고서를 뜻하지 않습니다.