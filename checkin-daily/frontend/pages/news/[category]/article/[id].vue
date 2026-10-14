<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import type { Article } from '~/stores/articles'

const route = useRoute()
const store = useArticlesStore()
const savedStore = useSavedStore()
const category = String(route.params.category)
let article
try {
  article = await store.loadById(String(route.params.id), category)
} catch {
  throw createError({ statusCode: 404, statusMessage: 'News article not found' })
}
const html = DOMPurify.sanitize(await marked.parse(article.content || ''))
const { data: recommendedData } = await useAsyncData(
  `article-recommended-${article.id}`,
  () => $fetch<Article[]>('/api/articles', { query: { category, limit: 5, sort: 'views' } }),
)
const recommendedArticles = computed(() => (recommendedData.value || []).filter((item) => item.id !== article.id).slice(0, 3))
const categoryNames: Record<string, string> = {
  major: '주요뉴스',
  airline: '항공',
  hotel: '호텔',
  destination: '여행지',
  realtime: '실시간 뉴스',
}
useSeoMeta({ title: `${article.title} | 체크인데일리`, description: article.summary })

function hasCoverImage(value: string) {
  return /^https:\/\//i.test(value)
}
</script>

<template>
  <div class="page-wrap article-editorial-layout">
    <article class="article-detail">
      <nav class="breadcrumbs" aria-label="현재 위치"><NuxtLink to="/news">뉴스</NuxtLink><span aria-hidden="true">/</span><NuxtLink :to="`/news/${category}`">{{ categoryNames[category] || category }}</NuxtLink><span aria-hidden="true">/</span><span>{{ article.title }}</span></nav>
      <header class="article-editorial-header">
        <p class="eyebrow">{{ categoryNames[category] || category }} <span aria-hidden="true">/</span> CHECK-IN DAILY</p>
        <h1>{{ article.title }}</h1>
        <p class="article-summary">{{ article.summary }}</p>
        <div class="article-byline">
          <span class="article-author-mark">C.</span>
          <span><strong>{{ article.author || '체크인데일리 편집팀' }}</strong><small>{{ article.publishedAt?.slice(0, 10) }} · 조회 {{ (article.viewCount || 0).toLocaleString('ko-KR') }}</small></span>
          <button class="save-button" type="button" @click="savedStore.toggle(article.slug)">{{ savedStore.has(article.slug) ? '저장됨' : '+ 스크랩' }}</button>
        </div>
      </header>
      <div v-if="article.cities?.length" class="location-tags article-location-tags">
        <NuxtLink v-for="city in article.cities" :key="city.id" :to="`/news/${category}/${city.countryCode}/${city.id}`">
          {{ city.country?.nameKo || city.countryCode }} · {{ city.nameKo }}
        </NuxtLink>
      </div>
      <AdSlot placement-id="article_top" />
      <div class="article-art article-cover" :class="`category-art-${article.category}`">
        <img v-if="hasCoverImage(article.coverImage)" :src="article.coverImage" :alt="article.title" fetchpriority="high">
        <span class="art-label">{{ categoryNames[article.category] || article.category }}</span>
      </div>
      <AdSlot placement-id="article_mid" />
      <div class="article-body" v-html="html" />
      <AdSlot placement-id="article_bottom" />
      <section v-if="recommendedArticles.length" class="article-recommended">
        <AdSlot placement-id="article_related" />
        <header class="editorial-section-heading">
          <div><p class="eyebrow">MORE TO EXPLORE</p><h2>이어 읽기</h2></div>
          <NuxtLink to="/news/realtime">인기 뉴스 <span aria-hidden="true">→</span></NuxtLink>
        </header>
        <div class="news-card-grid destination-gallery">
          <NewsArticleCard v-for="item in recommendedArticles" :key="item.id" :article="item" />
        </div>
      </section>
    </article>
    <aside class="article-sidebar">
      <CurrencyRates />
      <AdSlot placement-id="sidebar_rect" />
      <NuxtLink class="article-back-to-news" to="/news">체크인데일리 뉴스룸 <span aria-hidden="true">↗</span></NuxtLink>
    </aside>
  </div>
</template>
