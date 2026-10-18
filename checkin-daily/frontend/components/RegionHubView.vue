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

useSeoMeta({
  title: computed(() => `${pageTitle.value} | 체크인데일리 (Check-in Daily)`),
  ogTitle: computed(() => `${pageTitle.value} | Check-in Daily`),
  description: computed(() => `${pageTitle.value} - 아시아, 유럽, 미주 등 전 세계 주요 국가와 도시별 심층 여행 저널리즘 기사를 모아서 전해드립니다.`),
})

function formatViews(views = 0) {
  return new Intl.NumberFormat('ko-KR').format(views)
}
</script>

<template>
  <div class="bkp-page-container bkp-region-hub-root">
    <!-- 상단 브레드크럼 -->
    <nav class="bkp-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink :to="locUrl('/news')" class="bkp-bc-link">HOME</NuxtLink>
      <span class="bkp-bc-sep">›</span>
      <NuxtLink :to="locUrl('/news/region')" class="bkp-bc-link">BY REGION</NuxtLink>
      <template v-if="activeCountry && currentCountryMeta">
        <span class="bkp-bc-sep">›</span>
        <span class="bkp-bc-current">{{ currentCountryMeta.flag }} {{ currentCountryMeta.nameKo }}</span>
      </template>
      <template v-if="currentCityMeta">
        <span class="bkp-bc-sep">›</span>
        <span class="bkp-bc-current">{{ currentCityMeta.nameKo }}</span>
      </template>
    </nav>

    <!-- 섹션 타이틀 헤더 -->
    <div class="bkp-region-header-banner">
      <div class="bkp-region-title-wrap">
        <span class="bkp-region-badge">🌏 EXPLORE BY REGION</span>
        <h1 class="bkp-region-main-title">{{ pageTitle }}</h1>
        <p class="bkp-region-sub-title">
          {{ locale === 'en' 
            ? 'Discover in-depth travel, airline, and hotel stories categorized by destination countries and global gateway cities.' 
            : '전 세계 주요 국가와 거점 도시별 최신 항공, 호텔, 여행 트렌드 뉴스를 지역별로 한눈에 탐색하세요.' 
          }}
        </p>
      </div>
    </div>

    <!-- 국가별 필터 탭 바 (가로 스크롤 지원) -->
    <div class="bkp-country-tabs-wrapper">
      <div class="bkp-country-tabs">
        <button
          v-for="c in countryList"
          :key="c.code"
          type="button"
          class="bkp-country-pill"
          :class="{ active: activeCountry === c.code }"
          @click="selectCountry(c.code)"
        >
          <span class="bkp-country-flag">{{ c.flag }}</span>
          <span class="bkp-country-name">{{ locale === 'en' ? c.nameEn : c.nameKo }}</span>
        </button>
      </div>
    </div>

    <!-- 도시별 서브 필터 칩 (국가 선택 시 표시) -->
    <div v-if="cities.length" class="bkp-city-chips-bar">
      <span class="bkp-city-label">📍 {{ locale === 'en' ? 'Cities' : '주요 도시' }}:</span>
      <button
        type="button"
        class="bkp-city-chip"
        :class="{ active: activeCity === '' }"
        @click="activeCity = ''"
      >
        {{ locale === 'en' ? 'All Cities' : '전체 도시' }}
      </button>
      <button
        v-for="city in cities"
        :key="city.id"
        type="button"
        class="bkp-city-chip"
        :class="{ active: activeCity === city.id }"
        @click="selectCity(city.id)"
      >
        {{ locale === 'en' ? city.nameEn : city.nameKo }}
      </button>
    </div>

    <!-- 2단 레이아웃 (기사 카드 68% : 사이드바 32%) -->
    <div class="bkp-highlight-row">
      <!-- 좌측: 기사 리스트 -->
      <section class="bkp-col-main">
        <div class="bkp-region-results-count">
          <span>총 <strong>{{ store.articles.length }}</strong>개의 지역별 취재 기사</span>
          <span v-if="activeCountry && currentCountryMeta" class="bkp-filter-indicator">
            (필터: {{ currentCountryMeta.flag }} {{ currentCountryMeta.nameKo }}<span v-if="currentCityMeta"> · {{ currentCityMeta.nameKo }}</span>)
          </span>
        </div>

        <div v-if="!store.articles.length" class="bkp-empty-state">
          선택하신 지역에 등록된 기사가 없습니다. 다른 국가 또는 도시를 선택해 주세요.
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

      <!-- 우측: TOP STORIES & 환율 사이드바 -->
      <aside class="bkp-col-side">
        <div class="bkp-side-widget bkp-topstories-widget">
          <div class="bkp-widget-header">
            <span class="bkp-widget-indicator" />
            <h3>TOP STORIES</h3>
            <NuxtLink :to="locUrl('/news/realtime')" class="bkp-widget-more">MORE ↗</NuxtLink>
          </div>
          <ol class="bkp-rank-ordered-list">
            <li v-for="(art, idx) in popularArticles.slice(0, 5)" :key="art.id" class="bkp-rank-line">
              <span class="bkp-rank-number" :class="{ 'red': idx < 3 }">{{ idx + 1 }}</span>
              <div class="bkp-rank-body">
                <NuxtLink :to="locUrl(`/news/${art.category}/article/${art.id}`)">
                  <strong class="bkp-rank-text">{{ art.title }}</strong>
                </NuxtLink>
                <div class="bkp-rank-submeta">
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
.bkp-region-hub-root {
  padding-top: 14px;
  padding-bottom: 40px;
}

