<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

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
const categoryNames: Record<string, string> = {
  major: '주요뉴스',
  airline: '항공',
  hotel: '호텔',
  destination: '여행지',
  realtime: '실시간 뉴스',
}
useSeoMeta({ title: `${article.title} | 체크인데일리`, description: article.summary })
</script>

<template>
  <div class="page-wrap article-with-sidebar">
    <article class="article-detail">
      <nav class="breadcrumbs"><NuxtLink to="/news">뉴스</NuxtLink><span>/</span><NuxtLink :to="`/news/${category}`">{{ categoryNames[category] || category }}</NuxtLink></nav>
      <p class="eyebrow">{{ categoryNames[category] || category }} / CHECK-IN DAILY</p>
      <h1>{{ article.title }}</h1>
      <p class="article-summary">{{ article.summary }}</p>
      <p class="meta">{{ article.author }} · {{ article.publishedAt?.slice(0, 10) }}</p>
      <div v-if="article.cities?.length" class="location-tags article-location-tags">
        <NuxtLink v-for="city in article.cities" :key="city.id" :to="`/news/${category}/${city.countryCode}/${city.id}`">
          {{ city.country?.nameKo || city.countryCode }} · {{ city.nameKo }}
        </NuxtLink>
      </div>
      <button class="save-button" type="button" @click="savedStore.toggle(article.slug)">{{ savedStore.has(article.slug) ? '저장됨' : '+ 스크랩' }}</button>
      <AdSlot placement-id="article_top" />
      <div class="article-art article-cover" aria-hidden="true" />
      <div class="article-body" v-html="html" />
      <AdSlot placement-id="article_bottom" />
    </article>
    <aside class="article-sidebar"><NewsRegionFilter :category="category" /><AdSlot placement-id="sidebar_rect" /></aside>
  </div>
</template>
