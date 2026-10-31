<script setup lang="ts">
import { siteConfig, type AffiliateTarget } from '~/config/site.config'

const props = defineProps<{
  category?: string
  title?: string
  variant?: 'inline' | 'card' | 'bottom-bar'
}>()

const affiliates = siteConfig.affiliates
const tripScannerTarget = affiliates[0] as AffiliateTarget
const getForTripTarget = (affiliates[1] || affiliates[0]) as AffiliateTarget

// Destination airport code & city detector
const detectedDestination = computed(() => {
  const text = `${props.title || ''} ${props.category || ''}`
  if (/방콕|태국|수완나품|bkk|bangkok/i.test(text)) return { iata: 'BKK', cityId: 'bkk', name: '방콕' }
  if (/푸켓|phuket|hkt/i.test(text)) return { iata: 'HKT', cityId: 'phuket', name: '푸켓' }
  if (/치앙마이|chiang\s*mai|cnx/i.test(text)) return { iata: 'CNX', cityId: 'chiangmai', name: '치앙마이' }
  if (/도쿄|나리타|하네다|tokyo|narita|haneda|nrt|hnd/i.test(text)) return { iata: 'NRT', cityId: 'tokyo', name: '도쿄' }
  if (/오사카|간사이|osaka|kansai|kix/i.test(text)) return { iata: 'KIX', cityId: 'osaka', name: '오사카' }
  if (/후쿠오카|fukuoka|fuk/i.test(text)) return { iata: 'FUK', cityId: 'fukuoka', name: '후쿠오카' }
  if (/다낭|danang|dad/i.test(text)) return { iata: 'DAD', cityId: 'danang', name: '다낭' }
  if (/하노이|hanoi|han/i.test(text)) return { iata: 'HAN', cityId: 'hanoi', name: '하노이' }
  if (/호치민|hochiminh|sgn/i.test(text)) return { iata: 'SGN', cityId: 'hochiminh', name: '호치민' }
  if (/싱가포르|창이|singapore|sin/i.test(text)) return { iata: 'SIN', cityId: 'singapore', name: '싱가포르' }
  if (/발리|덴파사르|bali|dps/i.test(text)) return { iata: 'DPS', cityId: 'bali', name: '발리' }
  if (/파리|샤를드골|paris|cdg|par/i.test(text)) return { iata: 'PAR', cityId: 'paris', name: '파리' }
  if (/런던|히드로|london|lhr|lon/i.test(text)) return { iata: 'LON', cityId: 'london', name: '런던' }
  if (/뉴욕|newyork|jfk|nyc/i.test(text)) return { iata: 'NYC', cityId: 'newyork', name: '뉴욕' }
  if (/세부|cebu|ceb/i.test(text)) return { iata: 'CEB', cityId: 'cebu', name: '세부' }
  return { iata: 'BKK', cityId: 'bkk', name: '주요 인기 여행지' }
})

// Pick best affiliate target based on category or content
const primaryTarget = computed<AffiliateTarget>(() => {
  const cat = (props.category || '').toLowerCase()
  const title = (props.title || '').toLowerCase()

  if (cat === 'destination' || /투어|입장권|비자|액티비티|페스티벌|체험|esim/i.test(title)) {
    return (affiliates.find((a) => a.id === 'getfortrip') || getForTripTarget) as AffiliateTarget
  }
  return (affiliates.find((a) => a.id === 'tripscanner') || tripScannerTarget) as AffiliateTarget
})

const secondaryTarget = computed<AffiliateTarget>(() => {
  const target = primaryTarget.value.id === 'tripscanner'
    ? (affiliates.find((a) => a.id === 'getfortrip') || getForTripTarget)
    : (affiliates.find((a) => a.id === 'tripscanner') || tripScannerTarget)
  return target as AffiliateTarget
})

function trackAffiliateClick(platform: string) {
  try {
    $fetch('/api/analytics/track', {
      method: 'POST',
      body: {
        eventType: 'affiliate_click',
        targetPlatform: platform,
        referrer: typeof window !== 'undefined' ? window.location.href : '',
      },
    }).catch(() => {})
  } catch {}
}

function buildUrl(target: AffiliateTarget): string {
  const dest = detectedDestination.value
  if (target.id === 'tripscanner') {
    return `https://tripscanner.io/flights?destination=${dest.iata}&utm_source=checkindaily&utm_medium=article_cta&utm_campaign=article_${encodeURIComponent(props.category || 'all')}`
  }
  if (target.id === 'getfortrip') {
    return `https://getfortrip.com/search?city=${dest.cityId}&utm_source=checkindaily&utm_medium=article_cta`
  }
  const ref = 'checkindaily'
  const param = props.category ? `&cat=${encodeURIComponent(props.category)}` : ''
  return `${target.url}?ref=${ref}${param}`
}
</script>

