<script setup lang="ts">
import type { Article, Country, City } from '~/stores/articles'

const props = defineProps<{
  initialCountryCode?: string
  initialCityId?: string
}>()

const route = useRoute()
const router = useRouter()
const store = useArticlesStore()
const requestFetch = useRequestFetch()
const { locale, t, locUrl } = useI18n()

const activeCountry = ref<string>(props.initialCountryCode || '')
const activeCity = ref<string>(props.initialCityId || '')
const pageSize = 12
const lastPageCount = ref(pageSize)

const countries = ref<Country[]>([])
const cities = ref<City[]>([])

const countryList = [
  { code: '', nameKo: '전체', nameEn: 'All Regions', flag: '🌐' },
  { code: 'KR', nameKo: '대한민국', nameEn: 'South Korea', flag: '🇰🇷' },
  { code: 'JP', nameKo: '일본', nameEn: 'Japan', flag: '🇯🇵' },
  { code: 'US', nameKo: '미국', nameEn: 'United States', flag: '🇺🇸' },
  { code: 'GB', nameKo: '영국', nameEn: 'United Kingdom', flag: '🇬🇧' },
  { code: 'FR', nameKo: '프랑스', nameEn: 'France', flag: '🇫🇷' },
  { code: 'IT', nameKo: '이탈리아', nameEn: 'Italy', flag: '🇮🇹' },
  { code: 'TH', nameKo: '태국', nameEn: 'Thailand', flag: '🇹🇭' },
  { code: 'VN', nameKo: '베트남', nameEn: 'Vietnam', flag: '🇻🇳' },
  { code: 'SG', nameKo: '싱가포르', nameEn: 'Singapore', flag: '🇸🇬' },
  { code: 'AU', nameKo: '호주', nameEn: 'Australia', flag: '🇦🇺' },
]

async function loadData() {
  lastPageCount.value = await store.load({
    country: activeCountry.value || undefined,
    city: activeCity.value || undefined,
    limit: pageSize,
    lang: locale.value,
  })
}

await useAsyncData(`region-hub-articles-${route.fullPath}`, loadData)

const { data: popularArticles } = await useAsyncData<Article[]>(
  `region-popular-${locale.value}`,
  () => requestFetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views', lang: locale.value } }),
  { default: () => [] },
)

watch(activeCountry, async (newCode) => {
  activeCity.value = ''
  if (newCode) {
    try {
      cities.value = await store.loadCities(newCode)
    } catch {
      cities.value = []
    }
  } else {
    cities.value = []
  }
  await loadData()
}, { immediate: true })

watch(activeCity, async () => {
  await loadData()
})

function selectCountry(code: string) {
  activeCountry.value = code
  activeCity.value = ''
}

function selectCity(cityId: string) {
  activeCity.value = activeCity.value === cityId ? '' : cityId
}

const canLoadMore = computed(() => lastPageCount.value === pageSize)

async function loadMore() {
  lastPageCount.value = await store.load({
    country: activeCountry.value || undefined,
    city: activeCity.value || undefined,
    limit: pageSize,
    offset: store.articles.length,
    lang: locale.value,
  }, false, true)
}

const currentCountryMeta = computed(() => countryList.find((c) => c.code === activeCountry.value) || countryList[0])
const currentCityMeta = computed(() => cities.value.find((c) => c.id === activeCity.value))

const pageTitle = computed(() => {
  if (currentCityMeta.value) {
    return locale.value === 'en'
      ? `${currentCityMeta.value.nameEn} Travel News`
      : `${currentCountryMeta.value?.nameKo || ''} ${currentCityMeta.value.nameKo} 여행 뉴스`
  }
  if (activeCountry.value && currentCountryMeta.value) {
    return locale.value === 'en'
      ? `${currentCountryMeta.value.nameEn} Travel News`
      : `${currentCountryMeta.value.nameKo} 여행 뉴스`
  }
  return locale.value === 'en' ? 'News by Region & Cities' : '국가 및 도시별 여행 뉴스 탐색'
})

