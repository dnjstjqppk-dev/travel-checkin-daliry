<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface AuditLog {
  id: number
  actor_type: string
  actor_id: string
  action: string
  target_resource: string
  details_json: string
  created_at: string
}

const { data, refresh } = await useFetch<{ logs: AuditLog[] }>('/api/admin/logs')

function formatDate(val: string) {
  return new Date(val).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">FORENSIC COMPLIANCE / AUDIT TRAILS</p>
        <h1>편집국 전수 감사 및 활동 로그</h1>
        <p class="admin-heading-copy">기사 작성, 발행, 정정, 철회, 자동화 정책 변경 등 모든 행위를 불변 기록으로 보존합니다.</p>
      </div>
      <button type="button" class="button" @click="() => refresh()">새로고침 ↻</button>
    </div>

    <div class="admin-content-panel">
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr>
              <th>로그 ID</th>
              <th>수행 주체</th>
              <th>행위 (Action)</th>
              <th>대상 리소스</th>
              <th>상세 내용</th>
              <th>기록 일시</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in data?.logs || []" :key="log.id">
              <td class="text-mono">#{{ log.id }}</td>
              <td>
                <span class="badge" :class="log.actor_type === 'system' ? 'badge-default' : 'badge-primary'">
                  {{ log.actor_type }}
                </span>
                <span class="text-actor">{{ log.actor_id }}</span>
              </td>
              <td><strong>{{ log.action }}</strong></td>
              <td class="text-mono">{{ log.target_resource }}</td>
              <td class="details-cell">
                <code>{{ log.details_json }}</code>
              </td>
              <td class="text-mono">{{ formatDate(log.created_at) }}</td>
            </tr>
            <tr v-if="!data?.logs.length">
              <td colspan="6" class="text-center">기록된 감사 로그가 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.text-mono {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
}
.text-actor {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #374151;
}
.details-cell {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.details-cell code {
  font-size: 11px;
  color: #6B7280;
  background: #F3F4F6;
  padding: 2px 4px;
  border-radius: 3px;
}
.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.badge-primary { background: #EEF2FF; color: #0052CC; }
.badge-default { background: #F3F4F6; color: #4B5563; }
.text-center {
  text-align: center;
  color: #9CA3AF;
  padding: 30px;
}
</style>

