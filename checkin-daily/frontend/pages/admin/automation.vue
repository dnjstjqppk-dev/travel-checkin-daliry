<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Policy {
  key: string
  value: string
  description: string
  updated_at: string
}

const { data, refresh } = await useFetch<{ policies: Policy[] }>('/api/admin/automation')

const policyMap = computed(() => {
  const map: Record<string, string> = {}
  data.value?.policies.forEach((p) => { map[p.key] = p.value })
  return map
})

const isSaving = ref(false)
const saveSuccess = ref(false)

async function updatePolicy(key: string, value: string) {
  isSaving.value = true
  saveSuccess.value = false
  try {
    await $fetch('/api/admin/automation', {
      method: 'POST',
      body: { key, value },
    })
    saveSuccess.value = true
    await refresh()
    setTimeout(() => { saveSuccess.value = false }, 2500)
  } catch {
    alert('정책 저장 실패')
  } finally {
    isSaving.value = false
  }
}

interface GenerationLog {
  id: number
  trigger_type: string
  status: string
  source_title: string
  source_url: string
  model: string
  char_count: number
  article_id: number | null
  article_title: string | null
  error_code: string
  error_detail: string
  duration_ms: number
  created_at: string
}
interface OpsResponse {
  logs: GenerationLog[]
  totals7d: Record<string, number>
  publishedByCategory: Array<{ category: string; n: number }>
  backlog: number
}

const statusLabel: Record<string, string> = {
  started: '진행 중', drafted: '초안 저장', published: '자동 발행', duplicate: '중복 차단', rejected: '품질 차단', failed: '실패',
}
const { data: ops, refresh: refreshOps } = await useFetch<OpsResponse>('/api/admin/generation-logs')
const running = ref(false)
const runMessage = ref('')

