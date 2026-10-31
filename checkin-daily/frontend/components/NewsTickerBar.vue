<script setup lang="ts">
import type { Article } from '~/stores/articles'

const props = defineProps<{
  articles?: Article[]
}>()

const { locale, locUrl } = useI18n()

interface TrendingResponse {
  success: boolean
  articles: Array<{
    id: number
    title: string
    slug: string
    category: string
    isBreaking: boolean
    viewCount: number
  }>
}

const { data: trendingData } = await useFetch<TrendingResponse>('/api/trending', {
  key: 'ticker-trending-articles',
  default: () => ({ success: true, articles: [] }),
})

const dynamicTrendingItems = computed(() => {
  if (trendingData.value?.articles?.length) {
    return trendingData.value.articles.slice(0, 5).map((a) => ({
      id: a.id,
      category: a.category,
      isBreaking: a.isBreaking,
      title: a.title,
    }))
  }
  return []
})
</script>

<template>
  <div class="ticker-bar" aria-label="실시간 여행 지표 및 속보 레이더">
    <div class="ticker-scroll" id="ticker-scroll">
      <!-- First set of items -->


      <!-- Dynamic breaking news wire inside ticker -->
      <template v-for="news in dynamicTrendingItems" :key="`n1-${news.id}`">
        <NuxtLink :to="locUrl(`/news/${news.category}/article/${news.id}`)" class="ticker-item news-item">
          <span class="badge" :class="news.isBreaking ? 'red-badge' : 'mint-badge'">
            {{ news.isBreaking ? 'FLASH' : 'HOT' }}
          </span>
          <span class="news-text">{{ news.title }}</span>
        </NuxtLink>
      </template>

      <!-- Seamless duplicated set for infinite loop -->


      <template v-for="news in dynamicTrendingItems" :key="`n2-${news.id}`">
        <NuxtLink :to="locUrl(`/news/${news.category}/article/${news.id}`)" class="ticker-item news-item">
          <span class="badge" :class="news.isBreaking ? 'red-badge' : 'mint-badge'">
            {{ news.isBreaking ? 'FLASH' : 'HOT' }}
          </span>
          <span class="news-text">{{ news.title }}</span>
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ticker-bar {
  height: 34px;
  background: var(--bg-secondary, #13141f);
  border-bottom: 1px solid var(--border, #23253a);
  display: flex;
  align-items: center;
  overflow: hidden;
  flex-shrink: 0;
  width: 100%;
}

.ticker-scroll {
  display: flex;
  gap: 28px;
  animation: tickerScroll 42s linear infinite;
  padding: 0 20px;
  white-space: nowrap;
  will-change: transform;
}

.ticker-scroll:hover {
  animation-play-state: paused;
}

@keyframes tickerScroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.ticker-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-muted, #8e99aa);
  text-decoration: none;
}

.ticker-item .sym {
  color: #ffffff;
  font-weight: 700;
  font-size: 11.5px;
  letter-spacing: -0.2px;
}

.ticker-item .price {
  color: var(--text-secondary, #d2d9e3);
  font-weight: 600;
  font-size: 11.5px;
}

.ticker-item .green {
  color: var(--green, #00d4aa);
  font-weight: 700;
  font-size: 11.5px;
}

.ticker-item .red {
  color: var(--red, #f6465d);
  font-weight: 700;
  font-size: 11.5px;
}

.ticker-item.news-item {
  cursor: pointer;
}

.ticker-item.news-item:hover .news-text {
  color: var(--accent, #00d4aa);
  text-decoration: underline;
}

.news-text {
  color: var(--text-primary, #f0f4f8);
  font-size: 11.5px;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  font-size: 9px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.mint-badge {
  background: rgba(0, 212, 170, 0.15);
  color: var(--accent, #00d4aa);
  border: 1px solid rgba(0, 212, 170, 0.3);
}

.red-badge {
  background: rgba(246, 70, 93, 0.15);
  color: var(--red, #f6465d);
  border: 1px solid rgba(246, 70, 93, 0.3);
}
</style>
