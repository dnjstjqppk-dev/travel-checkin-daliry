# 체크인데일리 | Check-in Daily

항공권 발권 분석, 호텔 체크인 및 티어 혜택, 여행 업계 뉴스를 다루는 여행 전문 미디어 초기 프로젝트입니다.

## 구성

- `backend/`: Go, Gin, GORM, SQLite REST API. 첫 실행 때 기사, 뉴스 카테고리, 국가·도시 및 광고 슬롯 샘플을 저장합니다.
- `frontend/`: Nuxt 3 SSR, Vue 3, Tailwind CSS, Pinia. 국가 > 도시 뉴스 라우팅, 종속 지역 필터, 관리자 Markdown CMS 및 AdSense 슬롯 관리를 제공합니다.
- `mobile/`: Flutter, Riverpod, Dio 기반 기사 목록 앱.
- `shared/openapi.yaml`: API 명세.

## 빠른 실행

### Docker Compose

Docker Desktop을 실행한 뒤 프로젝트 루트에서:

```sh
docker compose up --build
```

웹은 `http://localhost:3000`, API 상태 확인은 `http://localhost:8080/health`에서 확인합니다. SQLite 데이터는 `checkin-data` 볼륨에 유지됩니다.

### 로컬 개발

Go 1.22 이상과 Node.js 20 이상이 필요합니다. 각 명령은 별도 터미널에서 실행합니다.

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

관리자 API는 초기 로컬 실행을 위해 인증 없이 열려 있습니다. 인터넷에 노출하기 전에 사용자 인증, 역할 기반 권한, 입력 검증 및 요청 제한을 반드시 추가해야 합니다. CORS도 개발용 전체 허용 상태이므로 운영 도메인으로 제한하세요. 스크랩 기능은 사용자 역할에 포함되어 있으나 현재 스캐폴드에는 계정/동기화 백엔드가 없어 아직 구현되지 않았습니다.