<script setup lang="ts">
import type { Article } from '~/stores/articles'

const props = defineProps<{
  articles?: Article[]
}>()

const { locUrl } = useI18n()

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

interface CurrencyRate {
  code: string
  country: string
  currency: string
  currencyName: string
  per1000Krw: number
}

interface ExchangeRates {
  rates: CurrencyRate[]
}

const { data: fxData } = await useFetch<ExchangeRates>('/api/exchange-rates', {
  key: 'ticker-fx-rates',
  default: () => ({ rates: [] }),
})

const { data: trendingData } = await useFetch<TrendingResponse>('/api/trending', {
  key: 'ticker-trending-articles',
  default: () => ({ success: true, articles: [] }),
})

const tickerItems = computed(() => {
  if (trendingData.value?.articles?.length) {
    return trendingData.value.articles.map((a) => ({
      id: a.id,
      category: a.category,
      isBreaking: a.isBreaking,
      title: `${a.isBreaking ? '⚡ [속보] ' : '🔥 [인기] '}${a.title}`,
    }))
  }
  if (props.articles?.length) {
    return props.articles.slice(0, 5).map((a) => ({
      id: a.id,
      category: a.category,
      isBreaking: false,
      title: `📰 ${a.title}`,
    }))
  }
  return [
    { id: 1, category: 'airline', isBreaking: true, title: '⚡ [속보] 글로벌 항공사 동계 정기 노선 증편 발표' },
    { id: 2, category: 'hotel', isBreaking: false, title: '🏨 주요 럭셔리 리조트 멤버십 포인트 적립 정책 개편' },
  ]
})

const activeIndex = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    if (tickerItems.value.length > 0) {
      activeIndex.value = (activeIndex.value + 1) % tickerItems.value.length
    }
  }, 4500)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="news-ticker-bar" aria-label="실시간 속보 및 지표">
    <div class="page-wrap ticker-wrap">
      <div class="ticker-left">
        <span class="ticker-badge">FLASH NEWS</span>
        <div class="ticker-content">
          <transition name="ticker-slide" mode="out-in">
            <NuxtLink
              v-if="tickerItems.length"
              :key="activeIndex"
              :to="locUrl(`/news/${tickerItems[activeIndex]?.category}/article/${tickerItems[activeIndex]?.id}`)"
              class="ticker-headline"
            >
              {{ tickerItems[activeIndex]?.title }}
            </NuxtLink>
          </transition>
        </div>
      </div>
      <div v-if="fxData?.rates?.length" class="ticker-right">
        <div v-for="rate in fxData.rates.slice(0, 3)" :key="rate.code" class="ticker-fx-item">
          <span class="fx-code">{{ rate.currency }}</span>
          <span class="fx-val">{{ rate.per1000Krw.toFixed(rate.currency === 'VND' ? 0 : 2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.news-ticker-bar {
  background: #090d16;
  color: #e2e8f0;
  border-bottom: 1px solid #1e293b;
  font-size: 11px;
  height: 36px;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.ticker-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 16px;
  gap: 20px;
}

.ticker-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.ticker-badge {
  background: #d97706;
  color: #ffffff;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 3px;
  letter-spacing: 0.8px;
  white-space: nowrap;
}

.ticker-content {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ticker-headline {
  display: inline-block;
  color: #cbd5e1;
  font-size: 12px;
  text-decoration: none;
  transition: color 0.15s ease;
}

.ticker-headline:hover {
  color: #ffffff;
  text-decoration: underline;
}

.ticker-right {
  display: flex;
  align-items: center;
  gap: 16px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  white-space: nowrap;
}

.ticker-fx-item {
  display: flex;
  gap: 6px;
  color: #94a3b8;
}

.fx-code {
  color: #64748b;
  font-weight: 600;
}

.fx-val {
  color: #f1f5f9;
  font-weight: 700;
}

.ticker-slide-enter-active,
.ticker-slide-leave-active {
  transition: all 0.35s ease;
}

.ticker-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.ticker-slide-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

@media (max-width: 768px) {
  .ticker-right { display: none; }
}
</style>
