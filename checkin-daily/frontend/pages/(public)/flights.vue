<script setup lang="ts">
const store = useArticlesStore()
const savedStore = useSavedStore()
await useAsyncData('flight-articles', () => store.load('flights'))
</script>

<template>
  <div class="page-wrap">
    <section class="hero"><div><p class="eyebrow">FLIGHT INTELLIGENCE / 01</p><h1>항공, 숫자 너머의<br><em>좋은 선택.</em></h1><p class="hero-copy">발권과 운임, 마일리지의 조건을 읽고 다음 여행의 가치를 따져봅니다.</p></div></section>
    <div class="section-heading"><h2>항공 브리핑</h2><span class="meta">FLIGHTS</span></div>
    <p v-if="store.error" class="empty-state">{{ store.error }}</p>
    <section v-else class="article-grid"><article v-for="article in store.articles" :key="article.id" class="article-card"><NuxtLink :to="`/articles/${article.slug}`"><div class="article-art"><span class="art-label">FLIGHTS</span></div><span class="meta">{{ article.author }} · {{ article.publishedAt?.slice(0, 10) }}</span><h3>{{ article.title }}</h3><p>{{ article.summary }}</p></NuxtLink><button class="save-button" type="button" @click="savedStore.toggle(article.slug)">{{ savedStore.has(article.slug) ? '저장됨' : '+ 스크랩' }}</button></article></section>
  </div>
</template>