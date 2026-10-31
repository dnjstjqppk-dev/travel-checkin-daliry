<script setup lang="ts">
import type { PublicComment } from '~/server/utils/comments-guard'

const props = defineProps<{
  articleId: number
}>()

const apiFetch = useRequestFetch()

const { data: commentsResponse, refresh } = await useAsyncData(
  `article-comments-${props.articleId}`,
  () => apiFetch<{ success: boolean; totalCount: number; comments: PublicComment[] }>(`/api/articles/${props.articleId}/comments`).catch(() => ({
    success: false,
    totalCount: 0,
    comments: [],
  })),
  { default: () => ({ success: false, totalCount: 0, comments: [] }) },
)

const comments = computed(() => commentsResponse.value?.comments || [])
const totalCount = computed(() => commentsResponse.value?.totalCount || 0)

// Main Comment Form
const authorName = ref('')
const password = ref('')
const content = ref('')
const isSubmitting = ref(false)
const submitMessage = ref('')
const submitError = ref('')

// Reply Form state
const activeReplyId = ref<number | null>(null)
const replyAuthor = ref('')
const replyPassword = ref('')
const replyContent = ref('')

// Delete Modal state
const deleteModalId = ref<number | null>(null)
const deletePassword = ref('')
const deleteError = ref('')

// Report Modal state
const reportModalId = ref<number | null>(null)
const reportReason = ref('스팸 / 홍보성 글')
const reportDetails = ref('')
const reportSuccess = ref('')

async function submitComment(parentId: number | null = null) {
  const isReply = Boolean(parentId)
  const name = isReply ? replyAuthor.value.trim() : authorName.value.trim()
  const pass = isReply ? replyPassword.value.trim() : password.value.trim()
  const body = isReply ? replyContent.value.trim() : content.value.trim()

  if (!name || name.length < 2) {
    submitError.value = '이름을 2자 이상 입력해 주세요.'
    return
  }
  if (!body || body.length < 2) {
    submitError.value = '댓글 내용을 2자 이상 입력해 주세요.'
    return
  }

  isSubmitting.value = true
  submitError.value = ''
  submitMessage.value = ''

  try {
    const res = await $fetch<{ success: boolean; message: string }>(`/api/articles/${props.articleId}/comments`, {
      method: 'POST',
      body: {
        authorName: name,
        password: pass || undefined,
        content: body,
        parentId: parentId || undefined,
      },
    })

    submitMessage.value = res.message || '댓글이 성공적으로 등록되었습니다.'
    if (isReply) {
      replyAuthor.value = ''
      replyPassword.value = ''
      replyContent.value = ''
      activeReplyId.value = null
    } else {
      authorName.value = ''
      password.value = ''
      content.value = ''
    }
    await refresh()
    setTimeout(() => { submitMessage.value = '' }, 3500)
  } catch (err: any) {
    submitError.value = err?.data?.statusMessage || err?.message || '댓글 등록 중 오류가 발생했습니다.'
  } finally {
    isSubmitting.value = false
  }
}

async function handleLike(commentId: number) {
  try {
    const res = await $fetch<{ success: boolean; likeCount: number }>(`/api/comments/${commentId}/like`, {
      method: 'POST',
    })
    if (res?.success) {
      await refresh()
    }
  } catch {}
}

function openDeleteModal(commentId: number) {
  deleteModalId.value = commentId
  deletePassword.value = ''
  deleteError.value = ''
}

async function confirmDelete() {
  if (!deleteModalId.value) return
  try {
    await $fetch(`/api/comments/${deleteModalId.value}`, {
      method: 'DELETE',
      body: { password: deletePassword.value },
    })
    deleteModalId.value = null
    await refresh()
  } catch (err: any) {
    deleteError.value = err?.data?.statusMessage || err?.message || '삭제에 실패했습니다. 비밀번호를 확인해 주세요.'
  }
}

