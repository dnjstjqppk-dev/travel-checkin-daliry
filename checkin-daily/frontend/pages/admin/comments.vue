<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface AdminComment {
  id: number
  article_id: number
  parent_id: number | null
  author_name: string
  author_email: string | null
  content: string
  status: 'approved' | 'pending_review' | 'flagged' | 'deleted'
  like_count: number
  created_at: string
  article_title?: string
  report_count: number
}

const statusFilter = ref('')
const { data: response, refresh, pending } = await useFetch<{ success: boolean; total: number; comments: AdminComment[] }>(
  () => `/api/admin/comments${statusFilter.value ? `?status=${statusFilter.value}` : ''}`,
)

const comments = computed(() => response.value?.comments || [])
const actionMessage = ref('')
const isProcessing = ref(false)

async function moderate(commentId: number, action: 'approve' | 'flag' | 'delete' | 'dismiss_reports') {
  if (action === 'delete' && !confirm('이 댓글을 삭제 처리하시겠습니까? (삭제된 댓글로 표시됩니다)')) {
    return
  }

  isProcessing.value = true
  actionMessage.value = ''
  try {
    const res = await $fetch<{ success: boolean; message: string }>(`/api/admin/comments/${commentId}/moderate`, {
      method: 'POST',
      body: { action },
    })
    actionMessage.value = res.message || '모더레이션 처리가 완료되었습니다.'
    await refresh()
    setTimeout(() => { actionMessage.value = '' }, 3500)
  } catch (err: any) {
    actionMessage.value = err?.data?.statusMessage || '처리 중 오류가 발생했습니다.'
  } finally {
    isProcessing.value = false
  }
}

function formatDate(iso: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <section class="comments-page">
    <div class="page-top-bar">
      <div>
        <p class="eyebrow">COMMUNITY & ENGAGEMENT // READER MODERATION</p>
        <h1 class="page-title">독자 댓글 및 신고 모더레이션</h1>
      </div>
      <NuxtLink to="/admin/dashboard" class="ttr-back-btn">대시보드 복귀 ↗</NuxtLink>
    </div>

    <!-- 필터 탭 바 -->
    <div class="filter-tab-bar">
      <button
        class="tab-btn"
        :class="{ active: statusFilter === '' }"
        type="button"
        @click="statusFilter = ''"
      >
        전체 보기 ({{ response?.total || 0 }})
      </button>
      <button
        class="tab-btn flagged"
        :class="{ active: statusFilter === 'flagged' }"
        type="button"
        @click="statusFilter = 'flagged'"
      >
        🚩 신고/차단 접수
      </button>
      <button
        class="tab-btn"
        :class="{ active: statusFilter === 'pending_review' }"
        type="button"
        @click="statusFilter = 'pending_review'"
      >
        검토 대기중
      </button>
      <button
        class="tab-btn"
        :class="{ active: statusFilter === 'approved' }"
        type="button"
        @click="statusFilter = 'approved'"
      >
        승인/게시중
      </button>
      <button
        class="tab-btn"
        :class="{ active: statusFilter === 'deleted' }"
        type="button"
        @click="statusFilter = 'deleted'"
      >
        삭제됨
      </button>
    </div>

    <!-- 처리 피드백 배너 -->
    <div v-if="actionMessage" class="action-alert" role="status">
      {{ actionMessage }}
    </div>

    <!-- 댓글 목록 -->
    <div v-if="pending" class="loading-state">
      데이터를 불러오는 중입니다...
    </div>
    <div v-else-if="comments.length === 0" class="empty-state">
      해당 조건의 댓글이 없습니다.
    </div>
    <div v-else class="comment-grid">
      <div
        v-for="item in comments"
        :key="item.id"
        class="comment-card"
        :class="{
          'is-flagged': item.status === 'flagged' || item.report_count > 0,
          'is-deleted': item.status === 'deleted',
        }"
      >
        <div class="card-header">
          <div class="header-left">
            <span class="comment-id">#{{ item.id }}</span>
            <span class="author-name">{{ item.author_name }}</span>
            <span v-if="item.parent_id" class="reply-badge">답글 (Parent #{{ item.parent_id }})</span>
            <span class="created-at">{{ formatDate(item.created_at) }}</span>
          </div>
          <div class="header-right">
            <span v-if="item.report_count > 0" class="report-badge">
              🚨 신고 {{ item.report_count }}건
            </span>
            <span class="status-pill" :class="item.status">
              {{ item.status.toUpperCase() }}
            </span>
          </div>
        </div>

        <div class="card-article-title">
          <span class="article-label">기사:</span>
          <strong>{{ item.article_title || `기사 ID #${item.article_id}` }}</strong>
        </div>

        <div class="card-content">
          <p v-if="item.status === 'deleted'" class="deleted-content-notice">
            [삭제 처리된 댓글 내용입니다]
          </p>
          <p v-else class="comment-text">
            {{ item.content }}
          </p>
        </div>

        <div class="card-footer">
          <div class="footer-stats">
            <span>👍 추천 {{ item.like_count }}</span>
          </div>
          <div class="footer-actions">
            <button
              v-if="item.report_count > 0"
              class="action-btn dismiss"
              type="button"
              :disabled="isProcessing"
              @click="moderate(item.id, 'dismiss_reports')"
            >
              신고 기각
            </button>
            <button
              v-if="item.status !== 'approved'"
              class="action-btn approve"
              type="button"
              :disabled="isProcessing"
              @click="moderate(item.id, 'approve')"
            >
              승인
            </button>
            <button
              v-if="item.status !== 'flagged'"
              class="action-btn flag"
              type="button"
              :disabled="isProcessing"
              @click="moderate(item.id, 'flag')"
            >
              차단(Flag)
            </button>
            <button
              v-if="item.status !== 'deleted'"
              class="action-btn delete"
              type="button"
              :disabled="isProcessing"
              @click="moderate(item.id, 'delete')"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.comments-page {
  padding: 24px;
  max-width: 1280px;
  margin: 0 auto;
}

.page-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.eyebrow {
  font-size: 11px;
  font-family: monospace;
  color: #ff5252;
  letter-spacing: 0.1em;
  margin: 0 0 6px 0;
}

.page-title {
  font-size: 24px;
  font-weight: 800;
  color: #f1f5f9;
  margin: 0;
}

.ttr-back-btn {
  font-size: 13px;
  color: #94a3b8;
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
}
.ttr-back-btn:hover {
  color: #fff;
  border-color: #64748b;
}

.filter-tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 1px solid #1e293b;
  padding-bottom: 12px;
}

