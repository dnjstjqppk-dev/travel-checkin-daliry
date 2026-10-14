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
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
})
</script>

<template>
  <div class="bkp-fx-card" aria-labelledby="currency-heading">
    <div class="bkp-box-title">
      <span class="bkp-title-indicator" />
      <h3 id="currency-heading">EXCHANGE RATES</h3>
      <span class="bkp-fx-base">기준 ₩1,000</span>
    </div>

    <p v-if="pending" class="bkp-fx-msg">환율 정보를 불러오는 중...</p>
    <p v-else-if="error" class="bkp-fx-msg error">환율 정보를 잠시 불러올 수 없습니다.</p>
    <template v-else-if="data">
      <ul class="bkp-fx-list">
        <li v-for="rate in data.rates.slice(0, 5)" :key="rate.code" class="bkp-fx-row">
          <div class="bkp-fx-info">
            <span class="bkp-fx-code">{{ rate.currency }}</span>
            <span class="bkp-fx-country">{{ rate.country }}</span>
          </div>
          <strong class="bkp-fx-val">{{ formatAmount(rate) }}</strong>
        </li>
      </ul>
      <div class="bkp-fx-footer">
        <span>{{ updatedLabel }} 기준</span>
        <a :href="data.sourceUrl" target="_blank" rel="noreferrer">{{ data.source }} ↗</a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bkp-fx-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-top: 3px solid #060D81;
  padding: 18px;
}

.bkp-box-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #E5E7EB;
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.bkp-title-indicator {
  width: 4px;
  height: 15px;
  background: #D0021B;
  display: inline-block;
  margin-right: 8px;
}

.bkp-box-title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #060D81;
  letter-spacing: 0.5px;
  flex: 1;
}

.bkp-fx-base {
  font-size: 10px;
  color: #6B7280;
  font-family: 'DM Mono', monospace;
}

.bkp-fx-msg {
  font-size: 12px;
  color: #6B7280;
  padding: 12px 0;
}

.bkp-fx-msg.error {
  color: #DC2626;
}

.bkp-fx-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.bkp-fx-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #F3F4F6;
}

.bkp-fx-row:last-child {
  border-bottom: 0;
}

.bkp-fx-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.bkp-fx-code {
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  font-size: 13px;
  color: #111827;
}

.bkp-fx-country {
  font-size: 12px;
  color: #6B7280;
}

.bkp-fx-val {
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  color: #060D81;
}

.bkp-fx-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #E5E7EB;
  font-size: 10px;
  color: #9CA3AF;
  font-family: 'DM Mono', monospace;
}

.bkp-fx-footer a {
  color: #060D81;
  text-decoration: none;
}
</style>