function openReportModal(commentId: number) {
  reportModalId.value = commentId
  reportReason.value = '스팸 / 홍보성 글'
  reportDetails.value = ''
  reportSuccess.value = ''
}

async function submitReport() {
  if (!reportModalId.value) return
  try {
    const res = await $fetch<{ success: boolean; message: string }>(`/api/comments/${reportModalId.value}/report`, {
      method: 'POST',
      body: { reason: reportReason.value, details: reportDetails.value },
    })
    reportSuccess.value = res.message || '신고가 접수되었습니다.'
    setTimeout(() => {
      reportModalId.value = null
    }, 1500)
  } catch (err: any) {
    alert(err?.data?.statusMessage || '신고 접수 중 오류가 발생했습니다.')
  }
}

function formatDate(isoStr: string) {
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}
</script>

<template>
  <section class="ttr-comments-container">
    <div class="comments-header">
      <div class="comments-title-wrap">
        <span class="header-prefix">DISCUSSIONS //</span>
        <h3>독자 의견 및 실무 토론 <span class="comment-count">({{ totalCount }})</span></h3>
      </div>
      <p class="comments-policy-note">
        체크인데일리는 클린 저널리즘 가이드라인을 준수합니다. 비방, 욕설, 광고성 댓글은 자동 필터링됩니다.
      </p>
    </div>

    <!-- Comment Creation Form -->
    <form class="comment-input-form" @submit.prevent="submitComment(null)">
      <div class="form-row-top">
        <input
          v-model="authorName"
          type="text"
          placeholder="작성자 닉네임"
          maxlength="30"
          required
          class="comment-input author-field"
        >
        <input
          v-model="password"
          type="password"
          placeholder="삭제 비밀번호 (선택)"
          maxlength="32"
          class="comment-input pass-field"
        >
      </div>

      <div class="form-row-body">
        <textarea
          v-model="content"
          placeholder="기사에 대한 실무적인 의견이나 추가 현지 정보를 자유롭게 공유해 주세요..."
          rows="3"
          maxlength="1000"
          required
          class="comment-textarea"
        />
      </div>

      <div class="form-row-bottom">
        <span class="char-counter">{{ content.length }} / 1000자</span>
        <button
          type="submit"
          :disabled="isSubmitting || !content.trim() || !authorName.trim()"
          class="btn-submit-comment"
        >
          {{ isSubmitting ? '등록 중...' : '의견 등록하기' }}
        </button>
      </div>

      <div v-if="submitMessage" class="feedback-msg success">{{ submitMessage }}</div>
      <div v-if="submitError" class="feedback-msg error">{{ submitError }}</div>
    </form>

    <!-- Comments Tree -->
    <div v-if="comments.length > 0" class="comments-list">
      <div v-for="c in comments" :key="c.id" class="comment-item">
        <div class="comment-bubble">
          <div class="bubble-header">
            <span class="author-badge">{{ c.authorName }}</span>
            <span class="created-time">{{ formatDate(c.createdAt) }}</span>
          </div>

          <div class="bubble-body">
            {{ c.content }}
          </div>

          <div class="bubble-actions">
            <button type="button" class="btn-action like-btn" @click="handleLike(c.id)">
              👍 공감 <span class="like-num">{{ c.likeCount }}</span>
            </button>
            <button type="button" class="btn-action reply-btn" @click="activeReplyId = activeReplyId === c.id ? null : c.id">
              💬 답글
            </button>
            <button type="button" class="btn-action delete-btn" @click="openDeleteModal(c.id)">
              삭제
            </button>
            <button type="button" class="btn-action report-btn" @click="openReportModal(c.id)">
              신고
            </button>
          </div>
        </div>

        <!-- Inline Reply Form -->
        <div v-if="activeReplyId === c.id" class="reply-input-wrapper">
          <form class="reply-form" @submit.prevent="submitComment(c.id)">
            <div class="form-row-top">
              <input v-model="replyAuthor" type="text" placeholder="답글 닉네임" required class="comment-input author-field">
              <input v-model="replyPassword" type="password" placeholder="비밀번호" class="comment-input pass-field">
            </div>
            <textarea v-model="replyContent" placeholder="답글을 작성하세요..." rows="2" required class="comment-textarea" />
            <div class="form-row-bottom">
              <button type="button" class="btn-cancel" @click="activeReplyId = null">취소</button>
              <button type="submit" class="btn-submit-comment" :disabled="isSubmitting">답글 등록</button>
            </div>
          </form>
        </div>

        <!-- Nested Replies -->
        <div v-if="c.replies && c.replies.length > 0" class="replies-container">
          <div v-for="rep in c.replies" :key="rep.id" class="reply-item">
            <div class="comment-bubble reply-bubble">
              <div class="bubble-header">
                <span class="author-badge reply-badge">↳ {{ rep.authorName }}</span>
                <span class="created-time">{{ formatDate(rep.createdAt) }}</span>
              </div>
              <div class="bubble-body">
                {{ rep.content }}
              </div>
              <div class="bubble-actions">
                <button type="button" class="btn-action like-btn" @click="handleLike(rep.id)">
                  👍 공감 <span class="like-num">{{ rep.likeCount }}</span>
                </button>
                <button type="button" class="btn-action delete-btn" @click="openDeleteModal(rep.id)">
                  삭제
                </button>
                <button type="button" class="btn-action report-btn" @click="openReportModal(rep.id)">
                  신고
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-comments-box">
      <p>첫 번째로 이 기사에 대한 인사이트나 의견을 남겨보세요.</p>
    </div>

    <!-- Password Delete Modal -->
    <div v-if="deleteModalId" class="modal-backdrop" @click.self="deleteModalId = null">
      <div class="modal-box">
        <h4>댓글 삭제</h4>
        <p>작성 시 설정한 삭제 비밀번호를 입력해 주세요.</p>
        <input v-model="deletePassword" type="password" placeholder="비밀번호 입력" class="modal-input" autofocus>
        <div v-if="deleteError" class="feedback-msg error">{{ deleteError }}</div>
        <div class="modal-buttons">
          <button type="button" class="btn-cancel" @click="deleteModalId = null">취소</button>
          <button type="button" class="btn-danger" @click="confirmDelete">삭제 확인</button>
        </div>
      </div>
    </div>

    <!-- Report Modal -->
    <div v-if="reportModalId" class="modal-backdrop" @click.self="reportModalId = null">
      <div class="modal-box">
        <h4>부적절한 댓글 신고</h4>
        <label class="modal-label">신고 사유</label>
        <select v-model="reportReason" class="modal-select">
          <option>스팸 / 홍보성 글</option>
          <option>욕설 / 인신공격 / 혐오 표현</option>
          <option>허위 사실 / 가짜 뉴스 유포</option>
          <option>개인정보 침해</option>
        </select>
        <label class="modal-label">상세 내용 (선택)</label>
        <textarea v-model="reportDetails" rows="2" placeholder="자세한 사유를 입력해 주세요" class="modal-textarea" />
        <div v-if="reportSuccess" class="feedback-msg success">{{ reportSuccess }}</div>
        <div class="modal-buttons">
          <button type="button" class="btn-cancel" @click="reportModalId = null">닫기</button>
          <button type="button" class="btn-primary-action" @click="submitReport">신고 제출</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ttr-comments-container {
  margin-top: 48px;
  padding-top: 36px;
  border-top: 1px solid var(--border, #23253a);
}

.comments-header {
  margin-bottom: 24px;
}

.header-prefix {
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  color: #00d4aa;
  letter-spacing: 1px;
}

.comments-title-wrap h3 {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #ffffff);
  margin: 4px 0 6px 0;
}

.comment-count {
  color: #00d4aa;
  font-weight: 600;
}

.comments-policy-note {
  font-size: 12px;
  color: var(--text-muted, #71758e);
  margin: 0;
}

.comment-input-form {
  background: var(--bg-card, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 18px;
  margin-bottom: 32px;
}

.form-row-top {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.comment-input {
  background: var(--bg-card, #181927);
  border: 1px solid #2b2e44;
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text-primary, #ffffff);
  font-size: 13px;
}

.author-field {
  flex: 1;
}

.pass-field {
  width: 160px;
}

.comment-textarea {
  width: 100%;
  background: var(--bg-card, #181927);
  border: 1px solid #2b2e44;
  border-radius: 6px;
  padding: 12px;
  color: var(--text-primary, #ffffff);
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.comment-textarea:focus, .comment-input:focus {
  outline: none;
  border-color: #00d4aa;
}

.form-row-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.char-counter {
  font-size: 11px;
  font-family: monospace;
  color: #71758e;
}

.btn-submit-comment {
  background: #00d4aa;
  color: #0d0e1a;
  border: none;
  font-weight: 700;
  font-size: 13px;
  padding: 8px 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-submit-comment:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feedback-msg {
  margin-top: 10px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 4px;
}

.feedback-msg.success {
  background: rgba(0, 212, 170, 0.1);
  color: #00d4aa;
  border: 1px solid rgba(0, 212, 170, 0.3);
}

.feedback-msg.error {
  background: rgba(255, 82, 82, 0.1);
  color: #ff5252;
  border: 1px solid rgba(255, 82, 82, 0.3);
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-bubble {
  background: var(--bg-card, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 16px;
}

.bubble-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.author-badge {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-primary, #ffffff);
}

.reply-badge {
  color: #00d4aa;
}

.created-time {
  font-size: 11px;
  color: #71758e;
  font-family: monospace;
}

.bubble-body {
  font-size: 14px;
  line-height: 1.6;
  color: #d1d5db;
  margin-bottom: 12px;
  white-space: pre-wrap;
}

.bubble-actions {
  display: flex;
  gap: 14px;
  font-size: 12px;
}

.btn-action {
  background: none;
  border: none;
  color: #8e95aa;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  transition: color 0.15s;
}

.btn-action:hover {
  color: #ffffff;
}

.like-btn:hover {
  color: #00d4aa;
}

.like-num {
  font-weight: bold;
  color: #00d4aa;
}

.reply-input-wrapper {
  margin-top: 10px;
  padding-left: 20px;
}

.reply-form {
  background: var(--bg-card, #181927);
  border: 1px solid #2b2e44;
  border-radius: 6px;
  padding: 12px;
}

.replies-container {
  margin-top: 10px;
  padding-left: 24px;
  border-left: 2px solid var(--border, #23253a);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reply-bubble {
  background: var(--bg-card, #181927);
}

.no-comments-box {
  text-align: center;
  padding: 32px 16px;
  background: rgba(19, 20, 31, 0.5);
  border: 1px dashed var(--border, #23253a);
  border-radius: 8px;
  color: #71758e;
  font-size: 13px;
}

/* Modal styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-box {
  background: var(--bg-surface, #13141f);
  border: 1px solid #2b2e44;
  border-radius: 8px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.5);
}

.modal-box h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: var(--text-primary, #ffffff);
}

.modal-box p {
  font-size: 13px;
  color: #8e95aa;
  margin: 0 0 14px 0;
}

.modal-label {
  display: block;
  font-size: 12px;
  color: #8e95aa;
  margin: 10px 0 4px 0;
}

.modal-input, .modal-select, .modal-textarea {
  width: 100%;
  background: var(--bg-card, #181927);
  border: 1px solid #2b2e44;
  border-radius: 4px;
  padding: 8px 10px;
  color: var(--text-primary, #ffffff);
  font-size: 13px;
  box-sizing: border-box;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.btn-cancel {
  background: #1e2030;
  color: #d1d5db;
  border: 1px solid #2b2e44;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-danger {
  background: #ff5252;
  color: var(--text-primary, #ffffff);
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.btn-primary-action {
  background: #00d4aa;
  color: #0d0e1a;
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}
</style>