const { origin: siteOrigin } = useSiteDomain()
const regionCanonicalUrl = computed(() => `${siteOrigin.value}${route.path}`)

useSeoMeta({
  title: computed(() => `${pageTitle.value} | 체크인데일리 (Check-in Daily)`),
  ogTitle: computed(() => `${pageTitle.value} | Check-in Daily`),
  description: computed(() => `${pageTitle.value} - 아시아, 유럽, 미주 등 전 세계 주요 국가와 도시별 심층 여행 저널리즘 기사를 모아서 전해드립니다.`),
  ogDescription: computed(() => `${pageTitle.value} - 아시아, 유럽, 미주 등 전 세계 주요 국가와 도시별 심층 여행 저널리즘 기사를 모아서 전해드립니다.`),
  ogType: 'website',
  ogUrl: regionCanonicalUrl,
  ogImage: computed(() => `${siteOrigin.value}/images/og-default.png`),
  twitterImage: computed(() => `${siteOrigin.value}/images/og-default.png`),
  twitterCard: 'summary_large_image',
})

useHead(() => ({
  link: [
    { rel: 'canonical', href: regionCanonicalUrl.value },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'HOME',
            item: `${siteOrigin.value}${locUrl('/news')}`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'BY REGION',
            item: `${siteOrigin.value}${locUrl('/news/region')}`,
          },
          ...(currentCountryMeta.value ? [{
            '@type': 'ListItem',
            position: 3,
            name: currentCountryMeta.value.nameKo,
            item: `${siteOrigin.value}${locUrl(`/news/region/${currentCountryMeta.value.code}`)}`,
          }] : []),
        ],
      }),
    },
  ],
}))

function formatViews(views = 0) {
  return new Intl.NumberFormat('ko-KR').format(views)
}
</script>

