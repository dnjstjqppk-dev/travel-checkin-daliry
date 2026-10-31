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
          <h3>🛑 전사 자동화 긴급 킬스위치 (Kill-Switch)</h3>
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
          {{ policyMap.is_automation_paused === '1' ? '▶ 자동화 재개하기' : '🛑 자동화 즉시 중단' }}
        </button>
      </div>

      <!-- 2. AI 초안 자동 생성 -->
      <div class="policy-card">
        <div class="policy-header">
          <h3>🤖 피드 수집 시 AI 초안 자동 생성</h3>
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
          <h3>🛡️ 고위험 검토 필수 키워드 가드레일 (Restricted Keywords)</h3>
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
    </div>
  </section>
</template>

<style scoped>
.save-toast {
  color: #10b981;
  font-weight: 700;
  font-size: 13px;
  background: rgba(16, 185, 129, 0.15);
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
  border-left: 4px solid #DC2626;
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
  background: #DC2626;
  color: #FFFFFF;
  font-weight: 800;
  padding: 10px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}
.btn-toggle-large.active {
  background: #D97706;
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
  color: #0d0e1a;
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
.badge-success { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.badge-danger { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.badge-default { background: var(--admin-surface); color: var(--admin-text); }
</style>

