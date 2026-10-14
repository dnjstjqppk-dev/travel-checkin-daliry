<script setup lang="ts">
interface CurrencyRate {
  code: string
  country: string
  currency: string
  currencyName: string
  per1000Krw: number
}

interface ExchangeRates {
  amount: number
  rates: CurrencyRate[]
  updatedAt: string
  stale: boolean
  source: string
  sourceUrl: string
}

const { data, error, pending } = await useFetch<ExchangeRates>('/api/exchange-rates', {
  key: 'travel-currency-rates',
})

function formatAmount(rate: CurrencyRate) {
  const digits = rate.currency === 'VND' ? 0 : 2
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits }).format(rate.per1000Krw)
}

const updatedLabel = computed(() => {
  if (!data.value?.updatedAt) return ''
  const date = new Date(data.value.updatedAt)
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
})
</script>

<template>
  <section class="currency-panel" aria-labelledby="currency-heading">
    <div class="currency-panel-heading">
      <div>
        <p class="eyebrow">TRAVEL MONEY / FX</p>
        <h2 id="currency-heading">여행 환율</h2>
      </div>
      <span class="currency-base">기준 ₩1,000</span>
    </div>

    <p v-if="pending" class="currency-message">최신 환율을 불러오는 중입니다.</p>
    <p v-else-if="error" class="currency-message currency-error">환율 정보를 잠시 불러올 수 없습니다.</p>
    <template v-else-if="data">
      <p v-if="data.stale" class="currency-stale">환율 제공처 연결이 지연되어 마지막으로 저장된 시세를 표시합니다.</p>
      <ul class="currency-list">
        <li v-for="rate in data.rates" :key="rate.code">
          <span class="currency-country">
            <strong>{{ rate.country }}</strong>
            <small>{{ rate.currency }} · {{ rate.currencyName }}</small>
          </span>
          <strong class="currency-value">{{ formatAmount(rate) }}</strong>
        </li>
      </ul>
      <div class="currency-footnote">
        <span>기준일 {{ updatedLabel }} · 참고용 환율</span>
        <a :href="data.sourceUrl" target="_blank" rel="noreferrer">출처 {{ data.source }} ↗</a>
      </div>
    </template>
  </section>
</template>
