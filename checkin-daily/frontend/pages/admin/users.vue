<script setup lang="ts">
import { staffRoles } from '~/server/utils/staff-permissions'

definePageMeta({ layout: 'admin' })

interface Staff {
  id: number
  username: string
  role: string
  is_active: number
}

const { data: users, error, refresh } = await useFetch<Staff[]>('/api/admin/users')
const form = reactive({ username: '', password: '', role: 'reporter' })
const message = ref('')
const pending = ref(false)

async function createStaff() {
  pending.value = true
  message.value = ''
  try {
    await $fetch('/api/admin/users', { method: 'POST', body: form })
    form.username = ''
    form.password = ''
    await refresh()
    message.value = '새 스태프 계정이 성공적으로 등록되었습니다.'
  } catch (error: any) {
    message.value = error?.data?.statusMessage || '계정을 생성하지 못했습니다.'
  } finally {
    pending.value = false
  }
}

async function saveStaff(user: Staff) {
  pending.value = true
  message.value = ''
  try {
    await $fetch('/api/admin/users/' + user.id, {
      method: 'PATCH',
      body: { role: user.role, active: !!user.is_active },
    })
    await refresh()
    message.value = `${user.username} 계정 권한이 업데이트되었습니다. 기존 세션은 즉시 무효화됩니다.`
  } catch (error: any) {
    message.value = error?.data?.statusMessage || '계정 권한을 업데이트하지 못했습니다.'
    await refresh()
  } finally {
    pending.value = false
  }
}

const roleColors: Record<string, string> = {
  super_admin: '#ff5252',
  admin: '#ff7b72',
  editor_in_chief: '#00d4aa',
  editor: '#38bdf8',
  reporter: '#fbbf24',
  translator: '#a78bfa',
  auditor: '#94a3b8',
}
</script>

<template>
  <section class="staff-page">
    <div class="page-top-bar">
      <div>
        <p class="eyebrow">EDITORIAL ACCESS CONTROL // RBAC SECURITY</p>
        <h1 class="page-title">편집국 스태프 계정 및 권한 관리</h1>
      </div>
      <NuxtLink to="/admin/dashboard" class="ttr-back-btn">대시보드 복귀 ↗</NuxtLink>
    </div>

    <div class="rbac-role-guide">
      <div class="guide-item">
        <span class="role-pill" style="border-color: #ff5252; color: #ff5252;">SUPER ADMIN</span>
        <p>전체 시스템 설정, API 키, 데이터베이스 백업 및 모든 권한 관리</p>
      </div>
      <div class="guide-item">
        <span class="role-pill" style="border-color: #00d4aa; color: #00d4aa;">EDITOR IN CHIEF</span>
        <p>기사 최종 승인, 예약 발행, 정정 및 취소, 대시보드 통계 열람</p>
      </div>
      <div class="guide-item">
        <span class="role-pill" style="border-color: #38bdf8; color: #38bdf8;">EDITOR</span>
        <p>기사 작성, 편집, AI 단건 및 대량 생성, 번역 및 미디어 관리</p>
      </div>
      <div class="guide-item">
        <span class="role-pill" style="border-color: #fbbf24; color: #fbbf24;">REPORTER</span>
        <p>신규 기사 초안(Draft) 작성 및 편집국 검토(needs_review) 요청</p>
      </div>
    </div>

    <div v-if="error" class="alert-error" role="alert">
      계정 및 권한 관리 기능은 최고 관리자(Administrator) 전용 메뉴입니다.
    </div>

    <template v-else>
      <div v-if="message" class="alert-info" role="status">
        {{ message }}
      </div>

      <!-- 신규 스태프 등록 폼 -->
      <div class="terminal-card">
        <h2 class="card-heading">새 스태프 계정 생성 (Add Staff Account)</h2>
        <form class="create-form" @submit.prevent="createStaff">
          <div class="form-group">
            <label>아이디 (Username)</label>
            <input
              v-model="form.username"
              required
              minlength="3"
              maxlength="100"
              autocomplete="off"
              placeholder="예: reporter_kim"
            >
          </div>
          <div class="form-group">
            <label>임시 비밀번호 (Temporary Password, 12자 이상)</label>
            <input
              v-model="form.password"
              type="password"
              required
              minlength="12"
              maxlength="1024"
              autocomplete="new-password"
              placeholder="보안 비밀번호 입력"
            >
          </div>
          <div class="form-group">
            <label>지정 권한 (Assigned Role)</label>
            <select v-model="form.role">
              <option v-for="role in staffRoles" :key="role" :value="role">
                {{ role.toUpperCase() }}
              </option>
            </select>
          </div>
          <button :disabled="pending" type="submit" class="ttr-submit-btn">
            {{ pending ? '계정 생성 중...' : '+ 스태프 계정 등록' }}
          </button>
        </form>
      </div>

      <!-- 활성 계정 목록 테이블 -->
      <div class="terminal-card">
        <h2 class="card-heading">등록된 스태프 계정 목록 (Active Newsroom Accounts)</h2>
        <div class="table-scroll">
          <table class="ttr-table">
            <thead>
              <tr>
                <th>사용자명 (Username)</th>
                <th>보안 권한 (RBAC Role)</th>
                <th>계정 활성화</th>
                <th>관리 액션</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users || []" :key="user.id">
                <td class="username-cell">
                  <span class="user-avatar-dot" />
                  <strong>{{ user.username }}</strong>
                </td>
                <td>
                  <select
                    v-model="user.role"
                    class="role-select"
                    :aria-label="'Role for ' + user.username"
                    :style="{ color: roleColors[user.role] || '#ffffff' }"
                  >
                    <option v-for="role in staffRoles" :key="role" :value="role">
                      {{ role.toUpperCase() }}
                    </option>
                  </select>
                </td>
                <td>
                  <label class="toggle-wrap">
                    <input
                      v-model="user.is_active"
                      type="checkbox"
                      :true-value="1"
                      :false-value="0"
                      :aria-label="'Active status for ' + user.username"
                    >
                    <span class="status-tag" :class="{ active: user.is_active }">
                      {{ user.is_active ? 'ACTIVE' : 'DISABLED' }}
                    </span>
                  </label>
                </td>
                <td>
                  <button
                    :disabled="pending"
                    class="save-btn"
                    type="button"
                    @click="saveStaff(user)"
                  >
                    저장 및 적용
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.staff-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
  color: var(--text-base, #e1e3ea);
  font-family: inherit;
}