<template>
  <div class="ttr-page-container ttr-region-hub-root">
    <!-- Terminal Breadcrumb -->
    <nav class="ttr-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink :to="locUrl('/news')" class="ttr-bc-link">HOME</NuxtLink>
      <span class="ttr-bc-sep">/</span>
      <NuxtLink :to="locUrl('/news/region')" class="ttr-bc-link">BY REGION</NuxtLink>
      <template v-if="activeCountry && currentCountryMeta">
        <span class="ttr-bc-sep">/</span>
        <span class="ttr-bc-current">{{ currentCountryMeta.flag }} {{ currentCountryMeta.nameKo }}</span>
      </template>
      <template v-if="currentCityMeta">
        <span class="ttr-bc-sep">/</span>
        <span class="ttr-bc-current">{{ currentCityMeta.nameKo }}</span>
      </template>
    </nav>

    <!-- Terminal Header Banner -->
    <div class="ttr-region-header-banner">
      <div class="ttr-region-title-wrap">
        <div class="ttr-region-badge-row">
          <span class="ttr-region-badge">
            <span class="ping-dot" />
            REGIONAL RADAR
          </span>
          <span class="ttr-geo-coords">LAT/LONG SYNC ACTIVE</span>
        </div>
        <h1 class="ttr-region-main-title">{{ pageTitle }}</h1>
        <p class="ttr-region-sub-title">
          {{ locale === 'en' 
            ? 'Discover in-depth travel, airline, and hotel stories categorized by destination countries and global gateway cities.' 
            : '전 세계 주요 국가와 거점 도시별 최신 항공, 호텔, 여행 트렌드 뉴스를 지역별로 한눈에 탐색하세요.' 
          }}
        </p>
      </div>
    </div>

    <!-- Country Tabs Bar (Horizontal Scroll) -->
    <div class="ttr-country-tabs-wrapper">
      <div class="ttr-country-tabs">
        <button
          v-for="c in countryList"
          :key="c.code"
          type="button"
          class="ttr-country-pill"
          :class="{ active: activeCountry === c.code }"
          @click="selectCountry(c.code)"
        >
          <span class="ttr-country-flag">{{ c.flag }}</span>
          <span class="ttr-country-name">{{ locale === 'en' ? c.nameEn : c.nameKo }}</span>
        </button>
      </div>
    </div>

    <!-- City Sub-filter Chips -->
    <div v-if="cities.length" class="ttr-city-chips-bar">
      <span class="ttr-city-label">📍 {{ locale === 'en' ? 'CITIES' : '주요 도시' }}:</span>
      <button
        type="button"
        class="ttr-city-chip"
        :class="{ active: activeCity === '' }"
        @click="activeCity = ''"
      >
        {{ locale === 'en' ? 'All Cities' : '전체 도시' }}
      </button>
      <button
        v-for="city in cities"
        :key="city.id"
        type="button"
        class="ttr-city-chip"
        :class="{ active: activeCity === city.id }"
        @click="selectCity(city.id)"
      >
        {{ locale === 'en' ? city.nameEn : city.nameKo }}
      </button>
    </div>

    <!-- 2-Column Terminal Layout -->
    <div class="ttr-highlight-row">
      <!-- Left: Article list -->
      <section class="ttr-col-main">
        <div class="ttr-region-results-count">
          <span><span class="count-badge">COUNT</span> <strong>{{ store.articles.length }}</strong> ARTICLES</span>
          <span v-if="activeCountry && currentCountryMeta" class="ttr-filter-indicator">
            ACTIVE FILTER: {{ currentCountryMeta.flag }} {{ currentCountryMeta.nameKo }}<span v-if="currentCityMeta"> / {{ currentCityMeta.nameKo }}</span>
          </span>
        </div>

        <div v-if="!store.articles.length" class="ttr-empty-state">
          <span class="empty-icon">🌏</span>
          <p>선택하신 지역에 등록된 기사가 없습니다. 다른 국가 또는 도시를 선택해 주세요.</p>
        </div>
        <div v-else class="ttr-card-grid-2">
          <NewsArticleCard v-for="article in store.articles" :key="article.id" :article="article" />
        </div>

        <!-- Load More Button -->
        <div v-if="canLoadMore" class="ttr-load-more-wrap">
          <button class="ttr-load-more-btn" type="button" @click="loadMore">
            LOAD MORE WIRE ARCHIVES ↓
          </button>
        </div>
      </section>

      <!-- Right: Sidebar -->
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
.ttr-region-hub-root {
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
  transition: color 0.15s;
}

.ttr-bc-link:hover {
  color: #00d4aa;
}

.ttr-bc-sep {
  color: #383b52;
}

.ttr-bc-current {
  color: #00d4aa;
  font-weight: 700;
}

.ttr-region-header-banner {
  background: linear-gradient(135deg, #13141f 0%, #181927 100%);
  border: 1px solid #23253a;
  border-radius: 8px;
  padding: 28px 32px;
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
}

.ttr-region-header-banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #00d4aa, #58a6ff, transparent);
}

.ttr-region-badge-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ttr-region-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #181927;
  border: 1px solid #23253a;
  color: #00d4aa;
  font-size: 10.5px;
  font-family: 'DM Mono', monospace;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 4px;
  letter-spacing: 0.8px;
}

.ping-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d4aa;
  box-shadow: 0 0 8px #00d4aa;
}

.ttr-geo-coords {
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  color: #6e7681;
  letter-spacing: 1px;
}

.ttr-region-main-title {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.6px;
  line-height: 1.25;
  color: #e6edf3;
}

.ttr-region-sub-title {
  margin: 0;
  font-size: 13.5px;
  color: #8b949e;
  line-height: 1.6;
  max-width: 800px;
}

/* Country Tabs Bar */
.ttr-country-tabs-wrapper {
  margin-bottom: 20px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 6px;
}

.ttr-country-tabs-wrapper::-webkit-scrollbar {
  height: 4px;
}

