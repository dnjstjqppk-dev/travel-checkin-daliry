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

const { locale, t, locUrl } = useI18n()

const categoryNames: Record<string, string> = {
  major: locale.value === 'en' ? 'Major' : '주요뉴스',
  airline: locale.value === 'en' ? 'Airlines' : '항공',
  hotel: locale.value === 'en' ? 'Hotels' : '호텔',
  destination: locale.value === 'en' ? 'Destinations' : '여행지',
  realtime: locale.value === 'en' ? 'Top Stories' : '실시간 인기 뉴스',
}

const country = ref<{ code: string; nameKo: string } | null>(null)
const city = ref<{ id: string; nameKo: string } | null>(null)
const lastPageCount = ref(pageSize)
const isRealtime = computed(() => props.category === 'realtime')

const filters = computed(() => ({
  // When category is realtime, query all categories sorted by views
  category: isRealtime.value ? undefined : props.category,
  country: props.countryCode,
  city: props.cityId,
}))

async function loadFirstPage() {
  lastPageCount.value = await store.load({
    ...filters.value,
    limit: pageSize,
    ...(isRealtime.value ? { sort: 'views' as const } : {}),
    lang: locale.value,
  })
}

await useAsyncData(`news-list-${route.fullPath}`, loadFirstPage)

const { data: popularArticles } = await useAsyncData<Article[]>(
  `news-listing-popular-${locale.value}`,
  () => requestFetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views', lang: locale.value } }),
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

const title = computed(() => {
  if (city.value) return `${city.value.nameKo} 여행 뉴스`
  if (country.value) return `${country.value.nameKo} 여행 뉴스`
  if (isRealtime.value) return locale.value === 'en' ? 'Top Stories (Realtime)' : '실시간 인기 뉴스 (TOP STORIES)'
  if (props.category === 'major') return locale.value === 'en' ? 'Major Stories' : '주요 뉴스 (MAJOR STORIES)'
  return categoryNames[props.category || ''] || (locale.value === 'en' ? 'All News' : '전체 뉴스')
})

const { origin: siteOrigin } = useSiteDomain()
const currentLangPrefix = computed(() => locale.value === 'ko' ? '' : `/${locale.value}`)
const listCanonicalUrl = computed(() => `${siteOrigin.value}${route.path}`)

useSeoMeta({
  title: computed(() => `${title.value} | 체크인데일리 (Check-in Daily)`),
  ogTitle: computed(() => `${title.value} | Check-in Daily`),
  description: computed(() => `${title.value} - 체크인데일리 공식 뉴스 피드. 글로벌 항공, 호텔, 여행지 트렌드를 실시간으로 전해드립니다.`),
  ogDescription: computed(() => `${title.value} - 체크인데일리 공식 뉴스 피드.`),
  ogType: 'website',
  ogUrl: listCanonicalUrl,
  ogImage: computed(() => `${siteOrigin.value}/images/og-default.png`),
  twitterImage: computed(() => `${siteOrigin.value}/images/og-default.png`),
  twitterCard: 'summary_large_image',
})

useHead(() => ({
  link: [
    { rel: 'canonical', href: listCanonicalUrl.value },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.value.map((b, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: b.label,
          item: `${siteOrigin.value}${b.to}`,
        })),
      }),
    },
  ],
}))

const breadcrumbs = computed(() => [
  { label: 'HOME', to: locUrl('/news') },
  ...(props.category ? [{ label: (categoryNames[props.category] || props.category).toUpperCase(), to: locUrl(`/news/${props.category}`) }] : []),
  ...(country.value ? [{ label: country.value.nameKo, to: locUrl(props.category ? `/news/${props.category}/${country.value.code}` : `/news/region/${country.value.code}`) }] : []),
  ...(city.value ? [{ label: city.value.nameKo, to: locUrl(route.path) }] : []),
])

async function loadMore() {
  lastPageCount.value = await store.load({
    ...filters.value,
    limit: pageSize,
    offset: store.articles.length,
    ...(isRealtime.value ? { sort: 'views' as const } : {}),
    lang: locale.value,
  }, false, true)
}

function formatViews(views = 0) {
  return new Intl.NumberFormat('ko-KR').format(views)
}
</script>

