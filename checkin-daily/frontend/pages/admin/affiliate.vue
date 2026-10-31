<script setup lang="ts">
definePageMeta({ layout: 'admin' })
import { siteConfig } from '~/config/site.config'

const affiliates = siteConfig.affiliates
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">TRAFFIC MONETIZATION / AFFILIATES</p>
        <h1>전략적 제휴 트래픽 플랫폼 관리</h1>
        <p class="admin-heading-copy">
          체크인데일리의 고효율 뉴스 트래픽을 TripScanner 및 GetForTrip으로 전달하는 문맥 맞춤형 CTA 및 UTM 설정을 관리합니다.
        </p>
      </div>
    </div>

    <div class="affiliate-cards-grid">
      <div v-for="target in affiliates" :key="target.id" class="target-card" :style="{ borderTopColor: target.themeColor }">
        <div class="card-head">
          <div>
            <span class="badge" :style="{ backgroundColor: target.themeColor, color: '#fff' }">{{ target.badgeText }}</span>
            <h2>{{ target.name }}</h2>
          </div>
          <a :href="target.url" target="_blank" class="ext-link">공식 사이트 ↗</a>
        </div>
        <p class="tagline">{{ target.tagline }}</p>
        <p class="desc">{{ target.description }}</p>

        <div class="meta-section">
          <h4>타겟 연계 키워드 (문맥 트리거)</h4>
          <div class="keyword-tags">
            <span v-for="kw in target.keywords" :key="kw" class="kw-tag">{{ kw }}</span>
          </div>
        </div>

        <div class="cta-preview">
          <h4>기사 본문 삽입 CTA 문구</h4>
          <div class="cta-box" :style="{ borderColor: target.themeColor }">
            {{ target.ctaText }}
          </div>
        </div>
      </div>
    </div>

    <div class="clone-architecture-box">
      <h3>🚀 향후 멀티 도메인 확장성 (Clone-Ready Base Architecture)</h3>
      <p>
        본 플랫폼은 코인(CoinScanner), 주식(StockScanner) 등 타 산업군 뉴스 미디어로 즉시 복제 가능한 마스터 템플릿입니다.
        <code>checkin-daily/frontend/config/site.config.ts</code>의 `affiliates` 설정과 `brandName`만 변경하면 즉시 새 산업군 트래픽 허브로 전환됩니다.
      </p>
    </div>
  </section>
</template>

<style scoped>
.affiliate-cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 28px;
}
.target-card {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-top: 4px solid #0052CC;
  border-radius: 6px;
  padding: 24px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.card-head h2 {
  font-size: 18px;
  font-weight: 800;
  color: var(--admin-heading);
  margin: 6px 0 0;
}
.ext-link {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  text-decoration: underline;
}
.tagline {
  font-size: 13px;
  font-weight: 700;
  color: var(--admin-text);
  margin: 0 0 8px;
}
.desc {
  font-size: 13px;
  color: var(--admin-muted);
  line-height: 1.6;
  margin: 0 0 16px;
}
.meta-section h4, .cta-preview h4 {
  font-size: 11px;
  font-weight: 700;
  color: var(--admin-muted);
  font-family: 'DM Mono', monospace;
  margin: 0 0 8px;
}
.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.kw-tag {
  background: var(--admin-surface);
  color: var(--admin-text);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.cta-box {
  background: var(--admin-surface);
  border: 1px dashed var(--admin-border);
  border-radius: 4px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 800;
  color: var(--admin-heading);
}
.clone-architecture-box {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 20px 24px;
}
.clone-architecture-box h3 {
  margin: 0 0 8px;
  font-size: 15px;
  color: #10b981;
}
.clone-architecture-box p {
  margin: 0;
  font-size: 13px;
  color: var(--admin-text);
  line-height: 1.6;
}
.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
@media (max-width: 800px) {
  .affiliate-cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>

