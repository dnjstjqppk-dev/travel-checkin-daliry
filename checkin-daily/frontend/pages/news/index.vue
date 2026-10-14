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

const featuredArticle = computed(() => store.articles[0])
const subLeadArticles = computed(() => store.articles.slice(1, 3))
const airlineArticles = computed(() => store.articles.filter((a) => a.category === 'airline').slice(0, 3))
const hotelArticles = computed(() => store.articles.filter((a) => a.category === 'hotel').slice(0, 3))
const destinationArticles = computed(() => store.articles.filter((a) => a.category === 'destination').slice(0, 3))
const remainingArticles = computed(() => store.articles.slice(3, 12))

function hasCoverImage(article: Article | undefined) {
  return Boolean(article?.coverImage && /^https:\/\//i.test(article.coverImage))
}

function formatDate(date: string | null) {
  if (!date) return 'LATEST NEWS'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(new Date(date))
}

function formatViews(views = 0) {
  return new Intl.NumberFormat('ko-KR').format(views)
}
</script>

<template>
  <div class="bkp-page-container bkp-home-root">
    <!-- 검색 모드 -->
    <section v-if="searchQuery" class="bkp-search-view">
      <div class="bkp-sec-header">
        <div class="bkp-sec-title-wrap">
          <span class="bkp-color-bar default" />
          <h2>SEARCH RESULTS: “{{ searchQuery }}”</h2>
        </div>
        <span>{{ store.articles.length }}건</span>
      </div>
      <p v-if="store.error" class="bkp-empty-state">{{ store.error }}</p>
      <p v-else-if="!store.articles.length" class="bkp-empty-state">검색 결과가 없습니다.</p>
      <div v-else class="bkp-card-grid-3">
        <NewsArticleCard v-for="article in store.articles" :key="article.id" :article="article" />
      </div>
    </section>

    <!-- 방콕포스트 스타일 정통 뉴스 메인 홈 -->
    <template v-else>
      <AdSlot placement-id="main_top" />

      <!-- ======================================================== -->
      <!-- 1. TOP HIGHLIGHT & SIDEBAR (좌 68% : 우 32%)             -->
      <!-- ======================================================== -->
      <section class="bkp-highlight-row">
        <!-- 좌측: 메인 하이라이트 + 2열 서브 뉴스 -->
        <div class="bkp-col-main">
          <!-- 대형 메인 탑 기사 -->
          <article v-if="featuredArticle" class="bkp-hero-lead-card">
            <NuxtLink :to="`/news/${featuredArticle.category}/article/${featuredArticle.id}`" class="bkp-hero-lead-link">
              <div class="bkp-hero-img-wrap">
                <img
                  v-if="hasCoverImage(featuredArticle)"
                  :src="featuredArticle.coverImage"
                  :alt="featuredArticle.title"
                  fetchpriority="high"
                >
                <div v-else class="bkp-hero-fallback">
                  <span>{{ categoryNames[featuredArticle.category] || featuredArticle.category }}</span>
                </div>
                <span class="bkp-cat-badge">
                  {{ (categoryNames[featuredArticle.category] || featuredArticle.category).toUpperCase() }}
                </span>
              </div>
              <div class="bkp-hero-info">
                <div class="bkp-hero-meta">
                  <span class="bkp-pub-date">{{ formatDate(featuredArticle.publishedAt) }}</span>
                  <span v-if="featuredArticle.viewCount" class="bkp-pub-views">· {{ formatViews(featuredArticle.viewCount) }} VIEWS</span>
                </div>
                <h1 class="bkp-hero-headline">{{ featuredArticle.title }}</h1>
                <p class="bkp-hero-summary">{{ featuredArticle.summary }}</p>
                <span class="bkp-hero-cta">READ MORE →</span>
              </div>
            </NuxtLink>
          </article>

          <!-- 서브 하이라이트 2열 -->
          <div v-if="subLeadArticles.length" class="bkp-sublead-row">
            <article v-for="sub in subLeadArticles" :key="sub.id" class="bkp-sublead-item">
              <NuxtLink :to="`/news/${sub.category}/article/${sub.id}`">
                <div class="bkp-sublead-img">
                  <img v-if="hasCoverImage(sub)" :src="sub.coverImage" :alt="sub.title" loading="lazy">
                  <div v-else class="bkp-hero-fallback small" />
                  <span class="bkp-sub-cat">{{ categoryNames[sub.category] || sub.category }}</span>
                </div>
                <h3 class="bkp-sublead-title">{{ sub.title }}</h3>
                <p class="bkp-sublead-desc">{{ sub.summary }}</p>
                <span class="bkp-sublead-date">{{ formatDate(sub.publishedAt) }}</span>
              </NuxtLink>
            </article>
          </div>
        </div>

        <!-- 우측: 방콕포스트 TOP STORIES & 환율 사이드바 -->
        <aside class="bkp-col-side">
          <div class="bkp-side-widget bkp-topstories-widget">
            <div class="bkp-widget-header">
              <span class="bkp-widget-indicator" />
              <h3>TOP STORIES</h3>
              <NuxtLink to="/news/realtime" class="bkp-widget-more">MORE ↗</NuxtLink>
            </div>
            <p v-if="popularLoadError" class="bkp-side-note">랭킹을 불러올 수 없습니다.</p>
            <ol v-else class="bkp-rank-ordered-list">
              <li v-for="(art, idx) in popularArticles.slice(0, 5)" :key="art.id" class="bkp-rank-line">
                <span class="bkp-rank-number" :class="{ 'red': idx < 3 }">{{ idx + 1 }}</span>
                <div class="bkp-rank-body">
                  <NuxtLink :to="`/news/${art.category}/article/${art.id}`">
                    <strong class="bkp-rank-text">{{ art.title }}</strong>
                  </NuxtLink>
                  <div class="bkp-rank-submeta">
                    <span class="bkp-rank-tag">{{ categoryNames[art.category] || art.category }}</span>
                    <span>{{ formatViews(art.viewCount) }} views</span>
                  </div>
                </div>
              </li>
            </ol>
          </div>

          <!-- 환율 위젯 -->
          <div class="bkp-side-widget">
            <CurrencyRates />
          </div>
        </aside>
      </section>

      <AdSlot placement-id="main_mid" />

      <!-- ======================================================== -->
      <!-- 2. AIRLINES & MILES 섹션                                 -->
      <!-- ======================================================== -->
      <section v-if="airlineArticles.length" class="bkp-category-section">
        <div class="bkp-sec-header">
          <div class="bkp-sec-title-wrap">
            <span class="bkp-color-bar airline" />
            <h2>AIRLINES & MILES</h2>
          </div>
          <NuxtLink to="/news/airline" class="bkp-sec-more">VIEW ALL AIRLINE NEWS →</NuxtLink>
        </div>
        <div class="bkp-card-grid-3">
          <NewsArticleCard v-for="article in airlineArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <!-- ======================================================== -->
      <!-- 3. HOTELS & STAY 섹션                                   -->
      <!-- ======================================================== -->
      <section v-if="hotelArticles.length" class="bkp-category-section">
        <div class="bkp-sec-header">
          <div class="bkp-sec-title-wrap">
            <span class="bkp-color-bar hotel" />
            <h2>HOTELS & STAY</h2>
          </div>
          <NuxtLink to="/news/hotel" class="bkp-sec-more">VIEW ALL HOTEL NEWS →</NuxtLink>
        </div>
        <div class="bkp-card-grid-3">
          <NewsArticleCard v-for="article in hotelArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <!-- ======================================================== -->
      <!-- 4. DESTINATIONS & TRAVEL 섹션                           -->
      <!-- ======================================================== -->
      <section v-if="destinationArticles.length" class="bkp-category-section">
        <div class="bkp-sec-header">
          <div class="bkp-sec-title-wrap">
            <span class="bkp-color-bar destination" />
            <h2>DESTINATIONS & TRAVEL</h2>
          </div>
          <NuxtLink to="/news/destination" class="bkp-sec-more">VIEW ALL DESTINATIONS →</NuxtLink>
        </div>
        <div class="bkp-card-grid-3">
          <NewsArticleCard v-for="article in destinationArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <!-- ======================================================== -->
      <!-- 5. LATEST STORIES 전체 아카이브                          -->
      <!-- ======================================================== -->
      <section v-if="remainingArticles.length" class="bkp-category-section">
        <div class="bkp-sec-header">
          <div class="bkp-sec-title-wrap">
            <span class="bkp-color-bar default" />
            <h2>LATEST STORIES</h2>
          </div>
          <NuxtLink to="/news/major" class="bkp-sec-more">MORE STORIES →</NuxtLink>
        </div>
        <div class="bkp-card-grid-3">
          <NewsArticleCard v-for="article in remainingArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <AdSlot placement-id="main_bottom" />
    </template>
  </div>
</template>
