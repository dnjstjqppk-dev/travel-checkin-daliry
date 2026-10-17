<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface ReviewItem {
  id: number
  title: string
  slug: string
  category: string
  status: string
  review_status: string
  quality_score: number
  author: string
  source_name: string
  source_url: string
  created_at: string
  fact_checks: string // JSON array
}

const { data, refresh } = await useFetch<{ queue: ReviewItem[] }>('/api/admin/review')
const processingId = ref<number | null>(null)
const selectedScheduleDate = ref('')

function parseFactChecks(jsonStr: string) {
  try {
    return JSON.parse(jsonStr || '[]')
  } catch {
    return []
  }
}

async function handleDecision(articleId: number, decision: 'approve' | 'reject', scheduledAt?: string) {
  processingId.value = articleId
  try {
    await $fetch('/api/admin/review', {
      method: 'POST',
      body: {
        articleId,
        decision,
        scheduledAt: scheduledAt || null,
      },
    })
    await refresh()
  } catch (err) {
    alert('검토 처리 중 오류가 발생했습니다.')
  } finally {
    processingId.value = null
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">EDITORIAL GOVERNANCE / REVIEW QUEUE</p>
        <h1>편집국 사실 검증 및 기사 승인 대기열</h1>
        <p class="admin-heading-copy">
          AI 자동 수집 및 초안 중 고위험 주제(인명 사고, 분쟁, 비자 변경 등) 및 신뢰도 기준 미달 기사를 사람이 직접 팩트체크하고 승인합니다.
        </p>
      </div>
      <button type="button" class="button" @click="() => refresh()">새로고침 ↻</button>
    </div>

    <div v-if="!data?.queue.length" class="empty-queue-box">
      <div class="empty-icon">✓</div>
      <h3>현재 검토 대기 중인 기사가 없습니다.</h3>
      <p>모든 인입 기사가 검증을 마쳤거나 안전 기준을 통과했습니다.</p>
    </div>

    <div v-else class="review-queue-list">
      <article v-for="item in data.queue" :key="item.id" class="review-card">
        <div class="review-card-head">
          <div class="head-left">
            <span class="badge" :class="item.review_status === 'needs_review' ? 'badge-danger' : 'badge-warning'">
              {{ item.review_status === 'needs_review' ? '⚠️ 고위험 검토 필요' : '후보 기사' }}
            </span>
            <span class="tag-cat">{{ item.category }}</span>
            <span class="score-badge">품질 점수: {{ item.quality_score }}점</span>
          </div>
          <span class="source-ref">
            출처: <a v-if="item.source_url" :href="item.source_url" target="_blank" rel="noopener noreferrer">{{ item.source_name || '외부 보도자료' }} ↗</a>
            <span v-else>{{ item.source_name || '출처 미상' }}</span>
          </span>
        </div>

        <h2 class="review-title">{{ item.title }}</h2>

        <!-- 팩트체크 항목들 -->
        <div class="fact-check-box">
          <h4>핵심 주장 및 팩트체크 검증 상태</h4>
          <div v-for="(fc, idx) in parseFactChecks(item.fact_checks)" :key="idx" class="fact-item">
            <span class="fc-status" :class="fc.status">{{ fc.status }}</span>
            <span class="fc-claim">{{ fc.claim }}</span>
            <a v-if="fc.evidence" :href="fc.evidence" target="_blank" class="fc-evidence">증빙 원문 ↗</a>
          </div>
        </div>

        <div class="review-actions">
          <NuxtLink :to="`/admin/articles/${item.id}`" class="button btn-edit">전문 편집 ↗</NuxtLink>
          <button
            type="button"
            class="button btn-approve"
            :disabled="processingId === item.id"
            @click="handleDecision(item.id, 'approve')"
          >
            {{ processingId === item.id ? '처리 중...' : '✓ 최종 승인 및 즉시 발행' }}
          </button>
          <button
            type="button"
            class="button btn-reject"
            :disabled="processingId === item.id"
            @click="handleDecision(item.id, 'reject')"
          >
            ✕ 반려 (기각)
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.empty-queue-box {
  background: #F0FDF4;
  border: 1px dashed #86EFAC;
  border-radius: 6px;
  padding: 60px 20px;
  text-align: center;
}
.empty-icon {
  font-size: 36px;
  color: #16A34A;
  margin-bottom: 8px;
}
.review-queue-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.review-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-left: 4px solid #F59E0B;
  border-radius: 6px;
  padding: 20px 24px;
}
.review-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.score-badge {
  font-size: 11px;
  font-weight: 700;
  color: #060D81;
  background: #EEF2FF;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.source-ref {
  font-size: 12px;
  color: #6B7280;
}
.source-ref a {
  color: #0052CC;
  font-weight: 700;
  text-decoration: underline;
}
.review-title {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 16px;
}
.fact-check-box {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  padding: 12px 16px;
  margin-bottom: 18px;
}
.fact-check-box h4 {
  font-size: 12px;
  font-weight: 700;
  margin: 0 0 8px;
  color: #374151;
  font-family: 'DM Mono', monospace;
}
.fact-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  margin-bottom: 4px;
}
.fc-status {
  font-size: 10px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.fc-status.verified { background: #DCFCE7; color: #16A34A; }
.fc-status.unverified { background: #FEE2E2; color: #DC2626; }
.fc-claim {
  color: #1F2937;
  flex: 1;
}
.fc-evidence {
  color: #0052CC;
  text-decoration: underline;
}
.review-actions {
  display: flex;
  gap: 10px;
}
.btn-approve {
  background: #16A34A;
  color: #FFFFFF;
}
.btn-reject {
  background: #DC2626;
  color: #FFFFFF;
}
.btn-edit {
  background: #F3F4F6;
  color: #374151;
}
.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.badge-warning { background: #FEF3C7; color: #D97706; }
.badge-danger { background: #FEE2E2; color: #DC2626; }
.tag-cat {
  font-size: 11px;
  background: #F3F4F6;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
</style>

