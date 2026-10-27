<script setup lang="ts">
import { siteConfig } from '~/config/site.config'

const { locUrl } = useI18n()
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
      <NuxtLink :to="locUrl('/news')" class="bkp-bc-link">HOME</NuxtLink>
      <span class="bkp-bc-sep">›</span>
      <span class="bkp-bc-current">READER CORRECTIONS</span>
    </nav>

    <header class="correction-header">
      <span class="correction-eyebrow">EDITORIAL ACCOUNTABILITY & TRANSPARENCY</span>
      <h1 class="correction-title">독자 고충 처리 및 기사 정정 청구 센터</h1>
      <p class="correction-lead">
        체크인데일리는 신속하고 정확한 저널리즘을 추구하며, 명백한 사실 오류에 대한 독자 여러분의 정정 요청을 열린 자세로 수용합니다.
        접수된 정정 안건은 편집국 팩트체크 위원회에서 24시간 이내에 공식 출처와 대조 심사하여 처리합니다.
      </p>
    </header>

    <div v-if="submitted" class="success-banner">
      <div class="banner-icon">✓</div>
      <div class="banner-text">
        <h2>정정 요청이 성공적으로 접수되었습니다.</h2>
        <p>편집국에서 입력해 주신 증빙 자료 및 원문 출처를 대조 검증한 후, 정정 사유가 합당할 경우 본문 상단에 '정정 고지'를 게재하고 기록을 영구 보존합니다.</p>
        <NuxtLink :to="locUrl('/news')" class="button button-primary">뉴스 홈으로 돌아가기</NuxtLink>
      </div>
    </div>

    <div v-else class="correction-form-wrap">
      <form class="correction-form" @submit.prevent="submitCorrection">
        <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

        <div class="form-group">
          <label for="articleId">정정 대상 기사 번호 (Article ID) *</label>
          <input
            id="articleId"
            v-model="articleIdInput"
            type="number"
            required
            placeholder="기사 URL 끝에 명시된 번호를 입력하세요 (예: 50)"
          />
          <span class="form-hint">기사 상세 페이지 URL의 맨 마지막 숫자입니다.</span>
        </div>

        <div class="form-group">
          <label for="requesterEmail">신청인 이메일 (결과 통보용)</label>
          <input
            id="requesterEmail"
            v-model="requesterEmail"
            type="email"
            placeholder="reader@example.com"
          />
        </div>

        <div class="form-group">
          <label for="originalStatement">기존 보도 내용 (오류로 지목된 문장) *</label>
          <textarea
            id="originalStatement"
            v-model="originalStatement"
            rows="3"
            required
            placeholder="기사 중 사실과 다르거나 왜곡된 문장을 복사하여 입력해 주세요."
          />
        </div>

        <div class="form-group">
          <label for="correctedStatement">정정 요청 내용 (올바른 사실 문장) *</label>
          <textarea
            id="correctedStatement"
            v-model="correctedStatement"
            rows="3"
            required
            placeholder="정정되어야 할 객관적 사실을 명확하게 기재해 주세요."
          />
        </div>

        <div class="form-group">
          <label for="evidenceUrl">공식 1차 증빙 출처 URL (정부 고시, 항공사 공식 발표 등)</label>
          <input
            id="evidenceUrl"
            v-model="evidenceUrl"
            type="url"
            placeholder="https://www.tatnews.org/..."
          />
        </div>

        <div class="form-group">
          <label for="reason">정정 청구 사유 및 부가 설명</label>
          <textarea
            id="reason"
            v-model="reason"
            rows="2"
            placeholder="오류가 발생한 배경이나 확인 근거에 대한 추가 설명을 적어주세요."
          />
        </div>

        <div class="form-actions">
          <button type="submit" class="button button-primary" :disabled="submitting">
            {{ submitting ? '접수 처리 중...' : '정정 청구 제출하기' }}
          </button>
        </div>
      </form>

      <aside class="correction-notice">
        <h3>기사 정정 처리 프로세스</h3>
        <ol>
          <li><strong>접수:</strong> 독자 정정 청구 센터를 통해 실시간 접수 (고유 접수번호 부여)</li>
          <li><strong>1차 검토:</strong> 담당 에디터 및 팩트체커가 신청된 증빙 자료의 신뢰성 검증</li>
          <li><strong>대조 확인:</strong> 관련 정부 기관, 항공사, 호텔 홍보실 등 1차 출처 직접 유선/서면 교차 검증</li>
          <li><strong>정정 발행:</strong> 명백한 오류 확인 시 '기사 정정 배너' 게재 및 원문 히스토리 보존</li>
          <li><strong>통보:</strong> 신청인 이메일로 심사 결과 및 조치 사항 개별 회신</li>
        </ol>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.correction-page {
  padding: 24px 0 60px;
}
.correction-header {
  margin-bottom: 36px;
  border-bottom: 2px solid #060D81;
  padding-bottom: 20px;
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
  font-size: 28px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 12px;
  line-height: 1.3;
}
.correction-lead {
  font-size: 15px;
  color: #4B5563;
  line-height: 1.7;
  max-width: 840px;
  margin: 0;
}
.correction-form-wrap {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 36px;
}
.correction-form {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 13px;
  font-weight: 700;
  color: #1F2937;
}
.form-group input,
.form-group textarea {
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
}
.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #060D81;
}
.form-hint {
  font-size: 11px;
  color: #6B7280;
}
.form-actions {
  margin-top: 10px;
}
.error-box {
  background: #FEF2F2;
  border: 1px solid #F87171;
  color: #991B1B;
  padding: 12px 14px;
  border-radius: 4px;
  font-size: 13px;
}
.correction-notice {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 24px;
  height: fit-content;
}
.correction-notice h3 {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 16px;
  border-bottom: 1px solid #E5E7EB;
  padding-bottom: 8px;
}
.correction-notice ol {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.correction-notice li {
  font-size: 13px;
  color: #4B5563;
  line-height: 1.6;
}
.success-banner {
  background: #ECFDF5;
  border: 1px solid #34D399;
  border-radius: 8px;
  padding: 32px;
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.banner-icon {
  font-size: 32px;
  color: #059669;
  line-height: 1;
}
.banner-text h2 {
  font-size: 20px;
  font-weight: 800;
  color: #065F46;
  margin: 0 0 8px;
}
.banner-text p {
  font-size: 14px;
  color: #047857;
  line-height: 1.7;
  margin: 0 0 20px;
}
@media (max-width: 800px) {
  .correction-form-wrap {
    grid-template-columns: 1fr;
  }
}
</style>

