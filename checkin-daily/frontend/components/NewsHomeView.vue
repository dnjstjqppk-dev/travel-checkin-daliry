<script setup lang="ts">
import type { Article } from '~/stores/articles'

const store = useArticlesStore()
const route = useRoute()
const requestFetch = useRequestFetch()
const { locale, t } = useI18n()

function locUrl(path: string) {
  if (locale.value === 'en') {
    return path.startsWith('/en') ? path : `/en${path.startsWith('/') ? '' : '/'}${path}`
  }
  return path.replace(/^\/en/, '') || '/news'
}

const categoryNames: Record<string, string> = {
  major: locale.value === 'en' ? 'Major Stories' : '주요뉴스',
  airline: locale.value === 'en' ? 'Airlines' : '항공',
  hotel: locale.value === 'en' ? 'Hotels' : '호텔',
  destination: locale.value === 'en' ? 'Destinations' : '여행지',
  realtime: locale.value === 'en' ? 'Top Stories' : '실시간',
}

const searchQuery = computed(() => typeof route.query.q === 'string' ? route.query.q.trim() : '')

await useAsyncData(`news-home-${locale.value}`, () => store.load({ limit: 24, search: searchQuery.value }))
const { data: popularArticles, error: popularLoadError } = await useAsyncData<Article[]>(
  `news-home-popular-${locale.value}`,
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
            <NuxtLink :to="locUrl(`/news/${featuredArticle.category}/article/${featuredArticle.id}`)" class="bkp-hero-lead-link">
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
                <span class="bkp-hero-cta">{{ locale === 'en' ? 'READ MORE →' : '자세히 보기 →' }}</span>
              </div>
            </NuxtLink>
          </article>

          <!-- 서브 하이라이트 2열 -->
          <div v-if="subLeadArticles.length" class="bkp-sublead-row">
            <article v-for="sub in subLeadArticles" :key="sub.id" class="bkp-sublead-item">
              <NuxtLink :to="locUrl(`/news/${sub.category}/article/${sub.id}`)">
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
              <NuxtLink :to="locUrl('/news/realtime')" class="bkp-widget-more">MORE ↗</NuxtLink>
            </div>
            <p v-if="popularLoadError" class="bkp-side-note">랭킹을 불러올 수 없습니다.</p>
            <ol v-else class="bkp-rank-ordered-list">
              <li v-for="(art, idx) in popularArticles.slice(0, 5)" :key="art.id" class="bkp-rank-line">
                <span class="bkp-rank-number" :class="{ 'red': idx < 3 }">{{ idx + 1 }}</span>
                <div class="bkp-rank-body">
                  <NuxtLink :to="locUrl(`/news/${art.category}/article/${art.id}`)">
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
          <NuxtLink :to="locUrl('/news/airline')" class="bkp-sec-more">{{ locale === 'en' ? 'VIEW ALL AIRLINE NEWS →' : '항공 뉴스 전체보기 →' }}</NuxtLink>
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
          <NuxtLink :to="locUrl('/news/hotel')" class="bkp-sec-more">{{ locale === 'en' ? 'VIEW ALL HOTEL NEWS →' : '호텔 뉴스 전체보기 →' }}</NuxtLink>
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
          <NuxtLink :to="locUrl('/news/destination')" class="bkp-sec-more">{{ locale === 'en' ? 'VIEW ALL DESTINATIONS →' : '여행지 뉴스 전체보기 →' }}</NuxtLink>
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
          <NuxtLink :to="locUrl('/news/major')" class="bkp-sec-more">{{ locale === 'en' ? 'MORE STORIES →' : '주요 보도 더보기 →' }}</NuxtLink>
        </div>
        <div class="bkp-card-grid-3">
          <NewsArticleCard v-for="article in remainingArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <AdSlot placement-id="main_bottom" />
    </template>
  </div>
</template>

<style scoped>
.bkp-home-root {
  padding: 20px 0 60px;
}

.bkp-highlight-row {
  display: grid;
  grid-template-columns: 1.45fr 0.55fr;
  gap: 32px;
  align-items: start;
  margin-top: 16px;
  margin-bottom: 44px;
}

.bkp-col-main {
  min-width: 0;
}

.bkp-col-side {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

/* 1. 메인 탑 리드 기사 (16:9 와이드 화보형) */
.bkp-hero-lead-card {
  background: #FFFFFF;
  border-bottom: 2px solid #E5E7EB;
  padding-bottom: 24px;
  margin-bottom: 24px;
}

.bkp-hero-lead-link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.bkp-hero-img-wrap {
  height: 420px;
  width: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: #060D81;
}

.bkp-hero-img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.bkp-hero-lead-card:hover .bkp-hero-img-wrap img {
  transform: scale(1.02);
}

.bkp-hero-fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #060D81 0%, #1E3A8A 100%);
  display: grid;
  place-items: center;
  color: #FFFFFF;
  font-size: 24px;
  font-weight: 800;
}

.bkp-hero-fallback.small {
  height: 100%;
}

.bkp-cat-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  background: #060D81;
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 2px;
  letter-spacing: 0.5px;
}

.bkp-hero-info {
  padding-top: 16px;
}

.bkp-hero-meta {
  font-size: 12px;
  color: #6B7280;
  font-family: 'DM Mono', monospace;
  margin-bottom: 8px;
}

