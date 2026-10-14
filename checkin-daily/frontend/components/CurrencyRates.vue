<script setup lang="ts">
interface CurrencyRate {
  code: string
  country: string
  currency: string
  currencyName: string
  unit?: number
  krwPrice?: number
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

const { data, error, pending, refresh } = await useFetch<ExchangeRates>('/api/exchange-rates', {
  key: 'travel-currency-rates',
})

const prioritizedCurrencies = ['US', 'JP', 'TH', 'FR', 'VN', 'SG']

const displayRates = computed(() => {
  if (!data.value?.rates) return []
  return prioritizedCurrencies
    .map((code) => data.value?.rates.find((r) => r.code === code))
    .filter((r): r is CurrencyRate => Boolean(r))
})

const symbols: Record<string, string> = {
  USD: '$',
  JPY: '¥',
  THB: '฿',
  EUR: '€',
  VND: '₫',
  SGD: 'S$',
  GBP: '£',
}

function formatKrw(rate: CurrencyRate) {
  if (typeof rate.krwPrice === 'number') {
    const fractionDigits = rate.currency === 'VND' || rate.krwPrice < 100 ? 2 : 1
    return new Intl.NumberFormat('ko-KR', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(rate.krwPrice)
  }
  // Fallback to per1000Krw
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(rate.per1000Krw)
}

const updatedLabel = computed(() => {
  if (!data.value?.updatedAt) return 'LIVE'
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
  <div class="bkp-fx-card" itemscope itemtype="https://schema.org/ExchangeRateSpecification" aria-labelledby="currency-heading">
    <div class="bkp-box-title">
      <div class="bkp-fx-title-wrap">
        <span class="bkp-title-indicator" />
        <h3 id="currency-heading" itemprop="name">TRAVEL FX (실시간 환율)</h3>
      </div>
      <button class="bkp-fx-refresh-btn" type="button" title="환율 새로고침" @click="() => refresh()">
        ↻
      </button>
    </div>

    <p v-if="pending" class="bkp-fx-msg">환율 정보를 불러오는 중...</p>
    <p v-else-if="error" class="bkp-fx-msg error">환율 정보를 잠시 불러올 수 없습니다.</p>
    <template v-else-if="data">
      <div class="bkp-fx-subbar">
        <span>외화 1단위당 원화(KRW) 가치</span>
        <span class="bkp-fx-live-pill">실시간</span>
      </div>
      <ul class="bkp-fx-list">
        <li v-for="rate in displayRates" :key="rate.code" class="bkp-fx-row">
          <div class="bkp-fx-info">
            <span class="bkp-fx-symbol">{{ symbols[rate.currency] || '' }}</span>
            <span class="bkp-fx-code">{{ rate.currency }}</span>
            <span class="bkp-fx-unit" v-if="rate.unit && rate.unit > 1">({{ rate.unit }})</span>
            <span class="bkp-fx-country">{{ rate.country }}</span>
          </div>
          <div class="bkp-fx-val-wrap">
            <strong class="bkp-fx-val">{{ formatKrw(rate) }}</strong>
            <span class="bkp-fx-won">원</span>
          </div>
        </li>
      </ul>
      <div class="bkp-fx-footer">
        <span>{{ updatedLabel }} KST 기준</span>
        <a :href="data.sourceUrl" target="_blank" rel="noopener noreferrer">{{ data.source }} ↗</a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bkp-fx-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-top: 3px solid #060D81;
  padding: 16px 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.bkp-box-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #E5E7EB;
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.bkp-fx-title-wrap {
  display: flex;
  align-items: center;
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
  font-size: 14.5px;
  font-weight: 800;
  color: #060D81;
  letter-spacing: 0.5px;
}

.bkp-fx-refresh-btn {
  background: transparent;
  border: 1px solid #E5E7EB;
  border-radius: 3px;
  padding: 2px 7px;
  font-size: 13px;
  color: #6B7280;
  cursor: pointer;
  line-height: 1;
}

.bkp-fx-refresh-btn:hover {
  background: #F3F4F6;
  color: #060D81;
}

.bkp-fx-subbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10.5px;
  color: #6B7280;
  margin-bottom: 10px;
  font-family: 'DM Mono', monospace;
}

.bkp-fx-live-pill {
  background: #FEF2F2;
  color: #D0021B;
  border: 1px solid #FECACA;
  font-size: 9.5px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 2px;
}

.bkp-fx-msg {
  font-size: 12px;
  color: #6B7280;
  padding: 16px 0;
  text-align: center;
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
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #F3F4F6;
}

.bkp-fx-row:last-child {
  border-bottom: 0;
}

.bkp-fx-info {
  display: flex;
  align-items: center;
  gap: 5px;
}

.bkp-fx-symbol {
  font-size: 11px;
  font-weight: 800;
  color: #060D81;
  font-family: 'DM Mono', monospace;
  min-width: 14px;
}

.bkp-fx-code {
  font-size: 12px;
  font-weight: 800;
  color: #111827;
  font-family: 'DM Mono', monospace;
}

.bkp-fx-unit {
  font-size: 10px;
  color: #9CA3AF;
  font-family: 'DM Mono', monospace;
}

.bkp-fx-country {
  font-size: 11.5px;
  color: #6B7280;
  margin-left: 2px;
}

.bkp-fx-val-wrap {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.bkp-fx-val {
  font-size: 13.5px;
  font-weight: 800;
  color: #060D81;
  font-family: 'DM Mono', monospace;
}

.bkp-fx-won {
  font-size: 11px;
  color: #6B7280;
  font-weight: 600;
}

.bkp-fx-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #E5E7EB;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #9CA3AF;
  font-family: 'DM Mono', monospace;
}

.bkp-fx-footer a {
  color: #6B7280;
  text-decoration: none;
}

.bkp-fx-footer a:hover {
  text-decoration: underline;
  color: #060D81;
}
</style>
