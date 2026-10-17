<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface DashboardData {
  metrics: {
    totalArticles: number
    publishedCount: number
    draftCount: number
    reviewCount: number
    scheduledCount: number
    retractedCount: number
    activeSources: number
    totalFeedItems: number
    humanViews: number
    botViews: number
    affiliateClicks: number
    isAutomationPaused: boolean
  }
  sourcesHealth: Array<{
    id: string
    name: string
    endpoint_url: string
    last_fetched_at: string | null
    last_status: string
    is_active: number
  }>
  recentIngestionRuns: Array<{
    id: number
    source_name: string
    started_at: string
    status: string
    fetched_count: number
    duplicate_count: number
    error_count: number
  }>
  recentArticles: Array<{
    id: number
    title: string
    slug: string
    category: string
    status: string
    review_status: string
    view_count: number
    quality_score: number
    published_at: string | null
    created_at: string
  }>
  dataTime: string
}

const { data, refresh, pending } = await useFetch<DashboardData>('/api/admin/dashboard-stats')

function formatDate(val: string | null) {
  if (!val) return '-'
  return new Date(val).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const isTogglingKillSwitch = ref(false)
async function toggleKillSwitch() {
  if (!data.value) return
  isTogglingKillSwitch.value = true
  const nextVal = data.value.metrics.isAutomationPaused ? '0' : '1'
  try {
    await $fetch('/api/admin/automation', {
      method: 'POST',
      body: { key: 'is_automation_paused', value: nextVal },
    })
    await refresh()
  } finally {
    isTogglingKillSwitch.value = false
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">EDITORIAL DESK / LIVE METRICS</p>
        <h1>뉴스룸 관제 대시보드</h1>
        <p class="admin-heading-copy">
          기준 시각: {{ formatDate(data?.dataTime || null) }} (Cloudflare D1 실시간 집계)
        </p>
      </div>
      <div class="admin-heading-actions">
        <button
          type="button"
          class="button button-killswitch"
          :class="{ 'is-paused': data?.metrics.isAutomationPaused }"
          :disabled="isTogglingKillSwitch"
          @click="toggleKillSwitch"
        >
          {{ data?.metrics.isAutomationPaused ? '⚠️ 자동화 재개 (Kill-Switch 해제)' : '🛑 자동화 긴급 중지 (Kill-Switch)' }}
        </button>
        <NuxtLink class="button button-primary" to="/admin/articles/new">
          ＋ 새 기사 작성 / AI 생성
        </NuxtLink>
      </div>
    </div>

    <div v-if="data?.metrics.isAutomationPaused" class="admin-alert-banner warning">
      🚨 현재 <strong>자동화 긴급 중지(Kill-Switch)</strong>가 활성화되어 있습니다. 모든 자동 뉴스 수집 및 초안 작성이 일시 정지 상태입니다.
    </div>

    <!-- 핵심 지표 카드 그리드 -->
    <div class="admin-stats-grid">
      <div class="stat-card">
        <span class="stat-label">발행된 기사</span>
        <strong class="stat-num text-success">{{ data?.metrics.publishedCount || 0 }}</strong>
        <span class="stat-desc">독자 공개 중 (전체 {{ data?.metrics.totalArticles || 0 }}건)</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">검토 대기 큐</span>
        <strong class="stat-num text-warning">{{ data?.metrics.reviewCount || 0 }}</strong>
        <span class="stat-desc">편집자 검증 대기</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">예약 발행 큐</span>
        <strong class="stat-num text-primary">{{ data?.metrics.scheduledCount || 0 }}</strong>
        <span class="stat-desc">지정 시각 자동 배포</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">철회 / 정정</span>
        <strong class="stat-num text-danger">{{ data?.metrics.retractedCount || 0 }}</strong>
        <span class="stat-desc">편집국 조치 완료</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">활성 뉴스 출처</span>
        <strong class="stat-num">{{ data?.metrics.activeSources || 0 }}</strong>
        <span class="stat-desc">공식 RSS & API 연동</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">실제 인간 조회수</span>
        <strong class="stat-num">{{ data?.metrics.humanViews?.toLocaleString() || 0 }}</strong>
        <span class="stat-desc">봇 필터링 (봇: {{ data?.metrics.botViews?.toLocaleString() || 0 }})</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">제휴 클릭 (전환)</span>
        <strong class="stat-num text-accent">{{ data?.metrics.affiliateClicks?.toLocaleString() || 0 }}</strong>
        <span class="stat-desc">TripScanner · GetForTrip</span>
      </div>

      <div class="stat-card">
        <span class="stat-label">수집된 원문 피드</span>
        <strong class="stat-num">{{ data?.metrics.totalFeedItems?.toLocaleString() || 0 }}</strong>
        <span class="stat-desc">중복 제거 D1 보관</span>
      </div>
    </div>

    <!-- 출처 상태 및 최근 수집 실행 현황 -->
    <div class="dashboard-split-grid">
      <div class="panel-box">
        <div class="panel-head">
          <h2>공식 뉴스 출처 상태</h2>
          <NuxtLink to="/admin/sources" class="panel-link">출처 관리 →</NuxtLink>
        </div>
        <table class="admin-table">
          <thead>
            <tr><th>출처명</th><th>상태</th><th>최근 수집</th></tr>
          </thead>
          <tbody>
            <tr v-for="src in data?.sourcesHealth || []" :key="src.id">
              <td><strong>{{ src.name }}</strong></td>
              <td>
                <span class="badge" :class="src.last_status === 'ok' ? 'badge-success' : 'badge-danger'">
                  {{ src.last_status === 'ok' ? '정상' : src.last_status }}
                </span>
              </td>
              <td class="text-mono">{{ formatDate(src.last_fetched_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="panel-box">
        <div class="panel-head">
          <h2>최근 수집 파이프라인 이력</h2>
          <NuxtLink to="/admin/logs" class="panel-link">전체 로그 →</NuxtLink>
        </div>
        <table class="admin-table">
          <thead>
            <tr><th>출처</th><th>상태</th><th>수집/중복</th><th>시각</th></tr>
          </thead>
          <tbody>
            <tr v-for="run in data?.recentIngestionRuns || []" :key="run.id">
              <td>{{ run.source_name || run.id }}</td>
              <td>
                <span class="badge" :class="run.status === 'success' ? 'badge-success' : 'badge-warning'">
                  {{ run.status }}
                </span>
              </td>
              <td>+{{ run.fetched_count }} (중복 {{ run.duplicate_count }})</td>
              <td class="text-mono">{{ formatDate(run.started_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 최근 기사 및 상태 관리 테이블 -->
    <div class="panel-box recent-articles-panel">
      <div class="panel-head">
        <h2>최근 기사 및 편집국 상태</h2>
        <NuxtLink to="/admin/articles" class="panel-link">전체 기사 보기 →</NuxtLink>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>기사 제목</th>
            <th>카테고리</th>
            <th>상태</th>
            <th>검토 상태</th>
            <th>품질 점수</th>
            <th>조회수</th>
            <th>발행 일시</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="art in data?.recentArticles || []" :key="art.id">
            <td class="title-cell">
              <NuxtLink :to="`/admin/articles/${art.id}`" class="table-article-link">
                {{ art.title }}
              </NuxtLink>
            </td>
            <td><span class="tag-cat">{{ art.category }}</span></td>
            <td>
              <span class="badge" :class="art.status === 'published' ? 'badge-success' : 'badge-default'">
                {{ art.status === 'published' ? '발행' : '초안' }}
              </span>
            </td>
            <td>
              <span class="badge" :class="{
                'badge-success': art.review_status === 'approved',
                'badge-warning': art.review_status === 'needs_review' || art.review_status === 'candidate',
                'badge-danger': art.review_status === 'retracted' || art.review_status === 'rejected'
              }">
                {{ art.review_status }}
              </span>
            </td>
            <td><strong>{{ art.quality_score || 85 }}점</strong></td>
            <td>{{ art.view_count?.toLocaleString() || 0 }}</td>
            <td class="text-mono">{{ formatDate(art.published_at || art.created_at) }}</td>
            <td>
              <NuxtLink :to="`/admin/articles/${art.id}`" class="btn-sub-edit">편집</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.admin-heading-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.button-killswitch {
  background: #DC2626;
  color: #FFFFFF;
  border: none;
  font-weight: 800;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.button-killswitch.is-paused {
  background: #D97706;
}
.admin-alert-banner {
  padding: 14px 18px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 24px;
}
.admin-alert-banner.warning {
  background: #FEF3C7;
  border: 1px solid #F59E0B;
  color: #92400E;
}
.admin-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}
.stat-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 18px;
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 11px;
  font-weight: 700;
  color: #6B7280;
  font-family: 'DM Mono', monospace;
  margin-bottom: 6px;
}
.stat-num {
  font-size: 26px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 4px;
}
.stat-desc {
  font-size: 11px;
  color: #9CA3AF;
}
.text-success { color: #16A34A; }
.text-warning { color: #D97706; }
.text-danger { color: #DC2626; }
.text-primary { color: #0052CC; }
.text-accent { color: #FF5A5F; }

.dashboard-split-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 28px;
}
.panel-box {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 20px;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  border-bottom: 1px solid #F3F4F6;
  padding-bottom: 10px;
}
.panel-head h2 {
  font-size: 16px;
  font-weight: 800;
  margin: 0;
  color: #111827;
}
.panel-link {
  font-size: 12px;
  color: #0052CC;
  font-weight: 700;
  text-decoration: none;
}
.badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.badge-success { background: #DCFCE7; color: #16A34A; }
.badge-warning { background: #FEF3C7; color: #D97706; }
.badge-danger { background: #FEE2E2; color: #DC2626; }
.badge-default { background: #F3F4F6; color: #4B5563; }
.text-mono {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: #6B7280;
}
.title-cell {
  max-width: 320px;
}
.table-article-link {
  color: #111827;
  font-weight: 700;
  text-decoration: none;
}
.table-article-link:hover {
  color: #0052CC;
  text-decoration: underline;
}
.tag-cat {
  font-size: 11px;
  background: #F3F4F6;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.btn-sub-edit {
  font-size: 11px;
  font-weight: 700;
  color: #0052CC;
  text-decoration: none;
  padding: 4px 8px;
  border: 1px solid #BFDBFE;
  border-radius: 3px;
}
@media (max-width: 900px) {
  .admin-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dashboard-split-grid {
    grid-template-columns: 1fr;
  }
}
</style>