.bkp-hero-headline {
  font-size: clamp(24px, 3.2vw, 34px);
  font-weight: 900;
  line-height: 1.25;
  color: #111827;
  margin: 0 0 10px;
}

.bkp-hero-lead-card:hover .bkp-hero-headline {
  color: #060D81;
}

.bkp-hero-summary {
  font-size: 15px;
  color: #4B5563;
  line-height: 1.65;
  margin: 0 0 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bkp-hero-cta {
  display: inline-block;
  color: #060D81;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

/* 2. 서브 하이라이트 2열 카드 */
.bkp-sublead-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.bkp-sublead-item {
  min-width: 0;
}

.bkp-sublead-item a {
  display: block;
  text-decoration: none;
  color: inherit;
}

.bkp-sublead-img {
  height: 170px;
  width: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: #E5E7EB;
  margin-bottom: 10px;
}

.bkp-sublead-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.bkp-sublead-item:hover .bkp-sublead-img img {
  transform: scale(1.03);
}

.bkp-sub-cat {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(6, 13, 129, 0.9);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 2px;
}

.bkp-sublead-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  color: #111827;
  margin: 0 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bkp-sublead-item:hover .bkp-sublead-title {
  color: #060D81;
}

.bkp-sublead-desc {
  font-size: 13px;
  color: #6B7280;
  line-height: 1.55;
  margin: 0 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bkp-sublead-date {
  font-size: 11px;
  color: #9CA3AF;
  font-family: 'DM Mono', monospace;
}

/* 3. 우측 사이드바: TOP STORIES */
.bkp-side-widget {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-top: 3px solid #060D81;
  padding: 20px;
  border-radius: 2px;
}

.bkp-widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #E5E7EB;
  padding-bottom: 10px;
  margin-bottom: 16px;
}

.bkp-widget-indicator {
  width: 4px;
  height: 16px;
  background: #D0021B;
  margin-right: 8px;
  display: inline-block;
}

.bkp-widget-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #060D81;
  letter-spacing: 0.5px;
  flex: 1;
}

.bkp-widget-more {
  color: #6B7280;
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  font-family: 'DM Mono', monospace;
}

.bkp-side-note {
  font-size: 12px;
  color: #9CA3AF;
  padding: 12px 0;
}

.bkp-rank-ordered-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.bkp-rank-line {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #F3F4F6;
  align-items: baseline;
}

.bkp-rank-line:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.bkp-rank-number {
  font-family: 'DM Mono', monospace;
  font-size: 20px;
  font-weight: 800;
  color: #9CA3AF;
  line-height: 1;
  text-align: center;
}

.bkp-rank-number.red {
  color: #D0021B;
}

.bkp-rank-body {
  min-width: 0;
}

.bkp-rank-body a {
  text-decoration: none;
  color: inherit;
  display: block;
}

.bkp-rank-text {
  font-size: 13px;
  line-height: 1.45;
  color: #111827;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 600;
}

.bkp-rank-line:hover .bkp-rank-text {
  color: #060D81;
}

.bkp-rank-submeta {
  margin-top: 4px;
  font-size: 11px;
  color: #6B7280;
  display: flex;
  gap: 8px;
  font-family: 'DM Mono', monospace;
}

.bkp-rank-tag {
  color: #060D81;
  font-weight: 700;
}

/* 4. 섹션 스트립 */
.bkp-category-section,
.bkp-search-view {
  margin-bottom: 48px;
}

.bkp-sec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #060D81;
  padding-bottom: 10px;
  margin-bottom: 22px;
}

.bkp-sec-title-wrap {
  display: flex;
  align-items: center;
}

.bkp-color-bar {
  width: 5px;
  height: 20px;
  margin-right: 10px;
  display: inline-block;
}

.bkp-color-bar.airline { background: #0284C7; }
.bkp-color-bar.hotel { background: #D97706; }
.bkp-color-bar.destination { background: #10B981; }
.bkp-color-bar.default { background: #D0021B; }

.bkp-sec-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #111827;
  letter-spacing: 0.5px;
}

.bkp-sec-more {
  color: #060D81;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  font-family: 'DM Mono', monospace;
}

.bkp-sec-more:hover {
  text-decoration: underline;
}

.bkp-card-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.bkp-empty-state {
  padding: 40px 0;
  color: #6B7280;
  text-align: center;
  font-size: 14px;
}

@media (max-width: 900px) {
  .bkp-highlight-row {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .bkp-card-grid-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .bkp-home-root {
    padding: 12px 0 40px;
  }
  .bkp-highlight-row {
    margin-top: 8px;
    margin-bottom: 28px;
  }
  .bkp-hero-lead-card {
    padding-bottom: 16px;
    margin-bottom: 16px;
  }
  .bkp-hero-img-wrap {
    height: 200px;
  }
  .bkp-hero-headline {
    font-size: 20px;
    line-height: 1.3;
    margin-bottom: 6px;
  }
  .bkp-hero-summary {
    font-size: 13.5px;
    line-height: 1.5;
    margin-bottom: 10px;
  }
  .bkp-sublead-row {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .bkp-card-grid-3 {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .bkp-sec-header {
    margin-bottom: 14px;
  }
  .bkp-sec-header h2 {
    font-size: 17px;
  }
  .bkp-category-section,
  .bkp-search-view {
    margin-bottom: 32px;
  }
}
</style>

