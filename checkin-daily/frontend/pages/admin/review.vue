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

interface PartnerSubmission {
  id: number
  org_id: string
  submitter_name: string
  submitter_email: string
  title: string
  summary: string
  content: string
  category: string
  source_url: string
  status: string
  created_at: string
}

interface ReaderCorrection {
  id: number
  article_id: number
  article_title: string
  article_category: string
  original_statement: string
  corrected_statement: string
  reason: string
  status: string
  corrected_at: string
}

const { data, refresh } = await useFetch<{
  queue: ReviewItem[]
  submissions?: PartnerSubmission[]
  corrections?: ReaderCorrection[]
}>('/api/admin/review')

const currentTab = ref<'queue' | 'submissions' | 'corrections'>('queue')
const processingId = ref<number | null>(null)

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
  } catch {
    alert('검토 처리 중 오류가 발생했습니다.')
  } finally {
    processingId.value = null
  }
}

async function handleSubmissionDecision(submissionId: number, decision: 'approve' | 'reject') {
  processingId.value = submissionId
  try {
    await $fetch('/api/admin/review', {
      method: 'POST',
      body: { submissionId, decision },
    })
    await refresh()
  } catch {
    alert('보도자료 처리 중 오류가 발생했습니다.')
  } finally {
    processingId.value = null
  }
}

