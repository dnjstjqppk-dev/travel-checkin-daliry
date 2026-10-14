<script setup lang="ts">
import type { Article } from '~/stores/articles'

const store = useArticlesStore()
const route = useRoute()
const requestFetch = useRequestFetch()

const categoryNames: Record<string, string> = {
  major: '주요뉴스',
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

// 방콕포스트 구조별 기사 분할
const featuredArticle = computed(() => store.articles[0])
const subLeadArticles = computed(() => store.articles.slice(1, 3))
const airlineArticles = computed(() => store.articles.filter((a) => a.category === 'airline').slice(0, 3))
const hotelArticles = computed(() => store.articles.filter((a) => a.category === 'hotel').slice(0, 3))
const destinationArticles = computed(() => store.articles.filter((a) => a.category === 'destination').slice(0, 3))
const remainingArticles = computed(() => store.articles.slice(3, 15))

function hasCoverImage(article: Article | undefined) {
  return Boolean(article?.coverImage && /^https:\/\//i.test(article.coverImage))
}

function formatDate(date: string | null) {
  if (!date) return '최신 기사'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(new Date(date))
}

function formatViews(views = 0) {
  return new Intl.NumberFormat('ko-KR').format(views)
}
</script>

<template>
  <div class="page-wrap bkp-container">
    <!-- 검색 모드 -->
    <section v-if="searchQuery" class="bkp-search-results">
      <div class="bkp-sec-header">
        <h2>SEARCH: “{{ searchQuery }}”</h2>
        <span>총 {{ store.articles.length }}건</span>
      </div>
      <p v-if="store.error" class="empty-state">{{ store.error }}</p>
      <p v-else-if="!store.articles.length" class="empty-state">일치하는 기사가 없습니다.</p>
      <div v-else class="bkp-card-grid-3">
        <NewsArticleCard v-for="article in store.articles" :key="article.id" :article="article" />
      </div>
    </section>

    <!-- 방콕포스트 정통 뉴스 메인 레이아웃 -->
    <template v-else>
      <AdSlot placement-id="main_top" />

      <!-- ======================================================== -->
      <!-- SECTION 1: TOP HIGHLIGHTS & SIDEBAR (좌 68% : 우 32%)    -->
      <!-- ======================================================== -->
      <section class="bkp-highlight-section">
        <!-- 좌측: 메인 탑 하이라이트 + 서브 리드 2열 -->
        <div class="bkp-lead-column">
          <!-- 메인 탑 기사 -->
          <article v-if="featuredArticle" class="bkp-main-lead-card">
            <NuxtLink :to="`/news/${featuredArticle.category}/article/${featuredArticle.id}`" class="bkp-lead-link">
              <div class="bkp-lead-figure">
                <img
                  v-if="hasCoverImage(featuredArticle)"
                  :src="featuredArticle.coverImage"
                  :alt="featuredArticle.title"
                  fetchpriority="high"
                >
                <div v-else class="bkp-figure-fallback">
                  <span>{{ categoryNames[featuredArticle.category] || featuredArticle.category }}</span>
                </div>
                <span class="bkp-badge-category">
                  {{ categoryNames[featuredArticle.category] || featuredArticle.category }}
                </span>
              </div>
              <div class="bkp-lead-body">
                <div class="bkp-meta-line">
                  <span class="bkp-time">{{ formatDate(featuredArticle.publishedAt) }}</span>
                  <span v-if="featuredArticle.viewCount" class="bkp-view-count">· 조회 {{ formatViews(featuredArticle.viewCount) }}</span>
                </div>
                <h1 class="bkp-lead-title">{{ featuredArticle.title }}</h1>
                <p class="bkp-lead-excerpt">{{ featuredArticle.summary }}</p>
                <span class="bkp-read-more">READ FULL STORY →</span>
              </div>
            </NuxtLink>
          </article>

          <!-- 서브 하이라이트 2열 -->
          <div v-if="subLeadArticles.length" class="bkp-sublead-grid">
            <article v-for="sub in subLeadArticles" :key="sub.id" class="bkp-sublead-card">
              <NuxtLink :to="`/news/${sub.category}/article/${sub.id}`">
                <div class="bkp-sublead-thumb">
                  <img v-if="hasCoverImage(sub)" :src="sub.coverImage" :alt="sub.title" loading="lazy">
                  <div v-else class="bkp-figure-fallback small" />
                  <span class="bkp-tag-pill">{{ categoryNames[sub.category] || sub.category }}</span>
                </div>
                <h3 class="bkp-sublead-title">{{ sub.title }}</h3>
                <p class="bkp-sublead-summary">{{ sub.summary }}</p>
                <span class="bkp-sublead-time">{{ formatDate(sub.publishedAt) }}</span>
              </NuxtLink>
            </article>
          </div>
        </div>

        <!-- 우측: 방콕포스트 시그니처 TOP STORIES & 환율 사이드바 -->
        <aside class="bkp-sidebar-column">
          <!-- TOP STORIES 랭킹 박스 -->
          <div class="bkp-top-stories-box">
            <div class="bkp-box-title">
              <span class="bkp-title-indicator" />
              <h3>TOP STORIES</h3>
              <NuxtLink to="/news/realtime" class="bkp-more-link">MORE ↗</NuxtLink>
            </div>
            <p v-if="popularLoadError" class="bkp-side-note">인기 순위를 불러올 수 없습니다.</p>
            <ol v-else class="bkp-ranking-list">
              <li v-for="(art, idx) in popularArticles.slice(0, 5)" :key="art.id" class="bkp-ranking-item">
                <span class="bkp-rank-num" :class="{ 'accent': idx < 3 }">{{ idx + 1 }}</span>
                <div class="bkp-rank-content">
                  <NuxtLink :to="`/news/${art.category}/article/${art.id}`">
                    <strong class="bkp-rank-title">{{ art.title }}</strong>
                  </NuxtLink>
                  <div class="bkp-rank-meta">
                    <span class="bkp-rank-cat">{{ categoryNames[art.category] || art.category }}</span>
                    <span>조회 {{ formatViews(art.viewCount) }}</span>
                  </div>
                </div>
              </li>
            </ol>
          </div>

          <!-- 실시간 여행 환율 위젯 -->
          <div class="bkp-fx-wrapper">
            <CurrencyRates />
          </div>
        </aside>
      </section>

      <AdSlot placement-id="main_mid" />

      <!-- ======================================================== -->
      <!-- SECTION 2: 항공 섹션 (AIRLINES & AVIATION)                -->
      <!-- ======================================================== -->
      <section v-if="airlineArticles.length" class="bkp-section-block">
        <div class="bkp-sec-header">
          <div class="bkp-sec-title-wrap">
            <span class="bkp-color-bar airline" />
            <h2>AIRLINES & AVIATION</h2>
          </div>
          <NuxtLink to="/news/airline" class="bkp-view-all">VIEW ALL 항공 뉴스 →</NuxtLink>
        </div>
        <div class="bkp-card-grid-3">
          <NewsArticleCard v-for="article in airlineArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <!-- ======================================================== -->
      <!-- SECTION 3: 호텔 섹션 (HOTELS & HOSPITALITY)              -->
      <!-- ======================================================== -->
      <section v-if="hotelArticles.length" class="bkp-section-block">
        <div class="bkp-sec-header">
          <div class="bkp-sec-title-wrap">
            <span class="bkp-color-bar hotel" />
            <h2>HOTELS & HOSPITALITY</h2>
          </div>
          <NuxtLink to="/news/hotel" class="bkp-view-all">VIEW ALL 호텔 뉴스 →</NuxtLink>
        </div>
        <div class="bkp-card-grid-3">
          <NewsArticleCard v-for="article in hotelArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <!-- ======================================================== -->
      <!-- SECTION 4: 여행지 섹션 (DESTINATIONS & TRAVEL)            -->
      <!-- ======================================================== -->
      <section v-if="destinationArticles.length" class="bkp-section-block">
        <div class="bkp-sec-header">
          <div class="bkp-sec-title-wrap">
            <span class="bkp-color-bar destination" />
            <h2>DESTINATIONS & TRAVEL</h2>
          </div>
          <NuxtLink to="/news/destination" class="bkp-view-all">VIEW ALL 여행지 뉴스 →</NuxtLink>
        </div>
        <div class="bkp-card-grid-3">
          <NewsArticleCard v-for="article in destinationArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <!-- ======================================================== -->
      <!-- SECTION 5: LATEST ALL STORIES 전체 아카이브                -->
      <!-- ======================================================== -->
      <section v-if="remainingArticles.length" class="bkp-section-block">
        <div class="bkp-sec-header">
          <div class="bkp-sec-title-wrap">
            <span class="bkp-color-bar default" />
            <h2>LATEST STORIES</h2>
          </div>
          <NuxtLink to="/news/major" class="bkp-view-all">VIEW ALL HEADLINES →</NuxtLink>
        </div>
        <div class="bkp-card-grid-3">
          <NewsArticleCard v-for="article in remainingArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <AdSlot placement-id="main_bottom" />
    </template>
  </div>
</template>
