<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface NewsSource {
  id: string
  name: string
  source_type: string
  endpoint_url: string
  fetch_interval_minutes: number
  license_info: string
  is_active: number
  last_fetched_at: string | null
  last_status: string
  total_items: number
  success_runs: number
  failed_runs: number
}

const { data, refresh } = await useFetch<{ sources: NewsSource[] }>('/api/admin/sources')

const form = reactive({
  id: '',
  name: '',
  source_type: 'rss',
  endpoint_url: '',
  fetch_interval_minutes: 60,
  license_info: 'Editorial Fair Citation / Press Release',
})

const isSubmitting = ref(false)
const showCreateModal = ref(false)

async function createSource() {
  if (!form.id || !form.name || !form.endpoint_url) return
  isSubmitting.value = true
  try {
    await $fetch('/api/admin/sources', {
      method: 'POST',
      body: { action: 'create', ...form },
    })
    showCreateModal.value = false
    await refresh()
  } catch (err: unknown) {
    alert('출처 등록 실패: ' + (err instanceof Error ? err.message : String(err)))
  } finally {
    isSubmitting.value = false
  }
}

async function toggleSource(src: NewsSource) {
  try {
    await $fetch('/api/admin/sources', {
      method: 'POST',
      body: { action: 'toggle', id: src.id, is_active: !src.is_active },
    })
    await refresh()
  } catch {
    alert('상태 변경 실패')
  }
}

function formatDate(val: string | null) {
  if (!val) return '-'
  return new Date(val).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">INGESTION ENGINE / NEWS SOURCES</p>
        <h1>공식 뉴스 수집 출처 관리</h1>
        <p class="admin-heading-copy">합법적 보도자료, 정부 및 항공사 공식 RSS/API 피드를 등록하고 수집 주기를 제어합니다.</p>
      </div>
      <button type="button" class="button button-primary" @click="showCreateModal = true">
        ＋ 새 공식 출처 등록
      </button>
    </div>

    <!-- 신규 출처 등록 모달 -->
    <div v-if="showCreateModal" class="modal-backdrop">
      <div class="modal-card">
        <h3>새 공식 뉴스 출처 등록</h3>
        <form @submit.prevent="createSource">
          <div class="form-group">
            <label>출처 고유 ID (영문/언더바)</label>
            <input v-model="form.id" placeholder="예: aot_press" required class="input-text">
          </div>
          <div class="form-group">
            <label>출처 명칭</label>
            <input v-model="form.name" placeholder="예: Airports of Thailand (AOT)" required class="input-text">
          </div>
          <div class="form-group">
            <label>수집 유형</label>
            <select v-model="form.source_type" class="input-text">
              <option value="rss">공식 RSS / Atom Feed</option>
              <option value="press_room">공식 언론 배포 보도자료 (Press Room)</option>
              <option value="official_api">공식 정부 / IATA API</option>
              <option value="partner_wire">제휴 통신사 와이어</option>
            </select>
          </div>
          <div class="form-group">
            <label>피드 엔드포인트 URL (SSRF 방어 적용)</label>
            <input v-model="form.endpoint_url" type="url" placeholder="https://www.tatnews.org/feed/" required class="input-text">
          </div>
          <div class="form-group">
            <label>수집 주기 (분 단위)</label>
            <input v-model.number="form.fetch_interval_minutes" type="number" min="10" max="1440" required class="input-text">
          </div>
          <div class="form-group">
            <label>저작권 및 이용 허가 정보</label>
            <input v-model="form.license_info" placeholder="공식 보도자료 / 공공누리 / 보도 인용" required class="input-text">
          </div>
          <div class="modal-actions">
            <button type="button" class="button" @click="showCreateModal = false">취소</button>
            <button type="submit" class="button button-primary" :disabled="isSubmitting">
              {{ isSubmitting ? '등록 중...' : '출처 저장' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 출처 테이블 -->
    <div class="admin-content-panel">
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr>
              <th>출처명</th>
              <th>유형</th>
              <th>엔드포인트 URL</th>
              <th>수집 주기</th>
              <th>저작권 정책</th>
              <th>수집 아이템</th>
              <th>최근 상태</th>
              <th>최근 수집</th>
              <th>활성</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="src in data?.sources || []" :key="src.id">
              <td><strong>{{ src.name }}</strong></td>
              <td><span class="tag-type">{{ src.source_type }}</span></td>
              <td class="text-url"><a :href="src.endpoint_url" target="_blank">{{ src.endpoint_url }}</a></td>
              <td>{{ src.fetch_interval_minutes }}분</td>
              <td><small>{{ src.license_info }}</small></td>
              <td>{{ src.total_items }}건</td>
              <td>
                <span class="badge" :class="src.last_status === 'ok' ? 'badge-success' : 'badge-danger'">
                  {{ src.last_status === 'ok' ? '정상' : src.last_status }}
                </span>
              </td>
              <td class="text-mono">{{ formatDate(src.last_fetched_at) }}</td>
              <td>
                <button
                  type="button"
                  class="btn-toggle"
                  :class="{ active: src.is_active }"
                  @click="toggleSource(src)"
                >
                  {{ src.is_active ? 'ON' : 'OFF' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-card {
  background: #FFFFFF;
  border-radius: 6px;
  padding: 28px;
  width: 520px;
  max-width: 90vw;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}
.modal-card h3 {
  margin: 0 0 20px;
  font-size: 18px;
  color: #111827;
}
.form-group {
  margin-bottom: 14px;
}
.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 4px;
}
.input-text {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  box-sizing: border-box;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.tag-type {
  font-size: 10px;
  background: #EEF2FF;
  color: #060D81;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.text-url {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.text-url a {
  color: #0052CC;
  text-decoration: none;
}
.btn-toggle {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 800;
  border-radius: 3px;
  border: 1px solid #D1D5DB;
  background: #F3F4F6;
  color: #6B7280;
  cursor: pointer;
}
.btn-toggle.active {
  background: #16A34A;
  color: #FFFFFF;
  border-color: #16A34A;
}
.badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.badge-success { background: #DCFCE7; color: #16A34A; }
.badge-danger { background: #FEE2E2; color: #DC2626; }
.text-mono {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
}
</style>

