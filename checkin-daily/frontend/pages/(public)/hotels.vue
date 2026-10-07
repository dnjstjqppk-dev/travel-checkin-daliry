<script setup lang="ts">
const store = useArticlesStore()
const savedStore = useSavedStore()
await useAsyncData('hotel-articles', () => store.load('hotels'))
</script>

<template>
  <div class="page-wrap">
    <section class="hero"><div><p class="eyebrow">HOTEL INTELLIGENCE / 02</p><h1>체크인 이후의<br><em>경험을 읽다.</em></h1><p class="hero-copy">멤버십 티어와 객실 혜택, 예약 조건이 실제 투숙에서 어떻게 달라지는지 살펴봅니다.</p></div></section>
    <div class="section-heading"><h2>호텔 브리핑</h2><span class="meta">HOTELS</span></div>
    <p v-if="store.error" class="empty-state">{{ store.error }}</p>
    <section v-else class="article-grid"><article v-for="article in store.articles" :key="article.id" class="article-card"><NuxtLink :to="`/articles/${article.slug}`"><div class="article-art"><span class="art-label">HOTELS</span></div><span class="meta">{{ article.author }} · {{ article.publishedAt?.slice(0, 10) }}</span><h3>{{ article.title }}</h3><p>{{ article.summary }}</p></NuxtLink><button class="save-button" type="button" @click="savedStore.toggle(article.slug)">{{ savedStore.has(article.slug) ? '저장됨' : '+ 스크랩' }}</button></article></section>
  </div>
</template>