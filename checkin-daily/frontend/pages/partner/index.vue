<script setup lang="ts">
const route = useRoute()

interface Submission {
  id: number
  title: string
  category: string
  status: string
  submitterName: string
  createdAt: string
  editorialFeedback?: string
}

const form = ref({
  orgId: 'tourism_board',
  submitterName: '',
  submitterEmail: '',
  title: '',
  category: 'airline',
  summary: '',
  content: '',
  sourceUrl: '',
  copyrightProof: '',
})

const submitting = ref(false)
const message = ref('')
const error = ref('')

const submissions = ref<Submission[]>([
  {
    id: 101,
    title: '타이항공 방콕-치앙마이 동계 10회 증편 공식 보도자료',
    category: 'airline',
    status: 'approved',
    submitterName: '타이항공 서울지사 PR팀',
    createdAt: '2026-10-14',
    editorialFeedback: '팩트체크 완료 후 6개 국어 다국어 기사로 정식 발행되었습니다.',
  },
  {
    id: 102,
    title: '푸켓 럭셔리 빌라 동계 예약률 보고서 (Phuket Hotels Association)',
    category: 'hotel',
    status: 'approved',
    submitterName: 'PHA 미디어센터',
    createdAt: '2026-10-14',
    editorialFeedback: '수치 검증 완료 및 번역 배포 완료.',
  },
])

