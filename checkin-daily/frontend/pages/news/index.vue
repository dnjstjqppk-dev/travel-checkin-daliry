<script setup lang="ts">
const store = useArticlesStore()
const route = useRoute()
const categories = [
  { id: 'major', name: '주요뉴스', description: '오늘의 핵심 여행 업계 소식' },
  { id: 'airline', name: '항공', description: '항공권, 마일리지, 운임 정보' },
  { id: 'hotel', name: '호텔', description: '호텔 멤버십과 체크인 혜택' },
  { id: 'destination', name: '여행지', description: '국가와 도시별 여행 브리핑' },
]
const categoryNames = Object.fromEntries([
  ...categories.map(({ id, name }) => [id, name]),
  ['realtime', '실시간 뉴스'],
])
const searchQuery = computed(() => typeof route.query.q === 'string' ? route.query.q.trim() : '')

await useAsyncData('news-home', () => store.load({ limit: 24, search: searchQuery.value }))
watch(searchQuery, async (search) => {
  await store.load({ limit: 24, search })
})

const groups = computed(() => categories.map((category) => ({
  ...category,
  articles: store.articles.filter((article) => article.category === category.id).slice(0, 3),
})))
const realtime = computed(() => store.articles.slice(0, 5))
</script>

<template>
  <div class="page-wrap news-home">
    <AdSlot v-if="!searchQuery" placement-id="main_top" />
    <section v-if="!searchQuery" class="news-home-hero">
      <div class="news-home-lead">
        <p class="eyebrow">THE TRAVEL NEWS DESK · TODAY</p>
        <h1>여행의 오늘,<br><em>한눈에 읽다.</em></h1>
        <p>항공과 호텔, 여행지의 변화를 빠르고 정확하게 전합니다.</p>
        <NuxtLink class="button button-primary" to="/news/major">주요 뉴스 보기</NuxtLink>
      </div>
      <div class="news-headlines">
        <div class="box-title"><h2>최신 브리핑</h2><NuxtLink to="/news/realtime">전체 보기 →</NuxtLink></div>
        <p v-if="store.error" class="empty-state">{{ store.error }}</p>
        <NuxtLink v-for="(article, index) in realtime.slice(0, 4)" :key="article.id" class="headline-row" :to="`/news/${article.category}/article/${article.id}`">
          <span class="headline-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span><strong>{{ article.title }}</strong><small>{{ categoryNames[article.category] || article.category }} · {{ article.publishedAt?.slice(0, 10) }}</small></span>
        </NuxtLink>
      </div>
    </section>

    <section v-if="searchQuery" class="search-results">
      <header class="box-title"><div><p class="eyebrow">SEARCH / NEWS DESK</p><h2>“{{ searchQuery }}” 검색 결과</h2></div><span>{{ store.articles.length }}건</span></header>
      <p v-if="store.error" class="empty-state">{{ store.error }}</p>
      <p v-else-if="!store.articles.length" class="empty-state">검색 결과가 없습니다.</p>
      <div v-else class="news-card-grid"><NewsArticleCard v-for="article in store.articles" :key="article.id" :article="article" /></div>
    </section>
    <div v-else class="news-home-columns">
      <div class="news-home-feed">
        <section v-for="group in groups" :key="group.id" class="news-section-box">
          <div class="box-title">
            <div><p class="eyebrow">{{ group.id.toUpperCase() }}</p><h2>{{ group.name }}</h2></div>
            <NuxtLink :to="`/news/${group.id}`">더 보기 →</NuxtLink>
          </div>
          <p class="section-description">{{ group.description }}</p>
          <div v-if="group.articles.length" class="compact-news-list">
            <NuxtLink v-for="article in group.articles" :key="article.id" :to="`/news/${article.category}/article/${article.id}`">
              <span class="compact-date">{{ article.publishedAt?.slice(5, 10) || '속보' }}</span>
              <strong>{{ article.title }}</strong>
              <span v-if="article.cities?.length" class="compact-location">{{ article.cities[0]?.countryCode }} · {{ article.cities[0]?.nameKo }}</span>
            </NuxtLink>
          </div>
          <p v-else class="empty-state compact-empty">등록된 뉴스가 없습니다.</p>
        </section>
      </div>
      <aside class="news-home-sidebar">
        <NewsRegionFilter />
        <section class="news-section-box realtime-box">
          <div class="box-title"><h2>실시간 뉴스</h2><NuxtLink to="/news/realtime">더 보기 →</NuxtLink></div>
          <ol class="ranked-news">
            <li v-for="(article, index) in realtime" :key="article.id">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <NuxtLink :to="`/news/${article.category}/article/${article.id}`">{{ article.title }}</NuxtLink>
            </li>
          </ol>
        </section>
        <AdSlot placement-id="sidebar_rect" />
        <nav class="region-shortcuts">
          <p class="eyebrow">REGION DESK</p>
          <NuxtLink to="/news/region/JP">일본 뉴스 →</NuxtLink>
          <NuxtLink to="/news/region/KR">대한민국 뉴스 →</NuxtLink>
          <NuxtLink to="/news/region/US">미국 뉴스 →</NuxtLink>
        </nav>
      </aside>
    </div>
  </div>
</template>
