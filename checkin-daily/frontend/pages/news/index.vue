<script setup lang="ts">
import type { Article } from '~/stores/articles'

const store = useArticlesStore()
const route = useRoute()
const requestFetch = useRequestFetch()
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
const galleryArticles = computed(() => store.articles.slice(0, 9))
const destinationArticles = computed(() => store.articles.filter((article) => article.category === 'destination').slice(0, 3))

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
  <div class="page-wrap news-home editorial-home">
    <AdSlot v-if="!searchQuery" placement-id="main_top" />

    <section v-if="searchQuery" class="search-results">
      <header class="editorial-section-heading">
        <div><p class="eyebrow">SEARCH / NEWSROOM</p><h1>“{{ searchQuery }}” 검색 결과</h1></div>
        <span>{{ store.articles.length }}건</span>
      </header>
      <p v-if="store.error" class="empty-state">{{ store.error }}</p>
      <p v-else-if="!store.articles.length" class="empty-state">검색 결과가 없습니다.</p>
      <div v-else class="news-card-grid editorial-gallery">
        <NewsArticleCard v-for="article in store.articles" :key="article.id" :article="article" />
      </div>
    </section>

    <template v-else>
      <section class="editorial-hero">
        <article v-if="featuredArticle" class="editorial-lead">
          <NuxtLink :to="`/news/${featuredArticle.category}/article/${featuredArticle.id}`" class="editorial-lead-link">
            <div class="editorial-lead-art" :class="`category-art-${featuredArticle.category}`">
              <img v-if="hasCoverImage(featuredArticle)" :src="featuredArticle.coverImage" :alt="featuredArticle.title" fetchpriority="high">
              <span class="editorial-art-kicker">{{ categoryNames[featuredArticle.category] || featuredArticle.category }} <span aria-hidden="true">/</span> TODAY'S LEAD</span>
              <span class="editorial-lead-arrow" aria-hidden="true">↗</span>
            </div>
            <div class="editorial-lead-copy">
              <p class="eyebrow">THE TRAVEL NEWS DESK <span aria-hidden="true">·</span> {{ formatDate(featuredArticle.publishedAt) }}</p>
              <h1>{{ featuredArticle.title }}</h1>
              <p>{{ featuredArticle.summary }}</p>
              <span class="editorial-read-link">기사 읽기 <span aria-hidden="true">→</span></span>
            </div>
          </NuxtLink>
        </article>
        <div v-else class="editorial-lead editorial-lead-empty">
          <p class="eyebrow">THE TRAVEL NEWS DESK</p><h1>여행의 다음 장면을<br>먼저 읽습니다.</h1>
          <p>항공과 호텔, 여행지의 변화를 빠르고 정확하게 전합니다.</p>
        </div>

        <aside class="editorial-rail">
          <section class="editorial-trending">
            <div class="editorial-rail-heading">
              <div><p class="eyebrow">MOST READ</p><h2>지금 많이 읽는 뉴스</h2></div>
              <NuxtLink to="/news/realtime" aria-label="실시간 인기 뉴스 전체 보기">전체 <span aria-hidden="true">↗</span></NuxtLink>
            </div>
            <p v-if="popularLoadError" class="editorial-rail-note">인기 순위를 불러오지 못했습니다.</p>
            <ol v-else class="editorial-ranking">
              <li v-for="(article, index) in popularArticles.slice(0, 5)" :key="article.id">
                <span class="editorial-rank-number" :class="{ 'top-rank': index < 3 }">{{ String(index + 1).padStart(2, '0') }}</span>
                <NuxtLink :to="`/news/${article.category}/article/${article.id}`">
                  <strong>{{ article.title }}</strong>
                  <small>{{ categoryNames[article.category] || article.category }} <span aria-hidden="true">·</span> 조회 {{ formatViews(article.viewCount) }}</small>
                </NuxtLink>
              </li>
              <li v-if="!popularArticles.length" class="editorial-rank-empty">기사를 읽을수록 인기 순위가 채워집니다.</li>
            </ol>
          </section>
          <CurrencyRates />
        </aside>
      </section>

      <AdSlot placement-id="main_mid" />

      <section class="editorial-gallery-section">
        <header class="editorial-section-heading">
          <div><p class="eyebrow">THE LATEST / EDITOR'S DESK</p><h2>오늘의 여행 뉴스</h2></div>
          <NuxtLink to="/news/major">전체 뉴스 보기 <span aria-hidden="true">→</span></NuxtLink>
        </header>
        <p v-if="store.error" class="empty-state">{{ store.error }}</p>
        <p v-else-if="!galleryArticles.length" class="empty-state">등록된 뉴스가 없습니다.</p>
        <div v-else class="news-card-grid editorial-gallery">
          <NewsArticleCard v-for="article in galleryArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <AdSlot placement-id="main_bottom" />

      <section v-if="destinationArticles.length" class="destination-discover">
        <header class="editorial-section-heading">
          <div><p class="eyebrow">FIELD NOTES / DESTINATIONS</p><h2>여행지에서 온 이야기</h2></div>
          <NuxtLink to="/news/destination">여행지 뉴스 <span aria-hidden="true">→</span></NuxtLink>
        </header>
        <div class="destination-gallery">
          <NewsArticleCard v-for="article in destinationArticles" :key="article.id" :article="article" />
        </div>
      </section>

      <nav class="editorial-category-nav" aria-label="뉴스 카테고리">
        <NuxtLink v-for="category in categories" :key="category.id" :to="`/news/${category.id}`">
          <span class="eyebrow">{{ category.id.toUpperCase() }}</span><strong>{{ category.name }}</strong><span>{{ category.description }}</span><span aria-hidden="true">↗</span>
        </NuxtLink>
      </nav>
    </template>
  </div>
</template>
