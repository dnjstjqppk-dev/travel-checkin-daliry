<script setup lang="ts">
import { siteConfig } from '~/config/site.config'

const route = useRoute()
const articleIdInput = ref(String(route.query.articleId || ''))
const originalStatement = ref('')
const correctedStatement = ref('')
const evidenceUrl = ref('')
const reason = ref('')
const requesterEmail = ref('')

const submitting = ref(false)
const submitted = ref(false)
const errorMessage = ref('')

async function submitCorrection() {
  if (!articleIdInput.value || !originalStatement.value || !correctedStatement.value) {
    errorMessage.value = '기사 번호, 기존 보도 내용, 정정 요청 내용은 필수 입력 항목입니다.'
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/corrections/request', {
      method: 'POST',
      body: {
        articleId: Number(articleIdInput.value),
        originalStatement: originalStatement.value,
        correctedStatement: correctedStatement.value,
        evidenceUrl: evidenceUrl.value,
        reason: reason.value,
        requesterEmail: requesterEmail.value,
      },
    })
    if (res.success) {
      submitted.value = true
    }
  } catch (err: unknown) {
    errorMessage.value = '정정 요청 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    submitting.value = false
  }
}

useSeoMeta({
  title: `Reader Correction Center | ${siteConfig.brandName} ${siteConfig.brandSubname}`,
  description: '체크인데일리 독자 기사 정정 및 사실 확인 신청 센터',
})
</script>

<template>
  <div class="bkp-page-container correction-page">
    <nav class="bkp-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink to="/news" class="bkp-bc-link">HOME</NuxtLink>
      <span class="bkp-bc-sep">›</span>
      <span class="bkp-bc-current">READER CORRECTIONS</span>
    </nav>

    <header class="correction-header">
      <span class="correction-eyebrow">EDITORIAL INTEGRITY DESK</span>
      <h1 class="correction-title">독자 기사 정정 및 사실 확인 신청 센터</h1>
      <p class="correction-lead">
        체크인데일리는 모든 보도의 정확성을 최우선으로 합니다. 보도 중 사실과 다르거나 공식 확인이 필요한 오류를 발견하셨다면 아래 양식을 통해 접수해 주십시오. 편집국에서 24시간 이내에 1차 검증을 진행합니다.
      </p>
    </header>

    <div v-if="submitted" class="success-box">
      <div class="success-icon">✓</div>
      <h2>정정 요청이 성공적으로 접수되었습니다.</h2>
      <p>편집국 검토 대기열에 등록되었으며, 1차 공식 출처 교차 검증 후 신속하게 반영 및 고지하겠습니다.</p>
      <NuxtLink to="/news" class="btn-return">뉴스 홈으로 이동 →</NuxtLink>
    </div>

    <form v-else class="correction-form" @submit.prevent="submitCorrection">
      <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

      <div class="form-group">
        <label for="c-article-id">기사 고유 번호 (ID) *</label>
        <input id="c-article-id" v-model="articleIdInput" type="number" placeholder="예: 42" required class="input-text">
        <small class="help-text">기사 상세 페이지 URL 끝의 숫자 번호입니다.</small>
      </div>

      <div class="form-group">
        <label for="c-orig">기존 보도 내용 (오류가 있는 문장) *</label>
        <textarea id="c-orig" v-model="originalStatement" rows="3" placeholder="기사에 언급된 오류 문장을 입력하세요" required class="input-text" />
      </div>

      <div class="form-group">
        <label for="c-corrected">정정 요청 내용 (올바른 사실) *</label>
        <textarea id="c-corrected" v-model="correctedStatement" rows="3" placeholder="수정되어야 하는 올바른 사실 및 수치를 입력하세요" required class="input-text" />
      </div>

      <div class="form-group">
        <label for="c-evidence">공식 근거 자료 URL (선택)</label>
        <input id="c-evidence" v-model="evidenceUrl" type="url" placeholder="https://www.mot.go.th/... (항공사/정부 공식 발표 링크)" class="input-text">
      </div>

      <div class="form-group">
        <label for="c-reason">정정 사유 및 상세 설명 (선택)</label>
        <textarea id="c-reason" v-model="reason" rows="2" placeholder="정정이 필요한 배경이나 추가 설명을 남겨주세요" class="input-text" />
      </div>

      <div class="form-group">
        <label for="c-email">신청자 이메일 (결과 회신용, 선택)</label>
        <input id="c-email" v-model="requesterEmail" type="email" placeholder="reader@example.com" class="input-text">
      </div>

      <button type="submit" class="btn-submit" :disabled="submitting">
        {{ submitting ? '접수 처리 중...' : '정정 요청 제출하기' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.correction-page {
  padding: 24px 0 60px;
}
.correction-header {
  margin-bottom: 28px;
  border-bottom: 2px solid #060D81;
  padding-bottom: 16px;
}
.correction-eyebrow {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #D0021B;
  letter-spacing: 1px;
  display: block;
  margin-bottom: 8px;
}
.correction-title {
  font-size: 26px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 10px;
}
.correction-lead {
  font-size: 14px;
  color: #4B5563;
  line-height: 1.6;
  max-width: 760px;
  margin: 0;
}
.correction-form {
  max-width: 680px;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 28px;
}
.form-group {
  margin-bottom: 18px;
}
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 6px;
}
.input-text {
  width: 100%;
  padding: 10px 12px;
  font-size: 13px;
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  box-sizing: border-box;
}
.input-text:focus {
  outline: none;
  border-color: #060D81;
  box-shadow: 0 0 0 2px rgba(6, 13, 129, 0.1);
}
.help-text {
  font-size: 11px;
  color: #6B7280;
  margin-top: 4px;
  display: block;
}
.btn-submit {
  background: #060D81;
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 800;
  padding: 12px 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  letter-spacing: 0.5px;
}
.btn-submit:hover:not(:disabled) {
  background: #04095a;
}
.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.success-box {
  background: #F0FDF4;
  border: 1px solid #BBF7D0;
  border-radius: 6px;
  padding: 40px 24px;
  text-align: center;
  max-width: 600px;
}
.success-icon {
  font-size: 40px;
  color: #16A34A;
  margin-bottom: 12px;
}
.success-box h2 {
  font-size: 20px;
  font-weight: 800;
  color: #166534;
  margin: 0 0 8px;
}
.success-box p {
  font-size: 14px;
  color: #374151;
  margin: 0 0 24px;
}
.btn-return {
  display: inline-block;
  background: #16A34A;
  color: #FFFFFF;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.error-banner {
  background: #FEF2F2;
  border: 1px solid #FCA5A5;
  color: #B91C1C;
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 18px;
}
</style>

