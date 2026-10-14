<script setup lang="ts">
import type { Article } from '~/stores/articles'

const store = useArticlesStore()
const route = useRoute()
const requestFetch = useRequestFetch()
const currentDesign = useState<string>('current-design-concept', () => '1')
const savedStore = useSavedStore()

const categories = [
  { id: 'major', name: '주요 뉴스', description: '오늘의 핵심 여행 업계 소식' },
  { id: 'airline', name: '항공', description: '항공권, 마일리지와 운임' },
  { id: 'hotel', name: '호텔', description: '멤버십, 체크인과 스테이' },
  { id: 'destination', name: '여행지', description: '목적지에서 발견한 새로운 장면' },
]

const categoryNames: Record<string, string> = {
  major: '주요 뉴스',
  airline: '항공',
  hotel: '호텔',
  destination: '여행지',
  realtime: '실시간',
}

const searchQuery = computed(() => typeof route.query.q === 'string' ? route.query.q.trim() : '')

await useAsyncData('news-home', () => store.load({ limit: 24, search: searchQuery.value }))
const { data: popularArticles, error: popularLoadError } = await useAsyncData<Article[]>(
  'news-home-popular',
  () => requestFetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views' } }),
  { default: () => [] },
)

watch(searchQuery, async (search) => {
  await store.load({ limit: 24, search })
})

const featuredArticle = computed(() => store.articles[0])
const subLeadArticles = computed(() => store.articles.slice(1, 3))
const galleryArticles = computed(() => store.articles.slice(0, 9))
const destinationArticles = computed(() => store.articles.filter((article) => article.category === 'destination').slice(0, 4))
const airlineArticles = computed(() => store.articles.filter((article) => article.category === 'airline').slice(0, 3))
const hotelArticles = computed(() => store.articles.filter((article) => article.category === 'hotel').slice(0, 3))

function hasCoverImage(article: Article | undefined) {
  return Boolean(article?.coverImage && /^https:\/\//i.test(article.coverImage))
}

function formatDate(date: string | null) {
  if (!date) return '최신 기사'
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(date))
}