.bkp-region-header-banner {
  background: linear-gradient(135deg, #060D81 0%, #0F172A 100%);
  color: #FFFFFF;
  border-radius: 8px;
  padding: 24px 28px;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(6, 13, 129, 0.12);
}

.bkp-region-badge {
  display: inline-block;
  background: #D0021B;
  color: #FFFFFF;
  font-size: 10.5px;
  font-family: 'DM Mono', monospace;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 3px;
  margin-bottom: 10px;
  letter-spacing: 0.8px;
}

.bkp-region-main-title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.25;
}

.bkp-region-sub-title {
  margin: 0;
  font-size: 13px;
  color: #E2E8F0;
  line-height: 1.5;
  max-width: 800px;
}

/* Country Tabs Bar */
.bkp-country-tabs-wrapper {
  margin-bottom: 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}

.bkp-country-tabs {
  display: flex;
  gap: 8px;
  min-width: max-content;
}

.bkp-country-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #F1F5F9;
  border: 1px solid #CBD5E1;
  border-radius: 20px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.bkp-country-pill:hover {
  background: #E2E8F0;
  border-color: #94A3B8;
  color: #060D81;
}

.bkp-country-pill.active {
  background: #060D81;
  border-color: #060D81;
  color: #FFFFFF;
  box-shadow: 0 2px 8px rgba(6, 13, 129, 0.25);
}

.bkp-country-flag {
  font-size: 15px;
  line-height: 1;
}

/* City Filter Chips */
.bkp-city-chips-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 20px;
}

.bkp-city-label {
  font-size: 11.5px;
  font-family: 'DM Mono', monospace;
  font-weight: 800;
  color: #64748B;
  margin-right: 4px;
}

.bkp-city-chip {
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.12s ease;
}

.bkp-city-chip:hover {
  border-color: #060D81;
  color: #060D81;
}

.bkp-city-chip.active {
  background: #D0021B;
  border-color: #D0021B;
  color: #FFFFFF;
}

.bkp-region-results-count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #060D81;
  padding-bottom: 8px;
  margin-bottom: 20px;
  font-size: 12.5px;
  color: #475569;
}

.bkp-filter-indicator {
  font-size: 11.5px;
  color: #060D81;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
}

.bkp-highlight-row {
  display: grid;
  grid-template-columns: 1.45fr 0.55fr;
  gap: 32px;
}

.bkp-card-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.bkp-load-more-wrap {
  text-align: center;
  margin-top: 32px;
}

.bkp-load-more-btn {
  background: #FFFFFF;
  border: 2px solid #060D81;
  color: #060D81;
  font-size: 12.5px;
  font-family: 'DM Mono', monospace;
  font-weight: 800;
  padding: 12px 28px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.bkp-load-more-btn:hover {
  background: #060D81;
  color: #FFFFFF;
}

.bkp-empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #64748B;
  font-size: 14px;
  background: #F8FAFC;
  border: 1px dashed #CBD5E1;
  border-radius: 6px;
}

/* Sidebar Styles */
.bkp-col-side {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.bkp-side-widget {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  padding: 16px;
}

.bkp-topstories-widget {
  border-top: 3px solid #D0021B;
}

.bkp-widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  border-bottom: 1px solid #F3F4F6;
  padding-bottom: 8px;
}

.bkp-widget-header h3 {
  margin: 0;
  font-size: 14.5px;
  font-weight: 800;
  color: #111827;
  letter-spacing: 0.5px;
}

.bkp-widget-indicator {
  width: 4px;
  height: 14px;
  background: #D0021B;
  display: inline-block;
  margin-right: 6px;
}

.bkp-widget-more {
  font-size: 10.5px;
  font-family: 'DM Mono', monospace;
  font-weight: 800;
  color: #060D81;
  text-decoration: none;
}

.bkp-rank-ordered-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.bkp-rank-line {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 0;
  border-bottom: 1px solid #F3F4F6;
}

.bkp-rank-number {
  font-size: 18px;
  font-family: 'DM Mono', monospace;
  font-weight: 900;
  color: #9CA3AF;
  line-height: 1;
}

.bkp-rank-number.red {
  color: #D0021B;
}

.bkp-rank-text {
  font-size: 12.5px;
  font-weight: 700;
  color: #111827;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bkp-rank-submeta {
  font-size: 10.5px;
  color: #6B7280;
  font-family: 'DM Mono', monospace;
  margin-top: 3px;
}

@media (max-width: 900px) {
  .bkp-highlight-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .bkp-card-grid-2 {
    grid-template-columns: 1fr;
  }
  .bkp-region-main-title {
    font-size: 20px;
  }
}
</style>