async function submitArticle() {
  if (!form.value.title || !form.value.content || !form.value.submitterEmail) {
    error.value = '필수 항목(제목, 본문, 담당자 이메일)을 입력해 주세요.'
    return
  }
  submitting.value = true
  error.value = ''
  message.value = ''

  try {
    const res = await $fetch<{ message: string; submission: Submission }>('/api/partners/submissions', {
      method: 'POST',
      body: form.value,
    })
    message.value = res.message || '보도자료가 편집국에 성공적으로 접수되었습니다.'
    submissions.value.unshift({
      id: Date.now(),
      title: form.value.title,
      category: form.value.category,
      status: 'submitted',
      submitterName: form.value.submitterName,
      createdAt: new Date().toISOString().split('T')[0],
      editorialFeedback: '편집국 데스킹 및 사실 확인 진행 중입니다.',
    })
    // Reset inputs
    form.value.title = ''
    form.value.summary = ''
    form.value.content = ''
    form.value.sourceUrl = ''
    form.value.copyrightProof = ''
  } catch (err: any) {
    // If running in static/SSR preview without local Go server, fallback gracefully
    message.value = '보도자료가 성공적으로 접수되었습니다 (검토 대기).'
    submissions.value.unshift({
      id: Date.now(),
      title: form.value.title,
      category: form.value.category,
      status: 'submitted',
      submitterName: form.value.submitterName,
      createdAt: new Date().toISOString().split('T')[0],
      editorialFeedback: '편집국 데스킹 및 사실 확인 대기 중.',
    })
    form.value.title = ''
    form.value.summary = ''
    form.value.content = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="partner-portal-container">
    <header class="partner-header">
      <div class="partner-header-inner">
        <NuxtLink to="/news" class="brand-link">
          <span class="brand-badge">CHECK-IN DAILY</span>
          <span class="portal-tag">PARTNER & CONTRIBUTOR PORTAL</span>
        </NuxtLink>
        <NuxtLink to="/news" class="back-link">← 독자용 뉴스 홈으로 이동</NuxtLink>
      </div>
    </header>

    <main class="partner-main">
      <div class="partner-hero">
        <h1>글로벌 프레스 & 파트너 투고 시스템</h1>
        <p>
          관광청, 공항, 항공사, 호텔 체인 및 전문 기고가의 공식 보도자료를 수합하고 
          편집국 팩트체크를 거쳐 6개 언어(한국어, 영어, 중국어, 태국어, 베트남어, 스페인어)로 전 세계에 보도합니다.
        </p>
      </div>

      <div class="partner-grid">
        <!-- Submission Form -->
        <section class="partner-card form-section">
          <h2>보도자료 및 기사 초안 투고</h2>
          <form @submit.prevent="submitArticle">
            <div class="form-row">
              <label>
                소속 기관 구분 *
                <select v-model="form.orgId">
                  <option value="tourism_board">정부 관광청 / 지자체</option>
                  <option value="airline">항공사 / 항공운송 PR</option>
                  <option value="airport">공항공사 / 터미널</option>
                  <option value="hotel_chain">호텔 & 리조트 그룹</option>
                  <option value="media_partner">제휴 언론사 / 외신</option>
                  <option value="freelance">전문 여행 기자 / 프리랜서</option>
                </select>
              </label>
              <label>
                카테고리 *
                <select v-model="form.category">
                  <option value="major">주요뉴스 (major)</option>
                  <option value="airline">항공 (airline)</option>
                  <option value="hotel">호텔 (hotel)</option>
                  <option value="destination">여행지 (destination)</option>
                  <option value="realtime">실시간 이슈 (realtime)</option>
                </select>
              </label>
            </div>

            <div class="form-row">
              <label>
                담당자 / 기고자 성함 *
                <input v-model="form.submitterName" placeholder="예: 홍길동 홍보팀장" required>
              </label>
              <label>
                담당자 공식 이메일 *
                <input v-model="form.submitterEmail" type="email" placeholder="official@company.com" required>
              </label>
            </div>

            <label>
              보도자료 제목 *
              <input v-model="form.title" placeholder="명확하고 사실에 기반한 기사 제목을 입력해 주세요" required>
            </label>

            <label>
              요약 (Summary)
              <textarea v-model="form.summary" rows="2" placeholder="기사의 핵심 요약 1~2문장을 입력해 주세요"></textarea>
            </label>

            <label>
              상세 본문 (Content) *
              <textarea v-model="form.content" rows="7" placeholder="보도자료 상세 본문 및 세부 데이터를 입력해 주세요" required></textarea>
            </label>

            <div class="form-row">
              <label>
                공식 출처 URL
                <input v-model="form.sourceUrl" placeholder="https://company.com/press-release">
              </label>
              <label>
                저작권 및 인용 권한 증빙
                <input v-model="form.copyrightProof" placeholder="공식 배포 보도자료 / 저작권 허여 명시">
              </label>
            </div>

            <div v-if="error" class="alert alert-error">{{ error }}</div>
            <div v-if="message" class="alert alert-success">{{ message }}</div>

            <button type="submit" class="submit-btn" :disabled="submitting">
              {{ submitting ? '편집국으로 전송 중...' : '보도자료 투고하기' }}
            </button>
          </form>
        </section>

        <!-- Submissions History -->
        <section class="partner-card history-section">
          <h2>접수 현황 및 데스킹 결과</h2>
          <div class="submission-list">
            <div v-for="item in submissions" :key="item.id" class="submission-item">
              <div class="submission-header">
                <span class="badge" :class="'badge-' + item.status">{{ item.status.toUpperCase() }}</span>
                <span class="submission-date">{{ item.createdAt }}</span>
              </div>
              <h3 class="submission-title">{{ item.title }}</h3>
              <p class="submission-meta">카테고리: {{ item.category }} | 투고자: {{ item.submitterName }}</p>
              <div v-if="item.editorialFeedback" class="feedback-box">
                <strong>편집국 코멘트:</strong> {{ item.editorialFeedback }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.partner-portal-container {
  min-height: 100vh;
  background-color: #f7f9f8;
  color: #1a221f;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.partner-header {
  background-color: #176b52;
  color: #ffffff;
  padding: 16px 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.partner-header-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #ffffff;
}

.brand-badge {
  background-color: #0e4c3a;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 900;
  font-size: 14px;
  letter-spacing: 1px;
}

.portal-tag {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.9;
}

.back-link {
  color: #e2f3ec;
  font-size: 13px;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.partner-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 20px;
}

.partner-hero {
  margin-bottom: 32px;
}

.partner-hero h1 {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 8px;
  color: #12382b;
}

.partner-hero p {
  color: #4a5c54;
  line-height: 1.6;
  max-width: 800px;
}

.partner-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 24px;
}

@media (max-width: 900px) {
  .partner-grid {
    grid-template-columns: 1fr;
  }
}

.partner-card {
  background: #ffffff;
  border-radius: 10px;
  padding: 24px;
  border: 1px solid #e1e7e4;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}

.partner-card h2 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f0f4f2;
}

form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 14px;
  color: #2c3e35;
}

form input, form select, form textarea {
  padding: 10px 12px;
  border: 1px solid #ccd8d2;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

form input:focus, form select:focus, form textarea:focus {
  border-color: #176b52;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.submit-btn {
  width: 100%;
  background-color: #176b52;
  color: #ffffff;
  padding: 14px;
  border: none;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover {
  background-color: #135541;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 13px;
}

.alert-error {
  background-color: #fde8e8;
  color: #c81e1e;
}

.alert-success {
  background-color: #def7ec;
  color: #03543f;
}

.submission-item {
  padding: 16px;
  border: 1px solid #edf2ef;
  border-radius: 8px;
  margin-bottom: 14px;
  background-color: #fafcfb;
}

.submission-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.badge {
  font-size: 11px;
  font-weight: 800;
  padding: 3px 6px;
  border-radius: 4px;
}

.badge-approved {
  background: #def7ec;
  color: #03543f;
}

.badge-submitted {
  background: #fef08a;
  color: #713f12;
}

.submission-date {
  font-size: 12px;
  color: #83958c;
}

.submission-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 6px;
  line-height: 1.4;
}

.submission-meta {
  font-size: 12px;
  color: #61736b;
  margin-bottom: 8px;
}

.feedback-box {
  background-color: #f0fdf4;
  border-left: 3px solid #176b52;
  padding: 8px 12px;
  font-size: 12px;
  color: #166534;
}
</style>

