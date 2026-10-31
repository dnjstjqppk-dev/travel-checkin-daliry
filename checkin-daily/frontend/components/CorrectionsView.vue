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
  <div class="ttr-page-container correction-page">
    <nav class="ttr-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink :to="locUrl('/news')" class="ttr-bc-link">HOME</NuxtLink>
      <span class="ttr-bc-sep">/</span>
      <span class="ttr-bc-current">READER CORRECTIONS</span>
    </nav>

    <header class="correction-header">
      <div class="ttr-kicker-tag">
        <span class="ping-dot" />
        <span>EDITORIAL ACCOUNTABILITY & TRANSPARENCY</span>
      </div>
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
        <NuxtLink :to="locUrl('/news')" class="ttr-btn-primary">뉴스 홈으로 돌아가기 →</NuxtLink>
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
          <button type="submit" class="ttr-btn-primary" :disabled="submitting">
            {{ submitting ? '접수 처리 중...' : '정정 청구 공식 제출하기 →' }}
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
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 80px;
}

.ttr-breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  margin-bottom: 20px;
  color: var(--text-muted, #8b949e);
  letter-spacing: 0.8px;
}

.ttr-bc-link {
  color: var(--text-muted, #8b949e);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s;
}

.ttr-bc-link:hover {
  color: #00d4aa;
}

.ttr-bc-sep {
  color: #383b52;
}

.ttr-bc-current {
  color: #00d4aa;
  font-weight: 700;
}

.correction-header {
  margin-bottom: 40px;
  border-bottom: 1px solid var(--border, #23253a);
  padding-bottom: 24px;
}

.ttr-kicker-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  color: #00d4aa;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.ping-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d4aa;
  box-shadow: 0 0 8px #00d4aa;
}

.correction-title {
  font-size: 28px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 14px;
  line-height: 1.3;
  letter-spacing: -0.6px;
}

.correction-lead {
  font-size: 15px;
  color: var(--text-muted, #8b949e);
  line-height: 1.7;
  max-width: 880px;
  margin: 0;
}

.correction-form-wrap {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 36px;
}

.correction-form {
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted, #8b949e);
}

.form-group input,
.form-group textarea {
  border: 1px solid var(--border, #23253a);
  border-radius: 6px;
  padding: 12px 14px;
  font-size: 13.5px;
  background: var(--bg-card, #181927);
  color: #e6edf3;
  transition: all 0.15s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #00d4aa;
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.2);
}

.form-hint {
  font-size: 11px;
  color: #6e7681;
  font-family: 'DM Mono', monospace;
}

.form-actions {
  margin-top: 12px;
}

.ttr-btn-primary {
  background: #00d4aa;
  color: #0d0e1a;
  border: 0;
  padding: 13px 32px;
  font-size: 13px;
  font-weight: 800;
  font-family: 'DM Mono', monospace;
  border-radius: 4px;
  cursor: pointer;
  letter-spacing: 0.5px;
  transition: all 0.2s;
}

.ttr-btn-primary:hover:not(:disabled) {
  background: #20eec4;
  box-shadow: 0 0 16px rgba(0, 212, 170, 0.4);
}

.ttr-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-box {
  background: #2b1115;
  border: 1px solid #ff7b72;
  color: #ff7b72;
  padding: 12px 14px;
  border-radius: 4px;
  font-size: 13px;
}

.correction-notice {
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 24px;
  height: fit-content;
  position: relative;
  overflow: hidden;
}

.correction-notice::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #58a6ff, #00d4aa, transparent);
}

.correction-notice h3 {
  font-size: 16px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 16px;
  border-bottom: 1px solid var(--border, #23253a);
  padding-bottom: 10px;
  font-family: 'DM Mono', monospace;
}

.correction-notice ol {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.correction-notice li {
  font-size: 13px;
  color: var(--text-muted, #8b949e);
  line-height: 1.6;
}

.correction-notice strong {
  color: #c9d1d9;
}

.success-banner {
  background: #0d261e;
  border: 1px solid #00d4aa;
  border-radius: 8px;
  padding: 36px;
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.banner-icon {
  font-size: 32px;
  color: #00d4aa;
  line-height: 1;
}

.banner-text h2 {
  font-size: 20px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 10px;
}

.banner-text p {
  font-size: 14px;
  color: var(--text-muted, #8b949e);
  line-height: 1.7;
  margin: 0 0 20px;
}

@media (max-width: 800px) {
  .correction-form-wrap {
    grid-template-columns: 1fr;
  }
}
</style>