.page-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 1px solid var(--border, #23253a);
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 4px 0;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  font-weight: 800;
  color: var(--accent, #00d4aa);
  letter-spacing: 0.5px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #ffffff;
}

.ttr-back-btn {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  color: var(--text-base, #e1e3ea);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: border-color 0.15s;
}

.ttr-back-btn:hover {
  border-color: var(--accent, #00d4aa);
  color: var(--accent, #00d4aa);
}

.rbac-role-guide {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.guide-item {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 14px 16px;
}

.role-pill {
  display: inline-block;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 10.5px;
  font-weight: 800;
  border: 1px solid;
  border-radius: 4px;
  padding: 2px 6px;
  margin-bottom: 8px;
}

.guide-item p {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted, #8e92a8);
  line-height: 1.45;
}

.terminal-card {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.card-heading {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 800;
  color: #ffffff;
}

.create-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 200px;
}

.form-group label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted, #8e92a8);
}

input, select {
  background: var(--bg-input, #11121d);
  border: 1px solid var(--border, #23253a);
  color: #ffffff;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13.5px;
  outline: none;
  transition: border-color 0.15s;
}

input:focus, select:focus {
  border-color: var(--accent, #00d4aa);
}

.ttr-submit-btn {
  background: var(--accent, #00d4aa);
  color: #0d0e1a;
  border: none;
  padding: 11px 22px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 13.5px;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.ttr-submit-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.table-scroll {
  overflow-x: auto;
}

.ttr-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.ttr-table th {
  padding: 10px 14px;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted, #7e8299);
  border-bottom: 1px solid var(--border, #23253a);
}

.ttr-table td {
  padding: 14px;
  border-bottom: 1px solid rgba(35, 37, 58, 0.6);
  font-size: 13.5px;
}

.username-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar-dot {
  width: 8px;
  height: 8px;
  background: var(--accent, #00d4aa);
  border-radius: 50%;
}

.role-select {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 12px;
  font-weight: 800;
  padding: 6px 10px;
}

.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.status-tag {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 82, 82, 0.15);
  color: #ff5252;
}

.status-tag.active {
  background: rgba(0, 212, 170, 0.15);
  color: var(--accent, #00d4aa);
}

.save-btn {
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  color: var(--accent, #00d4aa);
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s;
}

.save-btn:hover {
  background: rgba(0, 212, 170, 0.1);
  border-color: var(--accent, #00d4aa);
}

.alert-info {
  background: rgba(0, 212, 170, 0.1);
  border: 1px solid rgba(0, 212, 170, 0.3);
  color: var(--accent, #00d4aa);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 13.5px;
}

.alert-error {
  background: rgba(255, 82, 82, 0.1);
  border: 1px solid rgba(255, 82, 82, 0.3);
  color: #ff5252;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 13.5px;
}
</style>