.ttr-country-tabs-wrapper::-webkit-scrollbar-thumb {
  background: #23253a;
  border-radius: 2px;
}

.ttr-country-tabs {
  display: flex;
  gap: 8px;
  min-width: max-content;
}

.ttr-country-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #13141f;
  border: 1px solid #23253a;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 12.5px;
  font-weight: 600;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ttr-country-pill:hover {
  background: #181927;
  border-color: #383b52;
  color: #e6edf3;
}

.ttr-country-pill.active {
  background: #00d4aa;
  border-color: #00d4aa;
  color: #0d0e1a;
  font-weight: 800;
  box-shadow: 0 0 14px rgba(0, 212, 170, 0.35);
}

.ttr-country-flag {
  font-size: 15px;
  line-height: 1;
}

/* City Filter Chips */
.ttr-city-chips-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  background: #13141f;
  border: 1px solid #23253a;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 24px;
}

.ttr-city-label {
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  font-weight: 800;
  color: #00d4aa;
  margin-right: 6px;
  letter-spacing: 0.8px;
}

.ttr-city-chip {
  background: #181927;
  border: 1px solid #23253a;
  border-radius: 4px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: 'DM Mono', monospace;
}

.ttr-city-chip:hover {
  border-color: #00d4aa;
  color: #e6edf3;
}

.ttr-city-chip.active {
  background: rgba(0, 212, 170, 0.12);
  border-color: #00d4aa;
  color: #00d4aa;
  font-weight: 700;
}

.ttr-region-results-count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #23253a;
  padding-bottom: 12px;
  margin-bottom: 24px;
  font-size: 12px;
  color: #8b949e;
  font-family: 'DM Mono', monospace;
}

.count-badge {
  background: #181927;
  border: 1px solid #23253a;
  padding: 2px 6px;
  border-radius: 3px;
  color: #00d4aa;
  font-size: 10px;
  font-weight: 700;
  margin-right: 4px;
}

.ttr-filter-indicator {
  font-size: 11px;
  color: #58a6ff;
  font-weight: 700;
}

.ttr-highlight-row {
  display: grid;
  grid-template-columns: 1.45fr 0.55fr;
  gap: 32px;
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

.ttr-card-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.ttr-load-more-wrap {
  text-align: center;
  margin-top: 36px;
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

.ttr-empty-state {
  padding: 60px 20px;
  text-align: center;
  color: #8b949e;
  font-size: 14px;
  background: #13141f;
  border: 1px dashed #23253a;
  border-radius: 6px;
}

.ttr-empty-state .empty-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 12px;
}

/* Sidebar Styles */
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
  margin-bottom: 16px;
  border-bottom: 1px solid #23253a;
  padding-bottom: 12px;
}

.ttr-widget-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ttr-widget-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  color: #e6edf3;
  letter-spacing: 0.6px;
  font-family: 'DM Mono', monospace;
}

.ttr-widget-indicator {
  width: 3px;
  height: 14px;
  background: #00d4aa;
  border-radius: 1px;
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
  padding: 0;
  margin: 0;
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
  font-size: 18px;
  font-family: 'DM Mono', monospace;
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
  font-weight: 600;
  color: #c9d1d9;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color 0.15s;
}

.ttr-rank-line:hover .ttr-rank-text {
  color: #00d4aa;
}

.ttr-rank-submeta {
  font-size: 10px;
  color: #6e7681;
  font-family: 'DM Mono', monospace;
  margin-top: 4px;
}

@media (max-width: 900px) {
  .ttr-highlight-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .ttr-region-hub-root {
    padding: 16px 12px 48px;
  }
  .ttr-region-header-banner {
    padding: 20px;
  }
  .ttr-card-grid-2 {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .ttr-region-main-title {
    font-size: 22px;
  }
  .ttr-load-more-btn {
    width: 100%;
    padding: 12px 0;
  }
}
</style>