async function runPipelineOnce() {
  running.value = true
  runMessage.value = ''
  try {
    const result = await $fetch<{ message: string }>('/api/cron/generate', { method: 'POST', body: {} })
    runMessage.value = result.message
  } catch (error) {
    const e = error as { data?: { statusMessage?: string }; message?: string }
    runMessage.value = `실행 실패: ${e.data?.statusMessage || e.message || 'unknown error'}`
  } finally {
    running.value = false
    await refreshOps()
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">EDITORIAL GOVERNANCE / AUTOMATION POLICY</p>
        <h1>뉴스룸 자동화 및 AI 안전 정책 설정</h1>
        <p class="admin-heading-copy">코드 수정 없이 뉴스 수집, AI 초안 작성, 자동 발행 허용 범위, 안전 키워드를 통제합니다.</p>
      </div>
      <span v-if="saveSuccess" class="save-toast">✓ 설정이 저장되었습니다.</span>
    </div>

    <div class="policy-card-grid">
      <!-- 1. 긴급 킬스위치 -->
      <div class="policy-card danger-zone">
        <div class="policy-header">
          <h3>전사 자동화 긴급 킬스위치 (Kill-Switch)</h3>
          <span class="badge" :class="policyMap.is_automation_paused === '1' ? 'badge-danger' : 'badge-success'">
            {{ policyMap.is_automation_paused === '1' ? '일시 중지됨' : '정상 가동' }}
          </span>
        </div>
        <p class="policy-desc">
          활성화 시 모든 백그라운드 뉴스 수집, 크롤링, AI 초안 작성이 즉각 중단됩니다. 긴급 상황 발생 시 사용하십시오.
        </p>
        <button
          type="button"
          class="btn-toggle-large"
          :class="{ active: policyMap.is_automation_paused === '1' }"
          @click="updatePolicy('is_automation_paused', policyMap.is_automation_paused === '1' ? '0' : '1')"
        >
          {{ policyMap.is_automation_paused === '1' ? '▶ 자동화 재개하기' : '자동화 즉시 중단' }}
        </button>
      </div>

      <!-- 2. AI 초안 자동 생성 -->
      <div class="policy-card">
        <div class="policy-header">
          <h3>피드 수집 시 AI 초안 자동 생성</h3>
          <span class="badge badge-success">{{ policyMap.auto_draft_enabled === '1' ? 'ON' : 'OFF' }}</span>
        </div>
        <p class="policy-desc">공식 RSS 피드 수집 시 300~1,000자 규격에 맞춰 AI 기사 초안과 5개국어 번역을 자동 생성합니다.</p>
        <button
          type="button"
          class="btn-toggle"
          :class="{ active: policyMap.auto_draft_enabled === '1' }"
          @click="updatePolicy('auto_draft_enabled', policyMap.auto_draft_enabled === '1' ? '0' : '1')"
        >
          {{ policyMap.auto_draft_enabled === '1' ? '자동 초안 작성 켜짐 (ON)' : '자동 초안 작성 꺼짐 (OFF)' }}
        </button>
      </div>

      <!-- 3. 사람 승인 없는 무검토 자동 발행 허용 여부 -->
      <div class="policy-card">
        <div class="policy-header">
          <h3>⚡ 무검토 즉시 자동 발행 허용 (Auto-Publish)</h3>
          <span class="badge" :class="policyMap.auto_publish_enabled === '1' ? 'badge-danger' : 'badge-default'">
            {{ policyMap.auto_publish_enabled === '1' ? '활성화 (위험)' : '비활성화 (권장)' }}
          </span>
        </div>
        <p class="policy-desc">
          초기 상용화 단계에서는 품질 및 법적 리스크 방지를 위해 비활성화(사람 편집자 승인 필수)를 강력히 권장합니다.
        </p>
        <button
          type="button"
          class="btn-toggle"
          :class="{ active: policyMap.auto_publish_enabled === '1' }"
          @click="updatePolicy('auto_publish_enabled', policyMap.auto_publish_enabled === '1' ? '0' : '1')"
        >
          {{ policyMap.auto_publish_enabled === '1' ? '즉시 발행 허용됨' : '편집자 검토 필수 (OFF)' }}
        </button>
      </div>

      <!-- 4. 고위험 검토 필수 키워드 가드레일 -->
      <div class="policy-card full-width">
        <div class="policy-header">
          <h3>고위험 검토 필수 키워드 가드레일 (Restricted Keywords)</h3>
        </div>
        <p class="policy-desc">
          아래 키워드가 원문 또는 제목에 포함된 기사는 자동 발행이 전면 차단되며, 반드시 편집국 검토 대기열로 이관됩니다. (쉼표로 구분)
        </p>
        <div class="keyword-editor">
          <input
            :value="policyMap.restricted_keywords"
            class="input-keywords"
            @change="(e: any) => updatePolicy('restricted_keywords', e.target.value)"
          >
          <small class="help-text">엔터키를 치거나 다른 곳을 클릭하면 자동 저장됩니다.</small>
        </div>
      </div>

      <!-- 5. 원문 이미지 사용 -->
      <div class="policy-card">
        <div class="policy-header">
          <h3>원문 대표 이미지 사용 (RSS media / og:image)</h3>
          <span class="badge" :class="policyMap.use_source_media === '1' ? 'badge-danger' : 'badge-success'">
            {{ policyMap.use_source_media === '1' ? '원문 이미지 사용' : '라이선스 자료 사진만' }}
          </span>
        </div>
        <p class="policy-desc">켜면 원문 매체의 대표 이미지를 썸네일로 사용합니다. 이미지 저작권은 원문 매체에 있으므로 사용 허락을 확인한 출처에서만 켜세요. 실패 시 카테고리 자료 사진으로 대체됩니다.</p>
        <button type="button" class="btn-toggle" :class="{ active: policyMap.use_source_media === '1' }"
          @click="updatePolicy('use_source_media', policyMap.use_source_media === '1' ? '0' : '1')">
          {{ policyMap.use_source_media === '1' ? 'ON' : 'OFF' }}
        </button>
      </div>

      <!-- 6. 회당 생성 건수 -->
      <div class="policy-card">
        <div class="policy-header">
          <h3>크론 1회당 최대 AI 생성 건수</h3>
        </div>
        <p class="policy-desc">Workers 실행 시간 한도를 지키기 위해 1~5건을 권장합니다. 남은 후보는 다음 실행에서 처리됩니다.</p>
        <div class="keyword-editor">
          <input :value="policyMap.max_generations_per_run" type="number" min="0" max="10" class="input-keywords"
            @change="(e: Event) => updatePolicy('max_generations_per_run', (e.target as HTMLInputElement).value)">
        </div>
      </div>
    </div>

    <!-- AI 엔진 운영 패널 -->
    <div class="ops-panel">
      <div class="policy-header">
        <h3>AI 자동 글쓰기 엔진 운영 현황</h3>
        <div class="ops-actions">
          <button type="button" class="btn-toggle active" :disabled="running" @click="runPipelineOnce">
            {{ running ? '실행 중… (최대 수 분 소요)' : 'AI 자동 기사 즉시 생성 (1회 실행)' }}
          </button>
          <button type="button" class="btn-toggle" :disabled="running" @click="() => refreshOps()">새로고침</button>
        </div>
      </div>
      <p v-if="runMessage" class="policy-desc run-message">{{ runMessage }}</p>

      <div class="ops-stats">
        <div class="ops-stat"><span>대기 후보</span><strong>{{ ops?.backlog ?? 0 }}</strong></div>
        <div v-for="status in ['published', 'drafted', 'duplicate', 'rejected', 'failed']" :key="status" class="ops-stat">
          <span>7일 {{ statusLabel[status] }}</span><strong>{{ ops?.totals7d?.[status] ?? 0 }}</strong>
        </div>
      </div>
      <div class="ops-categories">
        <span v-for="row in ops?.publishedByCategory || []" :key="row.category" class="badge">{{ row.category }} · {{ row.n }}</span>
      </div>

      <div class="ops-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>시각</th><th>트리거</th><th>상태</th><th>원문 / 생성 기사</th><th>모델</th><th>소요</th><th>사유</th></tr>
          </thead>
          <tbody>
            <tr v-if="!ops?.logs?.length"><td colspan="7">아직 실행 기록이 없습니다.</td></tr>
            <tr v-for="log in ops?.logs || []" :key="log.id">
              <td>{{ new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) }}</td>
              <td>{{ log.trigger_type }}</td>
              <td><span class="badge" :class="log.status === 'published' || log.status === 'drafted' ? 'badge-success' : log.status === 'failed' ? 'badge-danger' : ''">{{ statusLabel[log.status] || log.status }}</span></td>
              <td>
                <NuxtLink v-if="log.article_id" :to="`/admin/articles/${log.article_id}`">{{ log.article_title || `#${log.article_id}` }}</NuxtLink>
                <div class="log-source">{{ log.source_title }}</div>
              </td>
              <td>{{ log.model || '-' }}</td>
              <td>{{ log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '-' }}</td>
              <td class="log-reason">{{ log.error_code ? `[${log.error_code}] ` : '' }}{{ log.error_detail }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ops-panel { margin-top: 24px; background: var(--admin-card); border: 1px solid var(--admin-border); border-radius: 6px; padding: 24px; }
.ops-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.run-message { margin-top: 12px; }
.ops-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin: 18px 0 12px; }
.ops-stat { display: grid; gap: 4px; padding: 12px; border: 1px solid var(--admin-border); border-radius: 6px; font-size: 12px; color: var(--admin-muted); }
.ops-stat strong { font-size: 22px; color: var(--admin-heading); }
.ops-categories { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.ops-table-wrap { overflow-x: auto; }
.log-source { font-size: 11.5px; color: var(--admin-muted); margin-top: 2px; }
.log-reason { max-width: 320px; font-size: 12px; color: var(--admin-muted); }
.save-toast {
  color: var(--accent);
  font-weight: 700;
  font-size: 13px;
  background: var(--accent-dim);
  padding: 6px 12px;
  border-radius: 4px;
}
.policy-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.policy-card {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}
.policy-card.danger-zone {
  border-left: 4px solid var(--red);
  background: var(--admin-surface);
}
.policy-card.full-width {
  grid-column: 1 / -1;
}
.policy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.policy-header h3 {
  font-size: 16px;
  font-weight: 800;
  color: var(--admin-heading);
  margin: 0;
}
.policy-desc {
  font-size: 13px;
  color: var(--admin-text);
  line-height: 1.6;
  margin: 0 0 16px;
  flex: 1;
}
.btn-toggle-large {
  background: var(--red);
  color: var(--on-accent);
  font-weight: 800;
  padding: 10px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}
.btn-toggle-large.active {
  background: var(--amber);
}
.btn-toggle {
  background: var(--admin-surface);
  color: var(--admin-text);
  font-weight: 700;
  font-size: 13px;
  padding: 8px 14px;
  border: 1px solid var(--admin-border);
  border-radius: 4px;
  cursor: pointer;
}
.btn-toggle.active {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}
.input-keywords {
  width: 100%;
  padding: 10px 12px;
  font-size: 13px;
  border: 1px solid var(--admin-border);
  border-radius: 4px;
  box-sizing: border-box;

  background: var(--admin-input);
  color: var(--admin-text);}
.help-text {
  font-size: 11px;
  color: var(--admin-muted);
  margin-top: 6px;
  display: block;
}
.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.badge-success { background: var(--accent-dim); color: var(--accent); }
.badge-danger { background: var(--red-dim); color: var(--red); }
.badge-default { background: var(--admin-surface); color: var(--admin-text); }
</style>

