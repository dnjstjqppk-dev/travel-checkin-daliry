<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface AnalyticsData {
  summary: {
    humanViews: number
    botViews: number
    affiliateClicks: number
    shares: number
    bookmarks: number
  }
  affiliateByPlatform: Array<{
    target_platform: string
    clicks: number
  }>
  topArticles: Array<{
    id: number
    title: string
    category: string
    view_count: number
    published_at: string | null
    affiliate_clicks: number
  }>
  generatedAt: string
}

const { data, refresh } = await useFetch<AnalyticsData>('/api/admin/analytics')

function formatDate(val: string | null) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
}

const ctr = computed(() => {
  if (!data.value?.summary.humanViews) return '0.0%'
  const rate = (data.value.summary.affiliateClicks / data.value.summary.humanViews) * 100
  return rate.toFixed(2) + '%'
})
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">AUDIENCE & CONVERSION / ANALYTICS</p>
        <h1>트래픽 검증 및 제휴 전환 분석</h1>
        <p class="admin-heading-copy">
          자동 크롤러 봇을 엄격히 분리한 실제 독자 트래픽과 TripScanner / GetForTrip 제휴 트래픽 전환 성과를 추적합니다.
        </p>
      </div>
      <button type="button" class="button" @click="() => refresh()">새로고침 ↻</button>
    </div>

    <!-- 핵심 지표 카드 -->
    <div class="admin-stats-grid">
      <div class="stat-card">
        <span class="stat-label">실제 독자 조회수</span>
        <strong class="stat-num text-success">{{ data?.summary.humanViews?.toLocaleString() || 0 }}</strong>
        <span class="stat-desc">검증된 사용자 세션</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">차단된 크롤러/봇</span>
        <strong class="stat-num text-mono">{{ data?.summary.botViews?.toLocaleString() || 0 }}</strong>
        <span class="stat-desc">조회수 집계에서 자동 배제</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">전략 제휴 클릭 수</span>
        <strong class="stat-num text-accent">{{ data?.summary.affiliateClicks?.toLocaleString() || 0 }}</strong>
        <span class="stat-desc">TripScanner · GetForTrip</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">전환율 (CTR)</span>
        <strong class="stat-num text-primary">{{ ctr }}</strong>
        <span class="stat-desc">독자 방문 대비 제휴 유입률</span>
      </div>
    </div>

    <!-- 제휴 플랫폼별 성과 & 인기 기사 -->
    <div class="analytics-split-grid">
      <div class="panel-box">
        <h2>전략 제휴 목적지별 클릭 현황</h2>
        <table class="admin-table">
          <thead>
            <tr><th>타겟 플랫폼</th><th>클릭 수</th><th>비중</th></tr>
          </thead>
          <tbody>
            <tr v-for="plat in data?.affiliateByPlatform || []" :key="plat.target_platform">
              <td><strong>{{ plat.target_platform || '일반 제휴' }}</strong></td>
              <td>{{ plat.clicks }}회</td>
              <td>{{ ((plat.clicks / (data?.summary.affiliateClicks || 1)) * 100).toFixed(1) }}%</td>
            </tr>
            <tr v-if="!data?.affiliateByPlatform.length">
              <td colspan="3" class="text-center">아직 기록된 제휴 클릭이 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="panel-box">
        <h2>트래픽 상위 기사 (Top Stories)</h2>
        <table class="admin-table">
          <thead>
            <tr><th>기사 제목</th><th>조회수</th><th>제휴 클릭</th></tr>
          </thead>
          <tbody>
            <tr v-for="art in data?.topArticles || []" :key="art.id">
              <td class="title-cell">
                <NuxtLink :to="`/news/${art.category}/article/${art.id}`" target="_blank" class="table-link">
                  {{ art.title }}
                </NuxtLink>
              </td>
              <td>{{ art.view_count?.toLocaleString() || 0 }}</td>
              <td><strong>{{ art.affiliate_clicks || 0 }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}
.stat-card {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 18px;
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--admin-muted);
  font-family: 'DM Mono', monospace;
  margin-bottom: 6px;
}
.stat-num {
  font-size: 26px;
  font-weight: 800;
  color: var(--admin-heading);
  margin-bottom: 4px;
}
.stat-desc {
  font-size: 11px;
  color: var(--admin-muted);
}
.text-success { color: #10b981; }
.text-accent { color: #FF5A5F; }
.text-primary { color: var(--accent); }
.text-mono { font-family: 'DM Mono', monospace; }

.analytics-split-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.panel-box {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 20px;
}
.panel-box h2 {
  font-size: 16px;
  font-weight: 800;
  margin: 0 0 16px;
  color: var(--admin-heading);
}
.title-cell {
  max-width: 240px;
}
.table-link {
  color: var(--admin-heading);
  font-weight: 700;
  text-decoration: none;
}
.table-link:hover {
  color: var(--accent);
  text-decoration: underline;
}
.text-center {
  text-align: center;
  color: var(--admin-muted);
  font-size: 12px;
}
@media (max-width: 800px) {
  .admin-stats-grid {
    grid-template-columns: 1fr 1fr;
  }
  .analytics-split-grid {
    grid-template-columns: 1fr;
  }
}
</style>

