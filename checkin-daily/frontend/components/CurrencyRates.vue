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

const { locale, t } = useI18n()

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

const localizedCountries: Record<string, Record<string, string>> = {
  US: { ko: '미국', en: 'United States', zh: '美国', th: 'สหรัฐฯ', vi: 'Mỹ', es: 'EE.UU.' },
  JP: { ko: '일본', en: 'Japan', zh: '日本', th: 'ญี่ปุ่น', vi: 'Nhật Bản', es: 'Japón' },
  TH: { ko: '태국', en: 'Thailand', zh: '泰国', th: 'ไทย', vi: 'Thái Lan', es: 'Tailandia' },
  FR: { ko: '프랑스', en: 'France', zh: '法国', th: 'ฝรั่งเศส', vi: 'Pháp', es: 'Francia' },
  VN: { ko: '베트남', en: 'Vietnam', zh: '越南', th: 'เวียดนาม', vi: 'Việt Nam', es: 'Vietnam' },
  SG: { ko: '싱가포르', en: 'Singapore', zh: '新加坡', th: 'สิงคโปร์', vi: 'Singapore', es: 'Singapur' },
  GB: { ko: '영국', en: 'United Kingdom', zh: '英国', th: 'สหราชอาณาจักร', vi: 'Anh', es: 'Reino Unido' },
  AU: { ko: '호주', en: 'Australia', zh: '澳大利亚', th: 'ออสเตรเลีย', vi: 'Úc', es: 'Australia' },
}

function getCountryName(code: string, fallback: string) {
  return localizedCountries[code]?.[locale.value] || fallback
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

const isRefreshing = ref(false)

async function triggerRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    const res = await $fetch<ExchangeRates>(`/api/exchange-rates?refresh=true&_t=${Date.now()}`)
    data.value = res
  } catch {
    await refresh()
  } finally {
    isRefreshing.value = false
  }
}

const updatedLabel = computed(() => {
  if (!data.value?.updatedAt) return 'LIVE'
  const date = new Date(data.value.updatedAt)
  const locMap: Record<string, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    zh: 'zh-CN',
    th: 'th-TH',
    vi: 'vi-VN',
    es: 'es-ES',
  }
  return new Intl.DateTimeFormat(locMap[locale.value] || 'en-US', {
    timeZone: 'Asia/Seoul',
    month: locale.value === 'ko' ? 'numeric' : 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale.value === 'en',
  }).format(date)
})
</script>

