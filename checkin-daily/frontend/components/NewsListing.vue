<script setup lang="ts">
import type { Article } from '~/stores/articles'

const props = defineProps<{
  category?: string
  countryCode?: string
  cityId?: string
}>()

const route = useRoute()
const store = useArticlesStore()
const requestFetch = useRequestFetch()
const pageSize = 12

const categoryNames: Record<string, string> = {
  major: '주요뉴스',
  airline: '항공',
  hotel: '호텔',
  destination: '여행지',
  realtime: '실시간 인기 뉴스',
}

const country = ref<{ code: string; nameKo: string } | null>(null)
const city = ref<{ id: string; nameKo: string } | null>(null)
const lastPageCount = ref(pageSize)

const filters = computed(() => ({
  category: props.category,
  country: props.countryCode,
  city: props.cityId,
}))

async function loadFirstPage() {
  lastPageCount.value = await store.load({
    ...filters.value,
    limit: pageSize,
    ...(props.category === 'realtime' ? { sort: 'views' as const } : {}),
  })
}

await useAsyncData(`news-list-${route.fullPath}`, loadFirstPage)

const { data: popularArticles } = await useAsyncData<Article[]>(
  'news-listing-popular',
  () => requestFetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views' } }),
  { default: () => [] },
)

watch(filters, async () => {
  await loadFirstPage()
}, { deep: true })

watch(() => [props.countryCode, props.cityId], async ([countryCode, cityId]) => {
  country.value = null
  city.value = null
  if (!countryCode) return
  try {
    const countries = await store.loadCountries()
    country.value = countries.find((item) => item.code === countryCode) || null
    const cities = await store.loadCities(countryCode)
    city.value = cities.find((item) => item.id === cityId) || null
  } catch {
    country.value = null
    city.value = null
  }
}, { immediate: true })

const canLoadMore = computed(() => lastPageCount.value === pageSize)
const title = computed(() => categoryNames[props.category || ''] || '전체 뉴스')
const breadcrumbs = computed(() => [
  { label: 'HOME', to: '/news' },
  ...(props.category ? [{ label: (categoryNames[props.category] || props.category).toUpperCase(), to: `/news/${props.category}` }] : []),
  ...(country.value ? [{ label: country.value.nameKo, to: props.category ? `/news/${props.category}/${country.value.code}` : `/news/region/${country.value.code}` }] : []),
  ...(city.value ? [{ label: city.value.nameKo, to: route.path }] : []),
])

async function loadMore() {
  lastPageCount.value = await store.load({
    ...filters.value,
    limit: pageSize,
    offset: store.articles.length,
    ...(props.category === 'realtime' ? { sort: 'views' as const } : {}),
  }, false, true)
}

function formatViews(views = 0) {
  return new Intl.NumberFormat('ko-KR').format(views)
}
</script>

<template>
  <div class="bkp-page-container bkp-listing-root">
    <!-- 방콕포스트 스타일 상단 브레드크럼 -->
    <nav class="bkp-breadcrumb-nav" aria-label="현재 위치">
      <template v-for="(item, index) in breadcrumbs" :key="item.label">
        <span v-if="index" class="bkp-bc-sep">›</span>
        <NuxtLink :to="item.to" class="bkp-bc-link">{{ item.label }}</NuxtLink>
      </template>
    </nav>

    <!-- 섹션 헤더 바 -->
    <div class="bkp-list-header-bar">
      <div class="bkp-list-title-group">
        <span class="bkp-color-bar default" />
        <h1 class="bkp-list-page-title">
          {{ title }}<span v-if="city"> · {{ city.nameKo }}</span><span v-else-if="country"> · {{ country.nameKo }}</span>
        </h1>
      </div>
      <div class="bkp-list-count">
        총 {{ store.articles.length }}개의 보도 기사
      </div>
    </div>

    <!-- 방콕포스트 2단 레이아웃 (좌측 리스트 68% : 우측 사이드바 32%) -->
    <div class="bkp-highlight-row">
      <!-- 좌측: 기사 카드 그리드 -->
      <section class="bkp-col-main">
        <div v-if="!store.articles.length" class="bkp-empty-state">
          등록된 뉴스가 없습니다.
        </div>
        <div v-else class="bkp-card-grid-2">
          <NewsArticleCard v-for="article in store.articles" :key="article.id" :article="article" />
        </div>

        <!-- 더보기 버튼 -->
        <div v-if="canLoadMore" class="bkp-load-more-wrap">
          <button class="bkp-load-more-btn" type="button" @click="loadMore">
            LOAD MORE STORIES (더보기) ↓
          </button>
        </div>
      </section>

      <!-- 우측: 방콕포스트 TOP STORIES & 환율 사이드바 -->
      <aside class="bkp-col-side">
        <div class="bkp-side-widget bkp-topstories-widget">
          <div class="bkp-widget-header">
            <span class="bkp-widget-indicator" />
            <h3>TOP STORIES</h3>
            <NuxtLink to="/news/realtime" class="bkp-widget-more">MORE ↗</NuxtLink>
          </div>
          <ol class="bkp-rank-ordered-list">
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

        <div class="bkp-side-widget">
          <CurrencyRates />
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.bkp-listing-root {
  padding: 20px 0 60px;
}

.bkp-breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  color: #6B7280;
  margin-bottom: 14px;
}

.bkp-bc-link {
  color: #4B5563;
  text-decoration: none;
  font-weight: 600;
}

.bkp-bc-link:hover {
  color: #060D81;
}

.bkp-bc-sep {
  color: #9CA3AF;
}

.bkp-list-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #060D81;
  padding-bottom: 10px;
  margin-bottom: 24px;
}

.bkp-list-title-group {
  display: flex;
  align-items: center;
}

.bkp-list-page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.5px;
}

.bkp-list-count {
  font-size: 12px;
  color: #6B7280;
  font-family: 'DM Mono', monospace;
}

.bkp-highlight-row {
  display: grid;
  grid-template-columns: 1.45fr 0.55fr;
  gap: 32px;
  align-items: start;
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

.bkp-empty-state {
  padding: 40px 0;
  color: #6B7280;
  text-align: center;
  font-size: 14px;
}

.bkp-card-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
}

.bkp-load-more-wrap {
  display: flex;
  justify-content: center;
  margin-top: 36px;
}

.bkp-load-more-btn {
  background: #FFFFFF;
  border: 1px solid #060D81;
  color: #060D81;
  padding: 12px 32px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.bkp-load-more-btn:hover {
  background: #060D81;
  color: #FFFFFF;
}

@media (max-width: 900px) {
  .bkp-highlight-row {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

@media (max-width: 640px) {
  .bkp-listing-root {
    padding: 12px 0 40px;
  }
  .bkp-list-header-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 16px;
  }
  .bkp-list-page-title {
    font-size: 20px;
  }
  .bkp-card-grid-2 {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .bkp-load-more-btn {
    width: 100%;
    padding: 12px 0;
  }
}
</style>
