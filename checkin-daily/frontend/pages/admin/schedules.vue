<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface PublishJob {
  id: number
  article_id: number
  article_title: string
  category: string
  author: string
  scheduled_at: string
  status: string
  attempts: number
  last_error: string
  published_at: string | null
}

const { data, refresh } = await useFetch<{ jobs: PublishJob[] }>('/api/admin/schedules')
const processingId = ref<number | null>(null)

function formatDate(val: string | null) {
  if (!val) return '-'
  return new Date(val).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function handleJob(jobId: number, action: 'publish_now' | 'cancel') {
  processingId.value = jobId
  try {
    await $fetch('/api/admin/schedules', {
      method: 'POST',
      body: { jobId, action },
    })
    await refresh()
  } catch {
    alert('작업 처리 중 오류가 발생했습니다.')
  } finally {
    processingId.value = null
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">EDITORIAL DISPATCH / SCHEDULED JOBS</p>
        <h1>예약 발행 및 배포 대기열</h1>
        <p class="admin-heading-copy">승인된 기사를 타겟 독자층의 활동 시간에 맞춰 지정 시각에 자동 배포합니다.</p>
      </div>
      <button type="button" class="button" @click="() => refresh()">새로고침 ↻</button>
    </div>

    <div v-if="!data?.jobs.length" class="empty-box">
      <div class="empty-icon">⏱️</div>
      <h3>현재 예약된 발행 작업이 없습니다.</h3>
      <p>기사 편집기 또는 검토 대기열에서 기사를 승인할 때 예약 시각을 지정할 수 있습니다.</p>
    </div>

    <div v-else class="admin-content-panel">
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr>
              <th>작업 ID</th>
              <th>기사 제목</th>
              <th>카테고리</th>
              <th>예약 일시</th>
              <th>상태</th>
              <th>재시도</th>
              <th>관리 작업</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in data.jobs" :key="job.id">
              <td class="text-mono">#{{ job.id }}</td>
              <td>
                <NuxtLink :to="`/admin/articles/${job.article_id}`" class="table-link">
                  {{ job.article_title }}
                </NuxtLink>
              </td>
              <td><span class="tag-cat">{{ job.category }}</span></td>
              <td class="text-mono">{{ formatDate(job.scheduled_at) }}</td>
              <td>
                <span class="badge" :class="{
                  'badge-success': job.status === 'published',
                  'badge-warning': job.status === 'pending',
                  'badge-danger': job.status === 'failed',
                  'badge-default': job.status === 'cancelled'
                }">
                  {{ job.status }}
                </span>
              </td>
              <td>{{ job.attempts }}회</td>
              <td>
                <div v-if="job.status === 'pending'" class="job-actions">
                  <button
                    type="button"
                    class="btn-now"
                    :disabled="processingId === job.id"
                    @click="handleJob(job.id, 'publish_now')"
                  >
                    즉시 발행
                  </button>
                  <button
                    type="button"
                    class="btn-cancel"
                    :disabled="processingId === job.id"
                    @click="handleJob(job.id, 'cancel')"
                  >
                    취소
                  </button>
                </div>
                <span v-else class="text-sub">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.empty-box {
  background: #F9FAFB;
  border: 1px dashed #D1D5DB;
  border-radius: 6px;
  padding: 60px 20px;
  text-align: center;
}
.empty-icon {
  font-size: 36px;
  margin-bottom: 8px;
}
.text-mono {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
}
.table-link {
  font-weight: 700;
  color: #111827;
  text-decoration: none;
}
.table-link:hover {
  color: #0052CC;
  text-decoration: underline;
}
.job-actions {
  display: flex;
  gap: 6px;
}
.btn-now {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 3px;
  border: none;
  background: #16A34A;
  color: #FFFFFF;
  cursor: pointer;
}
.btn-cancel {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 3px;
  border: 1px solid #D1D5DB;
  background: #FFFFFF;
  color: #DC2626;
  cursor: pointer;
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
.badge-warning { background: #FEF3C7; color: #D97706; }
.badge-danger { background: #FEE2E2; color: #DC2626; }
.badge-default { background: #F3F4F6; color: #4B5563; }
.tag-cat {
  font-size: 11px;
  background: #F3F4F6;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.text-sub {
  color: #9CA3AF;
  font-size: 11px;
}
</style>