<template>
  <div class="bkp-fx-card" itemscope itemtype="https://schema.org/ExchangeRateSpecification" aria-labelledby="currency-heading">
    <div class="bkp-box-title">
      <div class="bkp-fx-title-wrap">
        <span class="bkp-title-indicator" />
        <h3 id="currency-heading" itemprop="name">{{ t('exchange_rates') }}</h3>
      </div>
      <button
        class="bkp-fx-refresh-btn"
        :class="{ 'is-spinning': isRefreshing || pending }"
        type="button"
        :title="locale === 'en' ? 'Refresh Rates' : '환율 데이터 새로고침'"
        :aria-label="locale === 'en' ? 'Refresh Rates' : '환율 새로고침'"
        @click="triggerRefresh"
      >
        ↻
      </button>
    </div>

    <p v-if="pending" class="bkp-fx-msg">{{ locale === 'en' ? 'Loading exchange rates...' : '환율 정보를 불러오는 중...' }}</p>
    <p v-else-if="error" class="bkp-fx-msg error">{{ locale === 'en' ? 'Unable to load rates.' : '환율 정보를 잠시 불러올 수 없습니다.' }}</p>
    <template v-else-if="data">
      <div class="bkp-fx-subbar">
        <span>{{ locale === 'en' ? 'KRW per Foreign Currency Unit' : '외화 1단위당 원화(KRW) 가치' }}</span>
        <span class="bkp-fx-live-pill" :title="`기준시각: ${updatedLabel} (공식 고시 환율, 1시간 주기 갱신)`">{{ locale === 'en' ? 'MARKET' : '공식 고시' }}</span>
      </div>
      <ul class="bkp-fx-list">
        <li v-for="rate in displayRates" :key="rate.code" class="bkp-fx-row">
          <div class="bkp-fx-info">
            <span class="bkp-fx-symbol">{{ symbols[rate.currency] || '' }}</span>
            <span class="bkp-fx-code">{{ rate.currency }}</span>
            <span class="bkp-fx-unit" v-if="rate.unit && rate.unit > 1">({{ rate.unit }})</span>
            <span class="bkp-fx-country">{{ getCountryName(rate.code, rate.country) }}</span>
          </div>
          <div class="bkp-fx-val-wrap">
            <strong class="bkp-fx-val">{{ formatKrw(rate) }}</strong>
            <span class="bkp-fx-won">{{ locale === 'en' ? 'KRW' : '원' }}</span>
          </div>
        </li>
      </ul>
      <div class="bkp-fx-footer">
        <span>{{ locale === 'en' ? 'As of' : '기준' }}: {{ updatedLabel }} KST <span v-if="data.stale" class="bkp-fx-stale-tag">({{ locale === 'en' ? 'Indicative' : '참고용' }})</span></span>
        <a :href="data.sourceUrl" target="_blank" rel="noopener noreferrer">{{ data.source }} ↗</a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bkp-fx-card {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.bkp-box-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border, #23253a);
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.bkp-fx-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bkp-title-indicator {
  width: 4px;
  height: 14px;
  background: var(--accent, #00d4aa);
  border-radius: 2px;
  display: inline-block;
}

.bkp-box-title h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.2px;
}

.bkp-fx-refresh-btn {
  background: var(--bg-input, #11121d);
  border: 1px solid var(--border, #23253a);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 13px;
  color: var(--text-muted, #8e99aa);
  cursor: pointer;
  line-height: 1;
  transition: all 0.15s;
}

.bkp-fx-refresh-btn:hover {
  background: var(--border, #23253a);
  color: var(--accent, #00d4aa);
}

.bkp-fx-refresh-btn.is-spinning {
  display: inline-block;
  animation: fxSpin 0.75s linear infinite;
  pointer-events: none;
  opacity: 0.7;
}

@keyframes fxSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.bkp-fx-stale-tag {
  color: var(--red, #f6465d);
  font-size: 10.5px;
  font-weight: 700;
  margin-left: 4px;
}

.bkp-fx-subbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10.5px;
  color: var(--text-muted, #8e99aa);
  margin-bottom: 10px;
}

.bkp-fx-live-pill {
  background: rgba(0, 212, 170, 0.15);
  color: var(--accent, #00d4aa);
  border: 1px solid rgba(0, 212, 170, 0.3);
  font-size: 9.5px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 3px;
}

.bkp-fx-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.bkp-fx-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.bkp-fx-row:last-child {
  border-bottom: none;
}

.bkp-fx-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.bkp-fx-symbol {
  color: var(--text-muted, #8e99aa);
  font-weight: 700;
  font-size: 11px;
}

.bkp-fx-code {
  color: var(--text-primary, #f0f4f8);
  font-weight: 800;
  font-size: 12px;
}

.bkp-fx-unit {
  color: var(--text-dim, #7d8696);
  font-size: 10px;
}

.bkp-fx-country {
  color: var(--text-muted, #8e99aa);
  font-size: 11px;
}

.bkp-fx-val-wrap {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.bkp-fx-val {
  color: var(--accent, #00d4aa);
  font-size: 13.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.bkp-fx-won {
  color: var(--text-dim, #7d8696);
  font-size: 10.5px;
}

.bkp-fx-footer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border, #23253a);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10.5px;
  color: var(--text-dim, #7d8696);
}

.bkp-fx-footer a {
  color: var(--accent, #00d4aa);
  text-decoration: none;
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