.tab-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #f1f5f9;
  border-color: #334155;
}

.tab-btn.active {
  background: #ff5252;
  color: #ffffff;
  border-color: #ff5252;
}

.action-alert {
  padding: 12px 18px;
  border-radius: 6px;
  background: #14532d;
  color: #86efac;
  border: 1px solid #22c55e;
  margin-bottom: 20px;
  font-size: 14px;
}

.loading-state,
.empty-state {
  padding: 48px;
  text-align: center;
  color: #64748b;
  background: #0f172a;
  border: 1px dashed #334155;
  border-radius: 8px;
}

.comment-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-card {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 18px 20px;
  transition: border-color 0.2s;
}

.comment-card.is-flagged {
  border-color: #ef4444;
  background: #1f1212;
}

.comment-card.is-deleted {
  opacity: 0.6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.comment-id {
  font-family: monospace;
  font-size: 12px;
  color: #64748b;
}

.author-name {
  font-weight: 700;
  color: #f8fafc;
  font-size: 15px;
}

.reply-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: #1e293b;
  color: #94a3b8;
  border-radius: 4px;
}

.created-at {
  font-size: 12px;
  color: #64748b;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-badge {
  background: #7f1d1d;
  color: #fca5a5;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
}

.status-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: monospace;
}

.status-pill.approved {
  background: #14532d;
  color: #86efac;
}

.status-pill.pending_review {
  background: #713f12;
  color: #fde047;
}

.status-pill.flagged {
  background: #7f1d1d;
  color: #fca5a5;
}

.status-pill.deleted {
  background: #334155;
  color: #94a3b8;
}

.card-article-title {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #1e293b;
}

.article-label {
  color: #64748b;
  margin-right: 6px;
}

.card-content {
  font-size: 14px;
  line-height: 1.6;
  color: #cbd5e1;
  margin-bottom: 14px;
}

.comment-text {
  margin: 0;
  white-space: pre-wrap;
}

.deleted-content-notice {
  font-style: italic;
  color: #64748b;
  margin: 0;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #1e293b;
}

.footer-stats {
  font-size: 12px;
  color: #64748b;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.action-btn.dismiss {
  background: #1e293b;
  color: #94a3b8;
  border-color: #334155;
}
.action-btn.dismiss:hover {
  background: #334155;
  color: #f1f5f9;
}

.action-btn.approve {
  background: #14532d;
  color: #86efac;
  border-color: #22c55e;
}
.action-btn.approve:hover {
  background: #166534;
}

.action-btn.flag {
  background: #78350f;
  color: #fde047;
  border-color: #f59e0b;
}
.action-btn.flag:hover {
  background: #92400e;
}

.action-btn.delete {
  background: #7f1d1d;
  color: #fca5a5;
  border-color: #ef4444;
}
.action-btn.delete:hover {
  background: #991b1b;
}
</style>