<template>
  <div class="ttr-page-container ttr-listing-root">
    <!-- Tetherrock Terminal Breadcrumb -->
    <nav class="ttr-breadcrumb-nav" aria-label="현재 위치">
      <template v-for="(item, index) in breadcrumbs" :key="item.label">
        <span v-if="index" class="ttr-bc-sep">/</span>
        <NuxtLink :to="item.to" class="ttr-bc-link">{{ item.label }}</NuxtLink>
      </template>
    </nav>

    <!-- Terminal Section Header Bar -->
    <div class="ttr-list-header-bar">
      <div class="ttr-list-title-group">
        <span class="ttr-color-bar" :class="{ realtime: isRealtime }" />
        <div>
          <div class="ttr-kicker-tag">
            <span class="ping-dot" />
            <span>WIRE INTELLIGENCE</span>
          </div>
          <h1 class="ttr-list-page-title">
            {{ title }}<span v-if="city"> · {{ city.nameKo }}</span><span v-else-if="country"> · {{ country.nameKo }}</span>
          </h1>
          <p v-if="isRealtime" class="ttr-realtime-sublabel">
            ⚡ 독자 실시간 최다 조회순 및 트렌딩 랭킹 (조회수 기준 자동 집계)
          </p>
        </div>
      </div>
      <div class="ttr-list-count">
        <span class="count-badge">COUNT</span> {{ store.totalCount || store.articles.length }} ARTICLES
      </div>
    </div>

    <!-- Tetherrock 2-Column Terminal Layout (Left 68% : Right 32%) -->
    <div class="ttr-highlight-row">
      <!-- Left: Article cards grid -->
      <section class="ttr-col-main">
        <div v-if="!store.articles.length" class="ttr-empty-state">
          <span class="empty-icon">📡</span>
          <p>등록된 뉴스가 없습니다. 새 기사가 동기화되면 즉시 표시됩니다.</p>
        </div>
        <div v-else class="ttr-card-grid-2">
          <NewsArticleCard
            v-for="(article, idx) in store.articles"
            :key="article.id"
            :article="article"
            :rank="isRealtime ? idx + 1 : undefined"
          />
        </div>

        <!-- 더보기 버튼 -->
        <div v-if="canLoadMore" class="ttr-load-more-wrap">
          <button class="ttr-load-more-btn" type="button" @click="loadMore">
            LOAD MORE WIRE ARCHIVES ↓
          </button>
        </div>
      </section>

      <!-- Right: Tetherrock TOP 5 & FX Rates Sidebar -->
      <aside class="ttr-col-side">
        <div class="ttr-side-widget ttr-topstories-widget">
          <div class="ttr-widget-header">
            <div class="ttr-widget-title-wrap">
              <span class="ttr-widget-indicator" />
              <h3>TOP READ WIRE</h3>
            </div>
            <NuxtLink :to="locUrl('/news/realtime')" class="ttr-widget-more">MORE ↗</NuxtLink>
          </div>
          <ol class="ttr-rank-ordered-list">
            <li v-for="(art, idx) in popularArticles.slice(0, 5)" :key="art.id" class="ttr-rank-line">
              <span class="ttr-rank-number" :class="{ 'accent': idx < 3 }">{{ idx + 1 }}</span>
              <div class="ttr-rank-body">
                <NuxtLink :to="locUrl(`/news/${art.category}/article/${art.id}`)">
                  <strong class="ttr-rank-text">{{ art.title }}</strong>
                </NuxtLink>
                <div class="ttr-rank-submeta">
                  <span class="ttr-rank-tag">{{ categoryNames[art.category] || art.category }}</span>
                  <span class="ttr-rank-views">{{ formatViews(art.viewCount) }} VIEWS</span>
                </div>
              </div>
            </li>
          </ol>
        </div>

        <div class="ttr-side-widget">
          <CurrencyRates />
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.ttr-listing-root {
  max-width: 1360px;
  margin: 0 auto;
  padding: 24px 20px 80px;
}

.ttr-breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  color: #8b949e;
  margin-bottom: 18px;
  letter-spacing: 0.8px;
}

.ttr-bc-link {
  color: #8b949e;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s ease;
}

.ttr-bc-link:hover {
  color: #00d4aa;
}

.ttr-bc-sep {
  color: #383b52;
}

.ttr-list-header-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 1px solid #23253a;
  padding-bottom: 18px;
  margin-bottom: 28px;
}

.ttr-list-title-group {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.ttr-color-bar {
  width: 4px;
  height: 48px;
  background: #00d4aa;
  border-radius: 2px;
  flex-shrink: 0;
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.4);
}

