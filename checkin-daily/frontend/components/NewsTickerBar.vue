<script setup lang="ts">
import type { Article } from '~/stores/articles'

defineProps<{
  articles: Article[]
}>()

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

const tickerItems = [
  '⚡ [속보] 일본 벚꽃 시즌 나리타/간사이 노선 임시 증편 결정',
  '✈️ 대한항공-아시아나 마일리지 통합 비율 세부 지침 발표 예정',
  '🏨 메리어트 본보이 2026 티어 산정 프로모션 2배 적립 시작',
  '📍 파리 올림픽 이후 유럽 호텔 숙박세 인하 검토',
]

const activeIndex = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % tickerItems.length
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
            <span :key="activeIndex" class="ticker-headline">
              {{ tickerItems[activeIndex] }}
            </span>
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

