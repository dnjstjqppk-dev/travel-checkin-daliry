<script setup lang="ts">
import { siteConfig } from '~/config/site.config'

const { locUrl } = useI18n()

useSeoMeta({
  title: `Contact Us | ${siteConfig.brandName} ${siteConfig.brandSubname}`,
  description: `${siteConfig.brandName} 편집국 기사 제보, 보도자료 투고, 제휴 및 광고 문의 안내`,
})

const form = reactive({
  name: '',
  organization: '',
  email: '',
  category: 'press',
  title: '',
  message: '',
})

const isSubmitted = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  if (!form.name || !form.email || !form.title || !form.message) {
    alert('필수 입력 항목(* 표시)을 모두 작성해 주세요.')
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/contact', {
      method: 'POST',
      body: form,
    })
    if (res.success) {
      isSubmitted.value = true
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || '문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    alert(errorMessage.value)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="ttr-page-container contact-page">
    <nav class="ttr-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink :to="locUrl('/news')" class="ttr-bc-link">HOME</NuxtLink>
      <span class="ttr-bc-sep">/</span>
      <span class="ttr-bc-current">CONTACT US</span>
    </nav>

    <header class="contact-header">
      <div class="ttr-kicker-tag">
        <span class="ping-dot" />
        <span>EDITORIAL DESK & PARTNERSHIP INQUIRIES</span>
      </div>
      <h1 class="contact-title">체크인데일리 제휴 및 취재 문의</h1>
      <p class="contact-lead">
        체크인데일리는 전 세계 공항, 항공사, 글로벌 호텔 리조트, 정부 관광청 및 여행 스타트업과의 협력을 언제나 환영합니다.
        보도자료 투고, 심층 취재 요청, 디지털 광고 및 트래픽 제휴에 대한 공식 채널을 운영하고 있습니다.
      </p>
    </header>

    <div class="contact-grid">
      <section class="contact-card">
        <div class="card-icon">📰</div>
        <h2>보도자료 배포 및 취재 제보</h2>
        <p>항공 운항 스케줄 변경, 신규 취항, 호텔 오프닝, 관광청 프로모션 등 공식 프레스 릴리스를 전달해 주세요.</p>
        <div class="channel-info">
          <strong>편집국 이메일:</strong>
          <a :href="`mailto:${siteConfig.publisher.email}`">{{ siteConfig.publisher.email }}</a>
        </div>
      </section>

      <section class="contact-card">
        <div class="card-icon">🤝</div>
        <h2>광고 및 플랫폼 비즈니스 제휴</h2>
        <p>TripScanner(항공권 검색 엔진), GetForTrip(글로벌 투어 액티비티)과의 오디언스 연계 광고 및 제휴를 협의합니다.</p>
        <div class="channel-info">
          <strong>제휴팀 이메일:</strong>
          <a href="mailto:biz@checkindaily.com">biz@checkindaily.com</a>
        </div>
      </section>

      <section class="contact-card">
        <div class="card-icon">⚖️</div>
        <h2>독자 권익 및 정정보도 청구</h2>
        <p>기사 내용의 오류 정정 요청 또는 청소년 보호 관련 고충은 신속하게 전담 고충처리인을 통해 접수 및 처리됩니다.</p>
        <div class="channel-info">
          <strong>고충처리 직통:</strong>
          <NuxtLink :to="locUrl('/corrections')">정정보도 청구 센터 바로가기 →</NuxtLink>
        </div>
      </section>
    </div>

    <section class="inquiry-form-section">
      <h2>온라인 문의 접수 창구</h2>
      <p class="inquiry-desc">아래 양식을 작성해 주시면 담당 부서에서 영업일 기준 24시간 이내에 회신드립니다.</p>

      <div v-if="isSubmitted" class="submit-success">
        <div class="success-icon">✓</div>
        <h3>문의가 성공적으로 접수되었습니다.</h3>
        <p>담당 부서에서 검토 후 기재해 주신 이메일(<strong>{{ form.email }}</strong>)로 신속히 답변드리겠습니다.</p>
        <button class="ttr-btn-explore" type="button" @click="isSubmitted = false">추가 문의 작성</button>
      </div>

      <form v-else class="inquiry-form" @submit.prevent="handleSubmit">
        <div class="form-row">
          <label class="field">
            <span>성명 / 담당자명 *</span>
            <input v-model="form.name" required placeholder="홍길동" />
          </label>
          <label class="field">
            <span>소속 기관 / 기업명</span>
            <input v-model="form.organization" placeholder="예: 대한항공 홍보실 / 방콕 페닌슐라 호텔" />
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span>회신 받을 이메일 주소 *</span>
            <input v-model="form.email" type="email" required placeholder="contact@example.com" />
          </label>
          <label class="field">
            <span>문의 유형 *</span>
            <select v-model="form.category">
              <option value="press">보도자료 투고 및 취재 요청</option>
              <option value="ad">디지털 디스플레이 광고 집행</option>
              <option value="partner">플랫폼 트래픽 및 오디언스 제휴</option>
              <option value="rights">저작권 및 인용 허가 요청</option>
              <option value="etc">기타 일반 문의</option>
            </select>
          </label>
        </div>

        <label class="field full">
          <span>문의 제목 *</span>
          <input v-model="form.title" required placeholder="문의 제목을 간략히 요약해 주세요" />
        </label>

        <label class="field full">
          <span>문의 상세 내용 *</span>
          <textarea v-model="form.message" rows="6" required placeholder="보도자료 배포 시 배포 희망 일시 및 첨부 자료 URL을 함께 기재해 주시면 신속한 기사화에 도움이 됩니다." />
        </label>

        <div class="form-submit-row">
          <button type="submit" class="ttr-btn-primary" :disabled="isSubmitting">
            {{ isSubmitting ? '접수 처리 중...' : '문의 접수하기 →' }}
          </button>
        </div>
      </form>
    </section>

    <section class="office-info-section">
      <h2>본사 및 편집국 안내</h2>
      <div class="office-table-wrap">
        <table class="office-table">
          <tbody>
            <tr><th>매체사</th><td>{{ siteConfig.publisher.name }} (체크인데일리 디지털 뉴스룸)</td></tr>
            <tr><th>발행소 주소</th><td>{{ siteConfig.publisher.address }}</td></tr>
            <tr><th>대표 전화</th><td>02-738-2026</td></tr>
            <tr><th>발행·편집인</th><td>{{ siteConfig.publisher.editorInChief }}</td></tr>
            <tr><th>청소년보호책임자</th><td>{{ siteConfig.publisher.editorInChief }}</td></tr>
            <tr><th>등록 번호</th><td>{{ siteConfig.publisher.registrationNumber }}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.contact-page {
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

.contact-header {
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

.contact-title {
  font-size: 28px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 14px;
  line-height: 1.3;
  letter-spacing: -0.6px;
}

.contact-lead {
  font-size: 15px;
  color: var(--text-muted, #8b949e);
  line-height: 1.7;
  max-width: 880px;
  margin: 0;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 40px;
}

.contact-card {
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;
}

.contact-card:hover {
  border-color: #00d4aa;
}

.contact-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #00d4aa, transparent);
}

.card-icon {
  font-size: 30px;
  margin-bottom: 12px;
}

.contact-card h2 {
  font-size: 16px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 8px;
}

.contact-card p {
  font-size: 13px;
  color: var(--text-muted, #8b949e);
  line-height: 1.6;
  margin: 0 0 16px;
  flex: 1;
}

.channel-info {
  font-size: 13px;
  color: #c9d1d9;
  border-top: 1px dashed var(--border, #23253a);
  padding-top: 12px;
}

.channel-info a {
  color: #00d4aa;
  font-weight: 700;
  text-decoration: underline;
  margin-left: 4px;
}

.inquiry-form-section {
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 32px;
  margin-bottom: 40px;
}

.inquiry-form-section h2 {
  font-size: 20px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 6px;
  letter-spacing: -0.4px;
}

.inquiry-desc {
  font-size: 13px;
  color: var(--text-muted, #8b949e);
  margin: 0 0 24px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted, #8b949e);
}

.field.full {
  margin-bottom: 16px;
}

.field input,
.field select,
.field textarea {
  padding: 12px 14px;
  border: 1px solid var(--border, #23253a);
  border-radius: 6px;
  font-size: 13.5px;
  background: var(--bg-card, #181927);
  color: #e6edf3;
  transition: all 0.15s;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: #00d4aa;
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.2);
}

.form-submit-row {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
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

.submit-success {
  text-align: center;
  padding: 40px 20px;
  background: #0d261e;
  border: 1px solid #00d4aa;
  border-radius: 8px;
}

.success-icon {
  font-size: 36px;
  color: #00d4aa;
  margin-bottom: 12px;
}

.submit-success h3 {
  font-size: 18px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 8px;
}

.submit-success p {
  font-size: 13.5px;
  color: var(--text-muted, #8b949e);
  margin: 0 0 20px;
}

.ttr-btn-explore {
  display: inline-block;
  background: var(--bg-card, #181927);
  border: 1px solid #00d4aa;
  color: #00d4aa;
  padding: 10px 24px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  cursor: pointer;
}

.office-info-section {
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 24px 28px;
}

.office-info-section h2 {
  font-size: 17px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 16px;
  font-family: 'DM Mono', monospace;
}

.office-table-wrap {
  overflow-x: auto;
}

.office-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.office-table th {
  width: 180px;
  text-align: left;
  padding: 12px 16px;
  background: var(--bg-card, #181927);
  color: var(--text-muted, #8b949e);
  border-bottom: 1px solid var(--border, #23253a);
  font-weight: 700;
}

.office-table td {
  padding: 12px 16px;
  color: #c9d1d9;
  border-bottom: 1px solid var(--border, #23253a);
}

@media (max-width: 800px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>

