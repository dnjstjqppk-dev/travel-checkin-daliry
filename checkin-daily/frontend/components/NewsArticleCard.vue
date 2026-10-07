<script setup lang="ts">
import type { Article } from '~/stores/articles'

defineProps<{ article: Article }>()
const savedStore = useSavedStore()

const categoryNames: Record<string, string> = {
  major: '주요뉴스',
  airline: '항공',
  hotel: '호텔',
  destination: '여행지',
  realtime: '실시간',
  flights: '항공',
  hotels: '호텔',
  industry: '업계',
}
</script>

<template>
  <article class="news-card">
    <NuxtLink :to="`/news/${article.category}/article/${article.id}`">
      <div class="news-card-art"><span class="art-label">{{ categoryNames[article.category] || article.category }}</span></div>
      <div class="news-card-meta">{{ article.author }} · {{ article.publishedAt?.slice(0, 10) || '속보' }}</div>
      <h3>{{ article.title }}</h3>
      <p>{{ article.summary }}</p>
      <div v-if="article.cities?.length" class="location-tags">
        <span v-for="city in article.cities" :key="city.id">{{ city.countryCode }} · {{ city.nameKo }}</span>
      </div>
    </NuxtLink>
    <button class="save-button" type="button" @click="savedStore.toggle(article.slug)">
      {{ savedStore.has(article.slug) ? '저장됨' : '+ 스크랩' }}
    </button>
  </article>
</template>