.ttr-color-bar.realtime {
  background: #ff5252;
  box-shadow: 0 0 12px rgba(255, 82, 82, 0.5);
}

.ttr-kicker-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  color: #00d4aa;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.ping-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d4aa;
  box-shadow: 0 0 8px #00d4aa;
}

.ttr-list-page-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: #e6edf3;
  letter-spacing: -0.6px;
}

.ttr-realtime-sublabel {
  margin: 6px 0 0;
  font-size: 12px;
  color: #ff7b72;
  font-weight: 600;
  font-family: 'DM Mono', monospace;
}

.ttr-list-count {
  font-size: 12px;
  color: #8b949e;
  font-family: 'DM Mono', monospace;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  background: #181927;
  border: 1px solid #23253a;
  padding: 2px 6px;
  border-radius: 3px;
  color: #00d4aa;
  font-size: 10px;
  font-weight: 700;
}

.ttr-highlight-row {
  display: grid;
  grid-template-columns: 1.45fr 0.55fr;
  gap: 32px;
  align-items: start;
}

.ttr-col-main {
  min-width: 0;
}

.ttr-col-side {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.ttr-side-widget {
  background: #13141f;
  border: 1px solid #23253a;
  border-radius: 6px;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.ttr-side-widget::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #00d4aa, transparent);
}

.ttr-widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #23253a;
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.ttr-widget-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ttr-widget-indicator {
  width: 3px;
  height: 14px;
  background: #00d4aa;
  border-radius: 1px;
}

.ttr-widget-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  color: #e6edf3;
  letter-spacing: 0.6px;
  font-family: 'DM Mono', monospace;
}

.ttr-widget-more {
  color: #8b949e;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  font-family: 'DM Mono', monospace;
  transition: color 0.15s;
}

.ttr-widget-more:hover {
  color: #00d4aa;
}

.ttr-rank-ordered-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.ttr-rank-line {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #1c1d2e;
  align-items: baseline;
}

.ttr-rank-line:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.ttr-rank-number {
  font-family: 'DM Mono', monospace;
  font-size: 18px;
  font-weight: 800;
  color: #484f58;
  line-height: 1;
  text-align: center;
}

.ttr-rank-number.accent {
  color: #00d4aa;
}

.ttr-rank-body {
  min-width: 0;
}

.ttr-rank-body a {
  text-decoration: none;
  color: inherit;
  display: block;
}

.ttr-rank-text {
  font-size: 13px;
  line-height: 1.45;
  color: #c9d1d9;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 600;
  transition: color 0.15s;
}

.ttr-rank-line:hover .ttr-rank-text {
  color: #00d4aa;
}

.ttr-rank-submeta {
  margin-top: 5px;
  font-size: 10px;
  color: #8b949e;
  display: flex;
  gap: 10px;
  font-family: 'DM Mono', monospace;
}

.ttr-rank-tag {
  color: #58a6ff;
  font-weight: 700;
  text-transform: uppercase;
}

.ttr-rank-views {
  color: #6e7681;
}

.ttr-empty-state {
  padding: 60px 20px;
  color: #8b949e;
  text-align: center;
  font-size: 14px;
  background: #13141f;
  border: 1px dashed #23253a;
  border-radius: 6px;
}

.ttr-empty-state .empty-icon {
  font-size: 28px;
  display: block;
  margin-bottom: 12px;
}

.ttr-card-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.ttr-load-more-wrap {
  display: flex;
  justify-content: center;
  margin-top: 40px;
}

.ttr-load-more-btn {
  background: #13141f;
  border: 1px solid #23253a;
  color: #e6edf3;
  padding: 13px 36px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  letter-spacing: 0.8px;
}

.ttr-load-more-btn:hover {
  border-color: #00d4aa;
  color: #00d4aa;
  background: #181927;
  box-shadow: 0 0 16px rgba(0, 212, 170, 0.2);
}

@media (max-width: 900px) {
  .ttr-highlight-row {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

@media (max-width: 640px) {
  .ttr-listing-root {
    padding: 16px 12px 48px;
  }
  .ttr-list-header-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
  }
  .ttr-list-page-title {
    font-size: 20px;
  }
  .ttr-card-grid-2 {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .ttr-load-more-btn {
    width: 100%;
    padding: 12px 0;
  }
}
</style>
