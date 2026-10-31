<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface DispatchData {
  success: boolean
  newsletter: {
    activeSubscribers: number
    logs: Array<{
      id: number
      subject: string
      recipient_count: number
      success_count: number
      failure_count: number
      provider: string
      status: string
      error_detail: string | null
      created_at: string
    }>
  }
  webPush: {
    activeSubscribers: number
    logs: Array<{
      id: number
      title: string
      body: string
      target_url: string
      sent_count: number
      failed_count: number
      created_at: string
    }>
  }
}

const { data: dispatchData, refresh, pending } = await useFetch<DispatchData>('/api/admin/dispatch')

// Test Newsletter Send Form
const testEmail = ref('')
const isSendingNewsletter = ref(false)
const newsletterFeedback = ref('')

async function sendTestNewsletter() {
  if (!testEmail.value || !testEmail.value.includes('@')) {
    newsletterFeedback.value = '유효한 수신 이메일 주소를 입력해 주세요.'
    return
  }

  isSendingNewsletter.value = true
  newsletterFeedback.value = ''
  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/admin/dispatch/newsletter-test', {
      method: 'POST',
      body: { targetEmail: testEmail.value },
    })
    newsletterFeedback.value = res.message || '테스트 발송이 성공했습니다.'
    await refresh()
  } catch (err: any) {
    newsletterFeedback.value = err?.data?.statusMessage || '발송 요청에 실패했습니다.'
  } finally {
    isSendingNewsletter.value = false
  }
}

// Push Broadcast Form
const pushTitle = ref('')
const pushBody = ref('')
const pushUrl = ref('/news')
const isBroadcastingPush = ref(false)
const pushFeedback = ref('')

async function broadcastPush() {
  if (!pushTitle.value.trim() || !pushBody.value.trim()) {
    pushFeedback.value = '제목과 내용을 모두 입력해 주세요.'
    return
  }

  if (!confirm(`총 ${dispatchData.value?.webPush.activeSubscribers || 0}명의 구독자에게 실시간 웹 푸시 알림을 발송하시겠습니까?`)) {
    return
  }

  isBroadcastingPush.value = true
  pushFeedback.value = ''
  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/admin/push/broadcast', {
      method: 'POST',
      body: {
        title: pushTitle.value,
        body: pushBody.value,
        url: pushUrl.value,
      },
    })
    pushFeedback.value = res.message || '웹 푸시 브로드캐스트가 완료되었습니다.'
    pushTitle.value = ''
    pushBody.value = ''
    await refresh()
  } catch (err: any) {
    pushFeedback.value = err?.data?.statusMessage || '푸시 발송에 실패했습니다.'
  } finally {
    isBroadcastingPush.value = false
  }
}

