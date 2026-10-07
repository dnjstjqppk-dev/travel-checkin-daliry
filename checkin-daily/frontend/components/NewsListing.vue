<script setup lang="ts">
const props = defineProps<{
  category?: string
  countryCode?: string
  cityId?: string
}>()

const route = useRoute()
const store = useArticlesStore()
const pageSize = 12
const categoryNames: Record<string, string> = {
  major: '주요뉴스',
  airline: '항공',
  hotel: '호텔',
  destination: '여행지',
  realtime: '실시간 뉴스',
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
  lastPageCount.value = await store.load({ ...filters.value, limit: pageSize })
}

await useAsyncData(`news-list-${route.fullPath}`, loadFirstPage)

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
  { label: '뉴스', to: '/news' },
  ...(props.category ? [{ label: title.value, to: `/news/${props.category}` }] : []),
  ...(country.value ? [{ label: country.value.nameKo, to: props.category ? `/news/${props.category}/${country.value.code}` : `/news/region/${country.value.code}` }] : []),
  ...(city.value ? [{ label: city.value.nameKo, to: route.path }] : []),
])

async function loadMore() {
  lastPageCount.value = await store.load({ ...filters.value, limit: pageSize, offset: store.articles.length }, false, true)
}
</script>

<template>
  <div class="page-wrap news-list-page">
    <nav class="breadcrumbs" aria-label="현재 위치">
      <template v-for="(item, index) in breadcrumbs" :key="item.label">
        <span v-if="index" aria-hidden="true">/</span>
        <NuxtLink :to="item.to">{{ item.label }}</NuxtLink>
      </template>
    </nav>
    <header class="news-list-heading">
      <div>
        <p class="eyebrow">CHECK-IN DAILY / NEWS DESK</p>
        <h1>{{ title }}<span v-if="city"> · {{ city.nameKo }}</span><span v-else-if="country"> · {{ country.nameKo }}</span></h1>
        <p>여행 업계의 오늘을 읽는 간결한 브리핑.</p>
      </div>
      <NuxtLink class="button" to="/news">전체 뉴스</NuxtLink>
    </header>

    <div class="news-list-layout">
      <section class="news-list-main">
        <div class="news-list-toolbar">
          <span>기사 {{ store.articles.length }}건</span>
          <NuxtLink v-if="countryCode" :to="category ? `/news/${category}` : '/news/region'">지역 필터 초기화</NuxtLink>
        </div>
        <p v-if="store.error" class="empty-state">{{ store.error }}</p>
        <p v-else-if="!store.articles.length" class="empty-state">조건에 맞는 뉴스가 없습니다.</p>
        <section v-else class="news-card-grid" aria-label="뉴스 목록">
          <NewsArticleCard v-for="article in store.articles" :key="article.id" :article="article" />
        </section>
        <button v-if="canLoadMore" class="button load-more" type="button" :disabled="store.loading" @click="loadMore">
          {{ store.loading ? '불러오는 중...' : '뉴스 더 보기' }}
        </button>
      </section>
      <aside class="news-list-sidebar">
        <NewsRegionFilter :category="category" :country-code="countryCode" :city-id="cityId" />
        <AdSlot placement-id="sidebar_rect" />
      </aside>
    </div>
  </div>
</template>