<template>
  <div class="affiliate-cta-wrapper" :class="variant || 'card'">
    <!-- 1. Rich Card Format -->
    <div v-if="!variant || variant === 'card'" class="affiliate-card">
      <div class="cta-top-row">
        <span class="cta-badge" :style="{ backgroundColor: primaryTarget.themeColor }">
          {{ primaryTarget.badgeText }}
        </span>
        <span class="cta-network-label">
          🛰️ {{ detectedDestination.name }} 공식 제휴 트래픽 파트너
        </span>
      </div>

      <div class="cta-main-content">
        <div class="cta-text-block">
          <h4 class="cta-brand-title">{{ primaryTarget.name }}</h4>
          <p class="cta-headline">{{ primaryTarget.tagline }}</p>
          <p class="cta-desc">{{ primaryTarget.description }}</p>
        </div>

        <div class="cta-action-block">
          <a
            :href="buildUrl(primaryTarget)"
            target="_blank"
            rel="sponsored noopener noreferrer"
            class="cta-primary-button"
            :style="{ backgroundColor: primaryTarget.themeColor }"
            @click="trackAffiliateClick(primaryTarget.id)"
          >
            {{ primaryTarget.ctaText }}
          </a>
          <a
            :href="buildUrl(secondaryTarget)"
            target="_blank"
            rel="sponsored noopener noreferrer"
            class="cta-secondary-link"
            @click="trackAffiliateClick(secondaryTarget.id)"
          >
            + {{ secondaryTarget.name }} 바로가기 ↗
          </a>
        </div>
      </div>
    </div>

    <!-- 2. Inline Bar Format -->
    <div v-else-if="variant === 'inline'" class="affiliate-inline-bar">
      <div class="inline-icon">✈️</div>
      <div class="inline-text">
        <strong>{{ primaryTarget.name }} [{{ detectedDestination.name }} 특가]:</strong>
        본 기사와 연계된 최저가 항공권 및 호텔 실시간 요금을 비교해 보세요.
      </div>
      <a
        :href="buildUrl(primaryTarget)"
        target="_blank"
        rel="sponsored noopener noreferrer"
        class="inline-btn"
        @click="trackAffiliateClick(primaryTarget.id)"
      >
        실시간 조회 ↗
      </a>
    </div>

    <!-- 3. Bottom Bar Format -->
    <div v-else-if="variant === 'bottom-bar'" class="affiliate-bottom-bar">
      <div class="bar-inner">
        <div class="bar-info">
          <span class="bar-badge">{{ primaryTarget.badgeText }}</span>
          <span class="bar-title">{{ primaryTarget.tagline }}</span>
        </div>
        <a
          :href="buildUrl(primaryTarget)"
          target="_blank"
          rel="sponsored noopener noreferrer"
          class="bar-button"
          :style="{ backgroundColor: primaryTarget.themeColor }"
          @click="trackAffiliateClick(primaryTarget.id)"
        >
          {{ primaryTarget.ctaText }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.affiliate-cta-wrapper {
  margin: 28px 0;
  font-family: inherit;
}

/* 1. Card Style */
.affiliate-card {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-left: 4px solid var(--accent, #00d4aa);
  border-radius: 12px;
  padding: 22px 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.affiliate-card:hover {
  border-color: rgba(0, 212, 170, 0.5);
  box-shadow: 0 6px 24px rgba(0, 212, 170, 0.12);
}

.cta-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cta-badge {
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 20px;
  letter-spacing: 0.5px;
}

.cta-network-label {
  font-size: 11px;
  color: var(--text-muted, #7e8299);
  font-weight: 600;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
}

.cta-main-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

@media (max-width: 680px) {
  .cta-main-content {
    flex-direction: column;
    align-items: flex-start;
  }
}

.cta-brand-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--accent, #00d4aa);
  margin: 0 0 4px 0;
  letter-spacing: 0.5px;
}

.cta-headline {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-base, #e1e3ea);
  line-height: 1.35;
  margin: 0 0 6px 0;
}

.cta-desc {
  font-size: 13px;
  color: var(--text-muted, #8e92a8);
  line-height: 1.5;
  margin: 0;
}

.cta-action-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
  align-items: stretch;
}

.cta-primary-button {
  display: inline-block;
  text-align: center;
  color: #ffffff !important;
  font-size: 14px;
  font-weight: 800;
  padding: 12px 20px;
  border-radius: 8px;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s, box-shadow 0.2s;
}

.cta-primary-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 212, 170, 0.25);
}

.cta-secondary-link {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted, #8e92a8);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s;
}

.cta-secondary-link:hover {
  text-decoration: underline;
  color: var(--accent, #00d4aa);
}

/* 2. Inline Style */
.affiliate-inline-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-left: 3px solid var(--accent, #00d4aa);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 13px;
}

.inline-icon {
  font-size: 18px;
}

.inline-text {
  flex: 1;
  color: var(--text-base, #e1e3ea);
  line-height: 1.4;
}

.inline-btn {
  background: var(--accent, #00d4aa);
  color: #0d0e1a !important;
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 12px;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.inline-btn:hover {
  opacity: 0.9;
}

/* 3. Bottom Bar Style */
.affiliate-bottom-bar {
  background: var(--bg-card, #181927);
  border-top: 1px solid var(--border, #23253a);
  padding: 10px 16px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.3);
}

.bar-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bar-badge {
  background: var(--accent, #00d4aa);
  color: #0d0e1a;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
}

.bar-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-base, #e1e3ea);
}

.bar-button {
  color: #ffffff !important;
  font-size: 13px;
  font-weight: 800;
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
}
</style>
