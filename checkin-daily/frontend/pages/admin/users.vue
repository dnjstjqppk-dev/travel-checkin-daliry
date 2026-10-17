<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const roles = [
  { id: 'super_admin', name: 'Super Admin (최고 관리자)', desc: '전체 시스템 인프라, DB 마이그레이션, 킬스위치 제어' },
  { id: 'editor_in_chief', name: 'Editor in Chief (편집국장)', desc: '기사 최종 승인, 기사 철회 및 정정 공고 승인 권한' },
  { id: 'editor', name: 'Editor (데스크 에디터)', desc: '기사 사실 검증, 초안 편집, 발행 예약 승인' },
  { id: 'reporter', name: 'Reporter (취재 기자)', desc: '기사 작성, 원문 출처 및 팩트체크 증빙 입력' },
  { id: 'translator', name: 'Translator (글로벌 번역가)', desc: '6개 국어 다국어 번역 감수 및 고유명사 검증' },
  { id: 'auditor', name: 'Auditor (감사관)', desc: '감사 로그 열람 및 저작권 준수 상태 모니터링' },
]
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">GOVERNANCE & SECURITY / RBAC</p>
        <h1>편집국 계정 및 역할 기반 접근 제어 (RBAC)</h1>
        <p class="admin-heading-copy">기사 발행, 수정, 철회 권한을 엄격히 분리하여 무단 발행 및 보안 사고를 방지합니다.</p>
      </div>
    </div>

    <div class="roles-table-panel">
      <h2>편집국 직무별 접근 권한 매트릭스</h2>
      <table class="admin-table">
        <thead>
          <tr>
            <th>역할 ID</th>
            <th>직책 명칭</th>
            <th>주요 권한 및 통제 범위</th>
            <th>보안 수준</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in roles" :key="r.id">
            <td class="text-mono">{{ r.id }}</td>
            <td><strong>{{ r.name }}</strong></td>
            <td>{{ r.desc }}</td>
            <td><span class="badge badge-success">ENFORCED</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="security-standards-box">
      <h3>🛡️ 관리자 보안 및 세션 정책</h3>
      <ul>
        <li><strong>비밀번호 암호화:</strong> PBKDF2-SHA256 (100,000회 반복 해싱) 적용</li>
        <li><strong>브루트포스 차단:</strong> 로그인 5회 연속 실패 시 15분간 IP 자동 차단 (HTTP 429)</li>
        <li><strong>세션 보안:</strong> SameSite=Strict, HttpOnly 보안 쿠키 적용 및 CSRF 방어</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.roles-table-panel {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 24px;
  margin-bottom: 24px;
}
.roles-table-panel h2 {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 16px;
}
.text-mono {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
}
.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.badge-success { background: #DCFCE7; color: #16A34A; }
.security-standards-box {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 20px 24px;
}
.security-standards-box h3 {
  font-size: 15px;
  font-weight: 800;
  margin: 0 0 10px;
  color: #111827;
}
.security-standards-box ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #4B5563;
  line-height: 1.8;
}
</style>

