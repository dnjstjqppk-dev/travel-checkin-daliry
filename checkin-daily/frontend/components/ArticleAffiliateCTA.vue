<script setup lang="ts">
import { siteConfig, type AffiliateTarget } from '~/config/site.config'

const props = defineProps<{
  category?: string
  title?: string
  variant?: 'inline' | 'card' | 'bottom-bar'
}>()

const affiliates = siteConfig.affiliates

// Pick best affiliate target based on category or content
const primaryTarget = computed<AffiliateTarget>(() => {
  const cat = (props.category || '').toLowerCase()
  const title = (props.title || '').toLowerCase()

  if (cat === 'destination' || /투어|입장권|비자|액티비티|페스티벌|체험/i.test(title)) {
    return affiliates.find(a => a.id === 'getfortrip') || affiliates[1]
  }
  return affiliates.find(a => a.id === 'tripscanner') || affiliates[0]
})

const secondaryTarget = computed<AffiliateTarget>(() => {
  return primaryTarget.value.id === 'tripscanner'
    ? (affiliates.find(a => a.id === 'getfortrip') || affiliates[1])
    : (affiliates.find(a => a.id === 'tripscanner') || affiliates[0])
})

function buildUrl(target: AffiliateTarget) {
  const ref = 'checkindaily'
  const param = props.category ? `&cat=${encodeURIComponent(props.category)}` : ''
  return `${target.url}?ref=${ref}${param}`
}
</script>

<template>
  <div class="affiliate-cta-wrapper" :class="variant || 'card'">
    <!-- 1. 리치 카드 형태 (기사 본문 중간 또는 하단 배치) -->
    <div v-if="!variant || variant === 'card'" class="affiliate-card">
      <div class="cta-top-row">
        <span class="cta-badge" :style="{ backgroundColor: primaryTarget.themeColor }">
          {{ primaryTarget.badgeText }}
        </span>
        <span class="cta-network-label">공식 제휴 트래픽 파트너</span>
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
            rel="noopener sponsored"
            class="cta-primary-button"
            :style="{ backgroundColor: primaryTarget.themeColor }"
          >
            {{ primaryTarget.ctaText }}
          </a>
          <a
            :href="buildUrl(secondaryTarget)"
            target="_blank"
            rel="noopener sponsored"
            class="cta-secondary-link"
          >
            + {{ secondaryTarget.name }} 바로가기
          </a>
        </div>
      </div>
    </div>

    <!-- 2. 인라인 바 형태 (기사 텍스트 중간에 자연스럽게 삽입) -->
    <div v-else-if="variant === 'inline'" class="affiliate-inline-bar">
      <div class="inline-icon">✈️</div>
      <div class="inline-text">
        <strong>{{ primaryTarget.name }} 특가 알림:</strong> 본 기사와 연계된 최저가 항공권 및 호텔 실시간 요금을 비교해 보세요.
      </div>
      <a
        :href="buildUrl(primaryTarget)"
        target="_blank"
        rel="noopener sponsored"
        class="inline-btn"
      >
        최저가 조회 ↗
      </a>
    </div>

    <!-- 3. 하단 플로팅 바 형태 -->
    <div v-else-if="variant === 'bottom-bar'" class="affiliate-bottom-bar">
      <div class="bar-inner">
        <div class="bar-info">
          <span class="bar-badge">{{ primaryTarget.badgeText }}</span>
          <span class="bar-title">{{ primaryTarget.tagline }}</span>
        </div>
        <a
          :href="buildUrl(primaryTarget)"
          target="_blank"
          rel="noopener sponsored"
          class="bar-button"
          :style="{ backgroundColor: primaryTarget.themeColor }"
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* 1. Card Style */
.affiliate-card {
  background: linear-gradient(135deg, #f8faf9 0%, #edf7f4 100%);
  border: 1.5px solid #d1e7df;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(23, 107, 82, 0.06);
  position: relative;
  overflow: hidden;
}

.affiliate-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 100%;
  background: #176b52;
}

.cta-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
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
  color: #718096;
  font-weight: 600;
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
  color: #176b52;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}

.cta-headline {
  font-size: 18px;
  font-weight: 800;
  color: #1a202c;
  line-height: 1.35;
  margin-bottom: 6px;
}

.cta-desc {
  font-size: 13px;
  color: #4a5568;
  line-height: 1.5;
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s, box-shadow 0.2s;
}

.cta-primary-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}

.cta-secondary-link {
  text-align: center;
  font-size: 12px;
  color: #4a5568;
  text-decoration: none;
  font-weight: 600;
}

.cta-secondary-link:hover {
  text-decoration: underline;
  color: #176b52;
}

/* 2. Inline Style */
.affiliate-inline-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 13px;
}

.inline-icon {
  font-size: 18px;
}

.inline-text {
  flex: 1;
  color: #166534;
  line-height: 1.4;
}

.inline-btn {
  background: #16a34a;
  color: #ffffff !important;
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  text-decoration: none;
  white-space: nowrap;
}

/* 3. Bottom Bar Style */
.affiliate-bottom-bar {
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  padding: 10px 16px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.bar-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bar-badge {
  background: #176b52;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
}

.bar-title {
  font-size: 13px;
  font-weight: 700;
  color: #2d3748;
}

.bar-button {
  color: #fff !important;
  font-size: 13px;
  font-weight: 800;
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
}
</style>

