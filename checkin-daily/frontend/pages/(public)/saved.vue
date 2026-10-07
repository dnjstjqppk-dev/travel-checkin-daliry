<script setup lang="ts">
const store = useArticlesStore()
const savedStore = useSavedStore()
await useAsyncData('saved-articles', () => store.load())
const savedArticles = computed(() => store.articles.filter((article) => savedStore.has(article.slug)))
</script>

<template>
  <div class="page-wrap">
    <section class="hero"><div><p class="eyebrow">YOUR READING LIST</p><h1>다시 읽을 여행의<br><em>메모.</em></h1><p class="hero-copy">스크랩한 기사를 이 브라우저에 저장합니다.</p></div></section>
    <div class="section-heading"><h2>스크랩한 기사</h2><span class="meta">{{ savedArticles.length.toString().padStart(2, '0') }} SAVED</span></div>
    <ClientOnly>
      <section v-if="savedArticles.length" class="article-grid"><article v-for="article in savedArticles" :key="article.id" class="article-card"><NuxtLink :to="`/articles/${article.slug}`"><div class="article-art"><span class="art-label">{{ article.category.toUpperCase() }}</span></div><span class="meta">{{ article.author }}</span><h3>{{ article.title }}</h3><p>{{ article.summary }}</p></NuxtLink><button class="save-button" type="button" @click="savedStore.toggle(article.slug)">스크랩 해제</button></article></section>
      <p v-else class="empty-state">저장한 기사가 없습니다.</p>
    </ClientOnly>
  </div>
</template>