function formatViews(views = 0) {
  return new Intl.NumberFormat('ko-KR', { notation: views > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(views)
}
</script>

<template>
  <div class="page-wrap news-home" :class="`view-design-${currentDesign}`">
    <!-- 검색 모드 -->
    <section v-if="searchQuery" class="search-results">
      <header class="editorial-section-heading">
        <div>
          <p class="eyebrow">SEARCH / NEWSROOM</p>
          <h1>“{{ searchQuery }}” 검색 결과</h1>
        </div>
        <span>{{ store.articles.length }}건</span>
      </header>
      <p v-if="store.error" class="empty-state">{{ store.error }}</p>
      <p v-else-if="!store.articles.length" class="empty-state">검색 결과가 없습니다.</p>
      <div v-else class="news-card-grid editorial-gallery">
        <NewsArticleCard v-for="article in store.articles" :key="article.id" :article="article" />
      </div>
    </section>

    <!-- 메인 뉴스룸 (3개 디자인 전환) -->
    <template v-else>
      <AdSlot placement-id="main_top" />

      <!-- ========================================================= -->
      <!-- [안 1] 모던 인텔리전스 뉴스룸 (Modern Intelligence Desk)    -->
      <!-- ========================================================= -->
      <section v-if="currentDesign === '1'" class="design-section design-intelligence">
        <div class="intel-hero-grid">
          <!-- 좌측 65%: 메인 인텔리전스 리드 기사 -->
          <article v-if="featuredArticle" class="intel-lead-card">
            <NuxtLink :to="`/news/${featuredArticle.category}/article/${featuredArticle.id}`" class="intel-lead-inner">
              <div class="intel-art-wrap">
                <img v-if="hasCoverImage(featuredArticle)" :src="featuredArticle.coverImage" :alt="featuredArticle.title" fetchpriority="high">
                <div v-else class="intel-art-fallback" :class="`category-art-${featuredArticle.category}`">
                  <span>{{ categoryNames[featuredArticle.category] || featuredArticle.category }}</span>
                </div>
                <span class="intel-badge-lead">LEAD BRIEFING</span>
              </div>
              <div class="intel-lead-body">
                <div class="intel-meta">
                  <span class="intel-cat-tag">{{ categoryNames[featuredArticle.category] || featuredArticle.category }}</span>
                  <span class="intel-date">{{ formatDate(featuredArticle.publishedAt) }}</span>
                  <span v-if="featuredArticle.viewCount" class="intel-views">조회 {{ formatViews(featuredArticle.viewCount) }}</span>
                </div>
                <h1 class="intel-title">{{ featuredArticle.title }}</h1>
                <p class="intel-summary">{{ featuredArticle.summary }}</p>

                <!-- 3줄 팩트 브리핑 요약 박스 (Key Takeaways) -->
                <div class="intel-takeaways">
                  <span class="takeaway-header">⚡ 에디터 핵심 요약 (KEY TAKEAWAYS)</span>
                  <ul>
                    <li>여행 업계 실시간 정책 및 운임 변경 사항 심층 반영</li>
                    <li>여행자가 바로 체감할 수 있는 항공/호텔 주요 혜택 포인트 정리</li>
                    <li>체크인데일리 취재팀 단독 취재 분석 완료</li>
                  </ul>
                </div>

                <div class="intel-read-cta">
                  <span>전문 분석 리포트 읽기</span>
                  <span class="cta-arrow" aria-hidden="true">→</span>
                </div>
              </div>
            </NuxtLink>
          </article>

          <!-- 우측 35%: 실시간 랭킹 타임라인 & 환율 지표 -->
          <aside class="intel-rail">
            <section class="intel-trending-box">
              <div class="intel-rail-header">
                <div>
                  <span class="intel-live-dot" />
                  <strong class="intel-rail-title">실시간 랭킹 TOP 5</strong>
                </div>
                <NuxtLink to="/news/realtime" class="intel-rail-more">전체 ↗</NuxtLink>
              </div>
              <ol class="intel-ranking-list">
                <li v-for="(article, idx) in popularArticles.slice(0, 5)" :key="article.id" class="intel-rank-item">
                  <span class="intel-rank-num" :class="{ 'top-three': idx < 3 }">0{{ idx + 1 }}</span>
                  <div class="intel-rank-content">
                    <NuxtLink :to="`/news/${article.category}/article/${article.id}`">
                      <strong>{{ article.title }}</strong>
                    </NuxtLink>
                    <div class="intel-rank-meta">
                      <span>{{ categoryNames[article.category] || article.category }}</span>
                      <span>조회 {{ formatViews(article.viewCount) }}</span>
                    </div>
                  </div>
                </li>
              </ol>
            </section>

            <!-- 환율 지표 컴포넌트 -->
            <CurrencyRates />
          </aside>
        </div>

        <!-- 인더스트리 펄스: 항공/호텔/여행지 3열 매트릭스 -->
        <section class="intel-pulse-section">
          <header class="intel-section-header">
            <div>
              <span class="eyebrow">SECTOR RADAR</span>
              <h2>여행 산업 부문별 속보</h2>
            </div>
            <span class="intel-section-desc">항공사 노선, 호텔 체인 티어, 인기 데스티네이션 실시간 피드</span>
          </header>
          <div class="intel-pulse-grid">
            <!-- 항공 부문 -->
            <div class="pulse-col">
              <div class="pulse-col-head">
                <span>✈️ 항공 & 마일리지</span>
                <NuxtLink to="/news/airline">더보기 ↗</NuxtLink>
              </div>
              <div v-for="art in airlineArticles" :key="art.id" class="pulse-card">
                <NuxtLink :to="`/news/${art.category}/article/${art.id}`">
                  <span class="pulse-time">{{ art.publishedAt?.slice(5, 10) || '속보' }}</span>
                  <strong>{{ art.title }}</strong>
                </NuxtLink>
              </div>
            </div>
            <!-- 호텔 부문 -->
            <div class="pulse-col">
              <div class="pulse-col-head">
                <span>🏨 호텔 & 스테이</span>
                <NuxtLink to="/news/hotel">더보기 ↗</NuxtLink>
              </div>
              <div v-for="art in hotelArticles" :key="art.id" class="pulse-card">
                <NuxtLink :to="`/news/${art.category}/article/${art.id}`">
                  <span class="pulse-time">{{ art.publishedAt?.slice(5, 10) || '속보' }}</span>
                  <strong>{{ art.title }}</strong>
                </NuxtLink>
              </div>
            </div>
            <!-- 여행지 부문 -->
            <div class="pulse-col">
              <div class="pulse-col-head">
                <span>📍 데스티네이션 픽</span>
                <NuxtLink to="/news/destination">더보기 ↗</NuxtLink>
              </div>
              <div v-for="art in destinationArticles.slice(0, 3)" :key="art.id" class="pulse-card">
                <NuxtLink :to="`/news/${art.category}/article/${art.id}`">
                  <span class="pulse-time">{{ art.publishedAt?.slice(5, 10) || '속보' }}</span>
                  <strong>{{ art.title }}</strong>
                </NuxtLink>
              </div>
            </div>
          </div>
        </section>

        <!-- 전체 기사 아카이브 그리드 -->
        <section class="intel-feed-section">
          <header class="intel-section-header">
            <div>
              <span class="eyebrow">LATEST STORIES</span>
              <h2>최신 뉴스 전체 피드</h2>
            </div>
            <NuxtLink to="/news/major">전체 보기 →</NuxtLink>
          </header>
          <div class="news-card-grid intel-card-grid">
            <NewsArticleCard v-for="article in galleryArticles" :key="article.id" :article="article" />
          </div>
        </section>
      </section>

      <!-- ========================================================= -->
      <!-- [안 2] 하이엔드 에디토리얼 매거진 (High-End Editorial Magazine) -->
      <!-- ========================================================= -->
      <section v-else-if="currentDesign === '2'" class="design-section design-magazine">
        <!-- 와이드 시네마틱 매거진 커버 리드 -->
        <article v-if="featuredArticle" class="mag-cover-spread">
          <NuxtLink :to="`/news/${featuredArticle.category}/article/${featuredArticle.id}`" class="mag-cover-link">
            <div class="mag-cover-media">
              <img v-if="hasCoverImage(featuredArticle)" :src="featuredArticle.coverImage" :alt="featuredArticle.title" fetchpriority="high">
              <div v-else class="mag-cover-art-fallback" />
              <div class="mag-cover-overlay" />
            </div>
            <div class="mag-cover-content">
              <span class="mag-kicker">COVER STORY · {{ categoryNames[featuredArticle.category] || featuredArticle.category }}</span>
              <h1 class="mag-hero-title">{{ featuredArticle.title }}</h1>
              <p class="mag-hero-summary">{{ featuredArticle.summary }}</p>
              <div class="mag-byline">
                <span>BY CHECK-IN DAILY NEWSROOM</span>
                <span class="mag-dot">·</span>
                <span>{{ formatDate(featuredArticle.publishedAt) }}</span>
                <span class="mag-dot">·</span>
                <span class="mag-read-action">기사 전문 읽기 →</span>
              </div>
            </div>
          </NuxtLink>
        </article>

        <!-- 에디토리얼 2단 스토리텔링 그리드 -->
        <section class="mag-split-section">
          <div class="mag-subleads">
            <header class="mag-section-title">
              <span class="mag-section-tag">EDITOR'S DISPATCH</span>
              <h2>에디터 추천 심층 기사</h2>
            </header>
            <div class="mag-subleads-grid">
              <article v-for="sub in subLeadArticles" :key="sub.id" class="mag-sublead-card">
                <NuxtLink :to="`/news/${sub.category}/article/${sub.id}`">
                  <div class="mag-sublead-thumb">
                    <img v-if="hasCoverImage(sub)" :src="sub.coverImage" :alt="sub.title" loading="lazy">
                    <div v-else class="mag-thumb-fallback" />
                  </div>
                  <span class="mag-cat">{{ categoryNames[sub.category] || sub.category }}</span>
                  <h3>{{ sub.title }}</h3>
                  <p>{{ sub.summary }}</p>
                  <span class="mag-date">{{ formatDate(sub.publishedAt) }}</span>
                </NuxtLink>
              </article>
            </div>
          </div>

          <aside class="mag-side-journal">
            <div class="mag-side-box">
              <span class="mag-side-badge">MOST APPRECIATED</span>
              <h3>독자들이 주목한 뉴스</h3>
              <ul class="mag-popular-list">
                <li v-for="(pop, i) in popularArticles.slice(0, 5)" :key="pop.id">
                  <span class="mag-roman">{{ ['I', 'II', 'III', 'IV', 'V'][i] }}</span>
                  <NuxtLink :to="`/news/${pop.category}/article/${pop.id}`">
                    <strong>{{ pop.title }}</strong>
                    <small>{{ categoryNames[pop.category] || pop.category }} · 조회 {{ formatViews(pop.viewCount) }}</small>
                  </NuxtLink>
                </li>
              </ul>
            </div>
            <CurrencyRates />
          </aside>
        </section>

        <!-- 매거진 3열 포토 갤러리 -->
        <section class="mag-gallery-section">
          <header class="mag-section-title centered">
            <span class="mag-section-tag">VOYAGE ARCHIVE</span>
            <h2>세계 각지에서 도착한 소식</h2>
          </header>
          <div class="news-card-grid mag-card-grid">
            <NewsArticleCard v-for="article in galleryArticles" :key="article.id" :article="article" />
          </div>
        </section>
      </section>

      <!-- ========================================================= -->
      <!-- [안 3] 비주얼 벤토 & 트래블 덱 (Visual Bento & Card Deck)     -->
      <!-- ========================================================= -->
      <section v-else-if="currentDesign === '3'" class="design-section design-bento">
        <!-- 가로 스크롤 빠른 여행 카테고리 필터 바 -->
        <BentoCategoryChips />

        <!-- 벤토 그리드 (Bento Grid) -->
        <div class="bento-hero-grid">
          <!-- 2x2 대형 벤토 카드: 메인 기사 -->
          <article v-if="featuredArticle" class="bento-tile bento-tile-main">
            <NuxtLink :to="`/news/${featuredArticle.category}/article/${featuredArticle.id}`" class="bento-tile-link">
              <div class="bento-img-container">
                <img v-if="hasCoverImage(featuredArticle)" :src="featuredArticle.coverImage" :alt="featuredArticle.title" fetchpriority="high">
                <div v-else class="bento-fallback-bg" />
                <div class="bento-gradient-scrim" />
              </div>
              <div class="bento-card-floating-tags">
                <span class="bento-pill-category">🔥 {{ categoryNames[featuredArticle.category] || featuredArticle.category }}</span>
                <span class="bento-pill-views">조회 {{ formatViews(featuredArticle.viewCount) }}</span>
              </div>
              <div class="bento-card-caption">
                <span class="bento-caption-date">{{ formatDate(featuredArticle.publishedAt) }}</span>
                <h1 class="bento-main-title">{{ featuredArticle.title }}</h1>
                <p class="bento-main-desc">{{ featuredArticle.summary }}</p>
                <div class="bento-tap-indicator">
                  <span>자세히 보기</span>
                  <span class="bento-arrow">↗</span>
                </div>
              </div>
            </NuxtLink>
            <button
              class="bento-save-btn"
              type="button"
              :aria-label="savedStore.has(featuredArticle.slug) ? '스크랩 해제' : '스크랩 저장'"
              @click.stop="savedStore.toggle(featuredArticle.slug)"
            >
              {{ savedStore.has(featuredArticle.slug) ? '★' : '☆' }}
            </button>
          </article>

          <!-- 1x1 우측 상단 벤토 카드: 환율 위젯 -->
          <div class="bento-tile bento-tile-fx">
            <CurrencyRates />
          </div>

          <!-- 1x1 우측 하단 벤토 카드: 핫픽 서브 리드 -->
          <article v-if="subLeadArticles[0]" class="bento-tile bento-tile-hotpick">
            <NuxtLink :to="`/news/${subLeadArticles[0].category}/article/${subLeadArticles[0].id}`" class="bento-hotpick-link">
              <span class="bento-mini-badge">EDITOR'S HOT PICK</span>
              <h3 class="bento-hotpick-title">{{ subLeadArticles[0].title }}</h3>
              <p class="bento-hotpick-summary">{{ subLeadArticles[0].summary }}</p>
              <div class="bento-hotpick-footer">
                <span>{{ categoryNames[subLeadArticles[0].category] || subLeadArticles[0].category }}</span>
                <span>보러가기 ↗</span>
              </div>
            </NuxtLink>
          </article>
        </div>

        <!-- 트렌딩 랭킹 스트립 -->
        <section class="bento-trending-strip">
          <div class="strip-header">
            <span class="strip-badge">TRENDING TOP 5</span>
            <h3>지금 가장 많이 찾는 여행 뉴스</h3>
          </div>
          <div class="strip-cards-scroll">
            <div v-for="(pop, idx) in popularArticles.slice(0, 5)" :key="pop.id" class="strip-item">
              <NuxtLink :to="`/news/${pop.category}/article/${pop.id}`">
                <span class="strip-rank-circle">{{ idx + 1 }}</span>
                <div class="strip-item-text">
                  <strong>{{ pop.title }}</strong>
                  <small>{{ categoryNames[pop.category] || pop.category }} · 조회 {{ formatViews(pop.viewCount) }}</small>
                </div>
              </NuxtLink>
            </div>
          </div>
        </section>

        <!-- 3열 비주얼 핀보드 갤러리 -->
        <section class="bento-pinboard-section">
          <div class="bento-section-title">
            <h2>목적지 탐색 핀보드</h2>
            <NuxtLink to="/news/destination">전체 여행지 탐색 ↗</NuxtLink>
          </div>
          <div class="news-card-grid bento-pinboard-grid">
            <NewsArticleCard v-for="article in galleryArticles" :key="article.id" :article="article" />
          </div>
        </section>
      </section>

      <AdSlot placement-id="main_bottom" />

      <!-- 카테고리 네비게이션 공통 -->
      <nav class="editorial-category-nav" aria-label="뉴스 카테고리">
        <NuxtLink v-for="category in categories" :key="category.id" :to="`/news/${category.id}`">
          <span class="eyebrow">{{ category.id.toUpperCase() }}</span>
          <strong>{{ category.name }}</strong>
          <span>{{ category.description }}</span>
          <span aria-hidden="true">↗</span>
        </NuxtLink>
      </nav>
    </template>
  </div>
</template>