async function handleCorrectionDecision(correctionId: number, decision: 'approve' | 'reject') {
  processingId.value = correctionId
  try {
    await $fetch('/api/admin/review', {
      method: 'POST',
      body: { correctionId, decision },
    })
    await refresh()
  } catch {
    alert('정정 요청 처리 중 오류가 발생했습니다.')
  } finally {
    processingId.value = null
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">EDITORIAL GOVERNANCE / UNIFIED REVIEW DESK</p>
        <h1>편집국 통합 데스킹 & 심사 큐</h1>
        <p class="admin-heading-copy">
          AI 자동 수집 기사, 파트너 및 기자 투고 보도자료, 독자 정정 청구를 단일 콘솔에서 검증·승인·반려합니다.
        </p>
      </div>
      <button type="button" class="button" @click="() => refresh()">새로고침 ↻</button>
    </div>

    <!-- 통합 데스크 3대 탭 네비게이션 -->
    <div class="review-tabs-bar">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: currentTab === 'queue' }"
        @click="currentTab = 'queue'"
      >
        기사 팩트체크 대기열 ({{ data?.queue?.length || 0 }})
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: currentTab === 'submissions' }"
        @click="currentTab = 'submissions'"
      >
        파트너 보도자료 투고 ({{ data?.submissions?.length || 0 }})
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: currentTab === 'corrections' }"
        @click="currentTab = 'corrections'"
      >
        독자 정정보도 청구 ({{ data?.corrections?.length || 0 }})
      </button>
    </div>

    <!-- 1. 기사 팩트체크 대기열 탭 -->
    <div v-if="currentTab === 'queue'">
      <div v-if="!data?.queue?.length" class="empty-queue-box">
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
    </div>

    <!-- 2. 파트너 보도자료 투고 탭 -->
    <div v-else-if="currentTab === 'submissions'">
      <div v-if="!data?.submissions?.length" class="empty-queue-box">
        <div class="empty-icon">✓</div>
        <h3>대기 중인 파트너 보도자료가 없습니다.</h3>
        <p>새로운 외부 보도자료가 접수되면 이곳에 실시간 노출됩니다.</p>
      </div>

      <div v-else class="review-queue-list">
        <article v-for="sub in data.submissions" :key="sub.id" class="review-card submission-card">
          <div class="review-card-head">
            <div class="head-left">
              <span class="badge badge-partner">파트너 투고</span>
              <span class="tag-cat">{{ sub.category }}</span>
              <span class="submitter-info">기고: {{ sub.submitter_name }} ({{ sub.submitter_email }})</span>
            </div>
            <span class="sub-date">{{ new Date(sub.created_at).toLocaleString('ko-KR') }}</span>
          </div>

          <h2 class="review-title">{{ sub.title }}</h2>
          <p class="review-summary">{{ sub.summary }}</p>
          <div class="submission-content-preview">{{ sub.content.slice(0, 300) }}...</div>

          <div class="review-actions">
            <a v-if="sub.source_url" :href="sub.source_url" target="_blank" class="button btn-edit">원문 링크 ↗</a>
            <button
              type="button"
              class="button btn-approve"
              :disabled="processingId === sub.id"
              @click="handleSubmissionDecision(sub.id, 'approve')"
            >
              {{ processingId === sub.id ? '처리 중...' : '✓ 승인 (기사화)' }}
            </button>
            <button
              type="button"
              class="button btn-reject"
              :disabled="processingId === sub.id"
              @click="handleSubmissionDecision(sub.id, 'reject')"
            >
              ✕ 반려
            </button>
          </div>
        </article>
      </div>
    </div>

    <!-- 3. 독자 정정보도 청구 탭 -->
    <div v-else-if="currentTab === 'corrections'">
      <div v-if="!data?.corrections?.length" class="empty-queue-box">
        <div class="empty-icon">✓</div>
        <h3>대기 중인 독자 정정보도 청구가 없습니다.</h3>
        <p>독자가 사실 오류를 신청하면 이곳에서 검토 및 배너 게재를 승인할 수 있습니다.</p>
      </div>

      <div v-else class="review-queue-list">
        <article v-for="cor in data.corrections" :key="cor.id" class="review-card correction-card">
          <div class="review-card-head">
            <div class="head-left">
              <span class="badge badge-danger">정정 신청</span>
              <span class="tag-cat">기사 #{{ cor.article_id }} ({{ cor.article_title || '기사 제목 미상' }})</span>
            </div>
            <span class="sub-date">{{ new Date(cor.corrected_at).toLocaleString('ko-KR') }}</span>
          </div>

          <div class="correction-diff-box">
            <p><strong>[원문 진술]</strong> <del>{{ cor.original_statement }}</del></p>
            <p><strong>[정정 요청]</strong> <ins>{{ cor.corrected_statement }}</ins></p>
            <p class="correction-reason"><strong>[사유 및 증빙]</strong> {{ cor.reason }}</p>
          </div>

          <div class="review-actions">
            <NuxtLink :to="`/admin/articles/${cor.article_id}`" class="button btn-edit">해당 기사 바로가기 ↗</NuxtLink>
            <button
              type="button"
              class="button btn-approve"
              :disabled="processingId === cor.id"
              @click="handleCorrectionDecision(cor.id, 'approve')"
            >
              {{ processingId === cor.id ? '처리 중...' : '✓ 정정 승인 (배너 게재)' }}
            </button>
            <button
              type="button"
              class="button btn-reject"
              :disabled="processingId === cor.id"
              @click="handleCorrectionDecision(cor.id, 'reject')"
            >
              ✕ 기각 (반려)
            </button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.review-tabs-bar {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid #E5E7EB;
  margin-bottom: 24px;
}
.tab-btn {
  background: transparent;
  border: 0;
  border-bottom: 3px solid transparent;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 700;
  color: #6B7280;
  cursor: pointer;
  margin-bottom: -2px;
  transition: all 0.15s ease;
}
.tab-btn:hover {
  color: #060D81;
}
.tab-btn.active {
  color: #060D81;
  border-bottom-color: #060D81;
}

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
.submission-card {
  border-left-color: #3B82F6;
}
.correction-card {
  border-left-color: #DC2626;
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
  gap: 10px;
}
.badge-partner {
  background: #EFF6FF;
  color: #1D4ED8;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
}
.submitter-info, .sub-date {
  font-size: 11px;
  color: #6B7280;
  font-family: monospace;
}
.review-title {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 10px;
}
.review-summary {
  font-size: 14px;
  color: #4B5563;
  line-height: 1.5;
  margin: 0 0 10px;
}
.submission-content-preview {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  padding: 10px 14px;
  font-size: 13px;
  color: #374151;
  font-family: monospace;
  margin-bottom: 16px;
}
.correction-diff-box {
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 6px;
  padding: 14px 18px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #1F2937;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.correction-diff-box del {
  color: #DC2626;
  font-weight: 700;
}
.correction-diff-box ins {
  color: #16A34A;
  font-weight: 700;
  text-decoration: none;
}
.correction-reason {
  color: #6B7280;
  font-size: 12px;
  margin-top: 4px;
}
.fact-check-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.fact-check-box h4 {
  font-size: 12px;
  font-weight: 800;
  color: #475569;
  margin: 0 0 8px;
}
.fact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 4px;
}
.fc-status {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 800;
  background: #DEF7EC;
  color: #03543F;
}
.review-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #E5E7EB;
}
.btn-edit {
  background: #F3F4F6;
  border: 1px solid #D1D5DB;
  color: #374151;
  font-weight: 700;
}
.btn-approve {
  background: #060D81;
  color: #FFFFFF;
  border: 0;
  font-weight: 800;
}
.btn-reject {
  background: #FEF2F2;
  color: #DC2626;
  border: 1px solid #FCA5A5;
}
</style>
