<script setup lang="ts">
const store = useArticlesStore()
const savedStore = useSavedStore()
await useAsyncData('home-articles', () => store.load())
const categoryNames: Record<string, string> = { flights: '항공', hotels: '호텔', industry: '업계' }
</script>

<template>
  <div class="page-wrap">
    <section class="hero">
      <div>
        <p class="eyebrow">THE DAILY BRIEF · VOL. 001</p>
        <h1>여행의 다음 장면을<br><em>먼저 읽습니다.</em></h1>
        <p class="hero-copy">발권의 숫자부터 호텔의 작은 차이까지. 여행을 더 잘 아는 사람들을 위한 오늘의 인사이트.</p>
      </div>
      <p class="hero-note">항공권 특가의 맥락과<br>호텔 티어 혜택의 실제를<br>편집자의 시선으로 전합니다.</p>
    </section>
    <div class="section-heading"><h2>오늘의 브리핑</h2><span class="meta">LATEST STORIES / {{ store.articles.length.toString().padStart(2, '0') }}</span></div>
    <nav class="category-strip" aria-label="기사 카테고리">
      <NuxtLink class="category-link active" to="/">전체</NuxtLink>
      <NuxtLink class="category-link" to="/flights">항공</NuxtLink>
      <NuxtLink class="category-link" to="/hotels">호텔</NuxtLink>
    </nav>
    <p v-if="store.error" class="empty-state">{{ store.error }}</p>
    <section v-else class="article-grid">
      <article v-for="article in store.articles" :key="article.id" class="article-card">
        <NuxtLink :to="`/articles/${article.slug}`">
          <div class="article-art"><span class="art-label">{{ categoryNames[article.category] || article.category }}</span></div>
          <span class="meta">{{ article.author }} · {{ article.publishedAt?.slice(0, 10) }}</span>
          <h3>{{ article.title }}</h3><p>{{ article.summary }}</p>
        </NuxtLink>
        <button class="save-button" type="button" @click="savedStore.toggle(article.slug)">{{ savedStore.has(article.slug) ? '저장됨' : '+ 스크랩' }}</button>
      </article>
    </section>
  </div>
</template>