function formatDate(iso: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ko-KR', {
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
  <section class="dispatch-page">
    <div class="page-top-bar">
      <div>
        <p class="eyebrow">DISTRIBUTION WIRE // DISPATCH MONITORING</p>
        <h1 class="page-title">뉴스레터 및 웹 푸시 발송 센터</h1>
      </div>
      <NuxtLink to="/admin/dashboard" class="ttr-back-btn">대시보드 복귀 ↗</NuxtLink>
    </div>

    <!-- 핵심 메트릭 카드 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="m-label">활성 뉴스레터 구독자</span>
        <strong class="m-val">{{ dispatchData?.newsletter.activeSubscribers.toLocaleString('ko-KR') || 0 }} 명</strong>
        <span class="m-sub">매일 08:00 KST 모닝 브리핑 자동 발송</span>
      </div>
      <div class="metric-card">
        <span class="m-label">활성 웹 푸시 구독 기기</span>
        <strong class="m-val">{{ dispatchData?.webPush.activeSubscribers.toLocaleString('ko-KR') || 0 }} 기기</strong>
        <span class="m-sub">데스크 공인 1차 속보 발생 시 즉시 전송</span>
      </div>
    </div>

    <!-- 2열 제어 패널: 뉴스레터 테스트 vs 웹 푸시 발송 -->
    <div class="control-row">
      <!-- 1. 뉴스레터 제어 -->
      <div class="control-box">
        <h2 class="box-title">📧 뉴스레터 테스트 발송</h2>
        <p class="box-desc">
          최신 기사 3건을 바탕으로 생성된 실제 모닝 브리핑 HTML 템플릿을 지정된 이메일로 즉시 발송합니다.
        </p>

        <form class="box-form" @submit.prevent="sendTestNewsletter">
          <div class="form-group">
            <label for="test-email">수신 테스트 이메일</label>
            <input
              id="test-email"
              v-model="testEmail"
              type="email"
              placeholder="editor@checkindaily.news"
              required
              class="ttr-input"
            />
          </div>
          <button type="submit" class="submit-btn" :disabled="isSendingNewsletter">
            {{ isSendingNewsletter ? '발송 중...' : '테스트 뉴스레터 발송 ✉️' }}
          </button>
        </form>

        <p v-if="newsletterFeedback" class="feedback-msg" role="status">
          {{ newsletterFeedback }}
        </p>
      </div>

      <!-- 2. 웹 푸시 수동 브로드캐스트 -->
      <div class="control-box">
        <h2 class="box-title">🔔 웹 푸시 수동 브로드캐스트</h2>
        <p class="box-desc">
          긴급 속보 또는 중요 공지를 구독 기기 전체에 웹 푸시 알림으로 즉각 전파합니다.
        </p>

        <form class="box-form" @submit.prevent="broadcastPush">
          <div class="form-group">
            <label for="push-title">푸시 알림 제목</label>
            <input
              id="push-title"
              v-model="pushTitle"
              type="text"
              placeholder="[속보] 수완나품 공항 비상 착륙 관련 최신 공지"
              required
              class="ttr-input"
            />
          </div>
          <div class="form-group">
            <label for="push-body">푸시 알림 본문 요약</label>
            <input
              id="push-body"
              v-model="pushBody"
              type="text"
              placeholder="태국 항공당국 공식 입장 발표 및 결항 노선 확인"
              required
              class="ttr-input"
            />
          </div>
          <div class="form-group">
            <label for="push-url">클릭 시 이동할 URL</label>
            <input
              id="push-url"
              v-model="pushUrl"
              type="text"
              placeholder="/news/major"
              required
              class="ttr-input"
            />
          </div>
          <button type="submit" class="submit-btn push" :disabled="isBroadcastingPush">
            {{ isBroadcastingPush ? '전송 중...' : '전체 푸시 즉시 발송 🚀' }}
          </button>
        </form>

        <p v-if="pushFeedback" class="feedback-msg" role="status">
          {{ pushFeedback }}
        </p>
      </div>
    </div>

    <!-- 발송 이력 로그 테이블 -->
    <div class="logs-section">
      <h2 class="section-title">📊 최근 뉴스레터 발송 이력</h2>
      <div v-if="!dispatchData?.newsletter.logs.length" class="empty-logs">
        아직 기록된 뉴스레터 발송 내역이 없습니다. (매일 08:00 KST 크론 실행 시 자동 기록됩니다)
      </div>
      <div v-else class="table-wrap">
        <table class="log-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>제목</th>
              <th>발송 프로바이더</th>
              <th>수신자 수</th>
              <th>성공 / 실패</th>
              <th>상태</th>
              <th>발송 일시</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in dispatchData.newsletter.logs" :key="log.id">
              <td class="font-mono">#{{ log.id }}</td>
              <td><strong>{{ log.subject }}</strong></td>
              <td><span class="provider-pill">{{ log.provider.toUpperCase() }}</span></td>
              <td>{{ log.recipient_count }}명</td>
              <td>
                <span class="success-txt">{{ log.success_count }}</span> /
                <span class="fail-txt">{{ log.failure_count }}</span>
              </td>
              <td>
                <span class="status-pill" :class="log.status">
                  {{ log.status.toUpperCase() }}
                </span>
              </td>
              <td class="font-mono">{{ formatDate(log.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 class="section-title mt-8">🔔 최근 웹 푸시 전송 이력</h2>
      <div v-if="!dispatchData?.webPush.logs.length" class="empty-logs">
        아직 기록된 웹 푸시 전송 내역이 없습니다.
      </div>
      <div v-else class="table-wrap">
        <table class="log-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>알림 제목</th>
              <th>연결 URL</th>
              <th>전송 성공</th>
              <th>실패/만료</th>
              <th>발송 일시</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in dispatchData.webPush.logs" :key="log.id">
              <td class="font-mono">#{{ log.id }}</td>
              <td><strong>{{ log.title }}</strong><br><small class="sub-text">{{ log.body }}</small></td>
              <td><a :href="log.target_url" target="_blank" class="link-txt">{{ log.target_url }} ↗</a></td>
              <td class="success-txt">{{ log.sent_count }}건</td>
              <td class="fail-txt">{{ log.failed_count }}건</td>
              <td class="font-mono">{{ formatDate(log.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dispatch-page {
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
  color: #00d4aa;
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
  border: 1px solid #334155;
  background: #0f172a;
}
.ttr-back-btn:hover {
  color: #fff;
  border-color: var(--admin-muted);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.m-label {
  font-size: 12px;
  color: var(--admin-muted);
  font-weight: 600;
  margin-bottom: 8px;
}

.m-val {
  font-size: 26px;
  font-weight: 800;
  color: #00d4aa;
  margin-bottom: 6px;
}

.m-sub {
  font-size: 12px;
  color: var(--admin-muted);
}

.control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 32px;
}

@media (max-width: 860px) {
  .control-row {
    grid-template-columns: 1fr;
  }
}

.control-box {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 24px;
}

.box-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--admin-text);
  margin: 0 0 8px 0;
}

.box-desc {
  font-size: 13px;
  color: var(--admin-muted);
  line-height: 1.5;
  margin: 0 0 18px 0;
}

.box-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  color: var(--admin-text);
  font-weight: 600;
}

.ttr-input {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 10px 14px;
  color: var(--admin-text);
  font-size: 13.5px;
}
.ttr-input:focus {
  outline: none;
  border-color: #00d4aa;
}

.submit-btn {
  background: #00d4aa;
  color: #0d0e1a;
  font-weight: 700;
  font-size: 13.5px;
  padding: 11px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 6px;
}
.submit-btn:hover {
  opacity: 0.9;
}
.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-btn.push {
  background: #38bdf8;
}

.feedback-msg {
  margin-top: 14px;
  font-size: 13px;
  color: #86efac;
  background: #14532d;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid #22c55e;
}

.logs-section {
  margin-top: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--admin-text);
  margin-bottom: 16px;
}
.mt-8 {
  margin-top: 32px;
}

.empty-logs {
  padding: 32px;
  text-align: center;
  color: var(--admin-muted);
  background: #0f172a;
  border: 1px dashed #334155;
  border-radius: 8px;
  font-size: 13px;
}

.table-wrap {
  overflow-x: auto;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.log-table th {
  background: #1e293b;
  color: var(--admin-muted);
  padding: 12px 14px;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.log-table td {
  padding: 12px 14px;
  border-top: 1px solid #1e293b;
  color: var(--admin-text);
}

.font-mono {
  font-family: monospace;
  font-size: 12px;
}

.provider-pill {
  font-family: monospace;
  font-size: 11px;
  padding: 2px 6px;
  background: #334155;
  border-radius: 4px;
  color: #e2e8f0;
}

.status-pill {
  font-family: monospace;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
}
.status-pill.completed {
  background: #14532d;
  color: #86efac;
}
.status-pill.partial {
  background: #713f12;
  color: #fde047;
}
.status-pill.failed {
  background: #7f1d1d;
  color: #fca5a5;
}

.success-txt {
  color: #4ade80;
  font-weight: 700;
}
.fail-txt {
  color: #f87171;
  font-weight: 700;
}

.sub-text {
  color: var(--admin-muted);
}

.link-txt {
  color: #38bdf8;
  text-decoration: none;
}
.link-txt:hover {
  text-decoration: underline;
}
</style>

