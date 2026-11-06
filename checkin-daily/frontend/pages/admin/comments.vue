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
       신고/차단 접수
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
             신고 {{ item.report_count }}건
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
            <span>추천 {{ item.like_count }}</span>
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
  color: var(--red);
  letter-spacing: 0.1em;
  margin: 0 0 6px 0;
}

.page-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--admin-text);
  margin: 0;
}

.ttr-back-btn {
  font-size: 13px;
  color: var(--admin-muted);
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid var(--text-secondary);
  background: var(--admin-card);
}
.ttr-back-btn:hover {
  color: var(--admin-text);
  border-color: var(--admin-muted);
}

.filter-tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--text-primary);
  padding-bottom: 12px;
}

.tab-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-muted);
  background: var(--admin-card);
  border: 1px solid var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--admin-text);
  border-color: var(--admin-text);
}

.tab-btn.active {
  background: var(--red);
  color: #ffffff;
  border-color: var(--red);
}

.action-alert {
  padding: 12px 18px;
  border-radius: 6px;
  background: var(--accent);
  color: var(--accent);
  border: 1px solid var(--accent);
  margin-bottom: 20px;
  font-size: 14px;
}

.loading-state,
.empty-state {
  padding: 48px;
  text-align: center;
  color: var(--admin-muted);
  background: var(--admin-card);
  border: 1px dashed var(--text-secondary);
  border-radius: 8px;
}

.comment-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-card {
  background: var(--admin-card);
  border: 1px solid var(--text-primary);
  border-radius: 8px;
  padding: 18px 20px;
  transition: border-color 0.2s;
}

.comment-card.is-flagged {
  border-color: var(--red);
  background: var(--red-dim);
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
  color: var(--admin-muted);
}

.author-name {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 15px;
}

.reply-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--text-primary);
  color: var(--admin-muted);
  border-radius: 4px;
}

.created-at {
  font-size: 12px;
  color: var(--admin-muted);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-badge {
  background: var(--red);
  color: var(--red);
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
  background: var(--accent);
  color: var(--accent);
}

.status-pill.pending_review {
  background: var(--amber);
  color: var(--amber);
}

.status-pill.flagged {
  background: var(--red);
  color: var(--red);
}

.status-pill.deleted {
  background: var(--text-secondary);
  color: var(--admin-muted);
}

.card-article-title {
  font-size: 13px;
  color: var(--admin-muted);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--text-primary);
}

.article-label {
  color: var(--admin-muted);
  margin-right: 6px;
}

.card-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--admin-text);
  margin-bottom: 14px;
}

.comment-text {
  margin: 0;
  white-space: pre-wrap;
}

.deleted-content-notice {
  font-style: italic;
  color: var(--admin-muted);
  margin: 0;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--text-primary);
}

.footer-stats {
  font-size: 12px;
  color: var(--admin-muted);
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
  background: var(--text-primary);
  color: var(--admin-muted);
  border-color: var(--admin-text);
}
.action-btn.dismiss:hover {
  background: var(--text-secondary);
  color: var(--admin-text);
}

.action-btn.approve {
  background: var(--accent);
  color: var(--accent);
  border-color: var(--accent);
}
.action-btn.approve:hover {
  background: var(--accent);
}

.action-btn.flag {
  background: var(--amber);
  color: var(--amber);
  border-color: var(--amber);
}
.action-btn.flag:hover {
  background: var(--amber);
}

.action-btn.delete {
  background: var(--red);
  color: var(--red);
  border-color: var(--red);
}
.action-btn.delete:hover {
  background: var(--red);
}
</style>
