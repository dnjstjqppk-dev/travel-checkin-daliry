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

interface SparklineMeta {
  path: string
  isUp: boolean
  changePct: string
}

function getSparklineMeta(currency: string): SparklineMeta {
  const trends: Record<string, { pts: number[]; change: number }> = {
    USD: { pts: [13, 12, 11, 12, 14, 13, 12, 11, 10, 9, 8, 9, 8, 7, 6, 5], change: +0.42 },
    JPY: { pts: [6, 7, 8, 9, 8, 10, 11, 12, 13, 14, 13, 15, 14, 16], change: -0.35 },
    EUR: { pts: [12, 11, 13, 14, 12, 11, 10, 9, 10, 11, 9, 8, 7, 6, 5], change: +0.28 },
    THB: { pts: [9, 10, 9, 8, 9, 10, 11, 10, 9, 8, 9, 8, 7, 6, 5], change: +0.15 },
    VND: { pts: [11, 11, 12, 12, 11, 11, 10, 10, 11, 11, 10, 9, 10, 9], change: +0.05 },
    SGD: { pts: [10, 11, 12, 11, 10, 9, 10, 11, 10, 9, 8, 7, 6, 5], change: +0.31 },
  }
  const t = trends[currency] || { pts: [11, 10, 12, 9, 11, 8, 7, 6, 5], change: +0.1 }
  const width = 54
  const step = width / (t.pts.length - 1)
  const d = t.pts.map((y, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${y}`).join(' ')
  return {
    path: d,
    isUp: t.change >= 0,
    changePct: `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%`,
  }
}
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
        <span>{{ locale === 'en' ? 'KRW per Foreign Currency Unit' : '외화 1단위당 원화(KRW) 매매기준율' }}</span>
        <span
          class="bkp-fx-live-pill"
          :class="{ 'is-stale': data.stale }"
          :title="`기준시각: ${updatedLabel} KST (${data.source})`"
        >
          {{ data.stale ? (locale === 'en' ? 'CACHED' : '예비 고시') : (locale === 'en' ? 'LIVE FX' : '공식 고시') }}
        </span>
      </div>
      <ul class="bkp-fx-list">
        <li v-for="rate in displayRates" :key="rate.code" class="bkp-fx-row">
          <div class="bkp-fx-info">
            <span class="bkp-fx-symbol">{{ symbols[rate.currency] || '' }}</span>
            <span class="bkp-fx-code">{{ rate.currency }}</span>
            <span class="bkp-fx-unit" v-if="rate.unit && rate.unit > 1">({{ rate.unit }})</span>
            <span class="bkp-fx-country">{{ getCountryName(rate.code, rate.country) }}</span>
          </div>
          <div class="bkp-fx-sparkline" :title="`변동 추이 참고 지표: ${getSparklineMeta(rate.currency).changePct}`">
            <svg width="54" height="20" viewBox="0 0 54 20" fill="none">
              <path
                :d="getSparklineMeta(rate.currency).path"
                :stroke="getSparklineMeta(rate.currency).isUp ? 'var(--accent, #00d4aa)' : '#ff5252'"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span
              class="bkp-fx-change-pill"
              :class="{ 'is-up': getSparklineMeta(rate.currency).isUp, 'is-down': !getSparklineMeta(rate.currency).isUp }"
            >
              {{ getSparklineMeta(rate.currency).changePct }}
            </span>
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
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
  color: var(--text-primary, #f0f4f8);
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
  color: var(--amber, #f0b90b);
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
  padding: 1px 6px;
  border-radius: 4px;
}

.bkp-fx-live-pill.is-stale {
  background: rgba(240, 185, 11, 0.15);
  color: var(--amber, #f0b90b);
  border-color: rgba(240, 185, 11, 0.35);
}

.bkp-fx-msg {
  font-size: 12px;
  color: var(--text-muted, #8e99aa);
  padding: 16px 0;
  text-align: center;
}

.bkp-fx-msg.error {
  color: var(--red, #f6465d);
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
  border-bottom: 1px solid var(--border, #23253a);
}

.bkp-fx-row:last-child {
  border-bottom: none;
}

.bkp-fx-info {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.bkp-fx-symbol {
  color: var(--accent, #00d4aa);
  font-weight: 800;
  font-size: 11px;
  font-family: var(--font-mono, monospace);
  min-width: 14px;
}

.bkp-fx-code {
  color: var(--text-primary, #f0f4f8);
  font-weight: 800;
  font-size: 12px;
  font-family: var(--font-mono, monospace);
}

.bkp-fx-unit {
  color: var(--text-dim, #7d8696);
  font-size: 10px;
  font-family: var(--font-mono, monospace);
}

.bkp-fx-country {
  color: var(--text-muted, #8e99aa);
  font-size: 11.5px;
  margin-left: 2px;
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
  font-family: var(--font-mono, monospace);
  font-variant-numeric: tabular-nums;
}

.bkp-fx-won {
  color: var(--text-muted, #8e99aa);
  font-size: 11px;
  font-weight: 600;
}

.bkp-fx-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border, #23253a);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10.5px;
  color: var(--text-dim, #7d8696);
  font-family: var(--font-mono, monospace);
}

.bkp-fx-footer a {
  color: var(--accent, #00d4aa);
  text-decoration: none;
  font-weight: 600;
}

.bkp-fx-footer a:hover {
  text-decoration: underline;
}

/* FX Sparkline & Change Badge */
.bkp-fx-sparkline {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.bkp-fx-change-pill {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}
.bkp-fx-change-pill.is-up {
  color: var(--accent, #00d4aa);
  background: rgba(0, 212, 170, 0.12);
}
.bkp-fx-change-pill.is-down {
  color: #ff5252;
  background: rgba(255, 82, 82, 0.12);
}
@media (max-width: 480px) {
  .bkp-fx-sparkline svg {
    display: none;
  }
}
</style>
