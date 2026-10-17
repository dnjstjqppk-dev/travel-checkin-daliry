<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const logoutError = ref('')

const navGroups = [
  {
    title: 'EDITORIAL NEWSROOM',
    items: [
      { label: '뉴스룸 대시보드', to: '/admin/dashboard', icon: '📊' },
      { label: '기사 목록 및 관리', to: '/admin/articles', icon: '📰' },
      { label: '새 기사 / AI 생성', to: '/admin/articles/new', icon: '✍️' },
      { label: '편집국 검토 대기열', to: '/admin/review', icon: '⚖️' },
      { label: '예약 발행 큐', to: '/admin/schedules', icon: '⏱️' },
    ],
  },
  {
    title: 'INGESTION & AUTOMATION',
    items: [
      { label: '뉴스 수집 출처', to: '/admin/sources', icon: '📡' },
      { label: '자동화 정책 설정', to: '/admin/automation', icon: '⚙️' },
      { label: '다국어 번역 현황', to: '/admin/translations', icon: '🌐' },
      { label: '미디어 & 저작권', to: '/admin/media', icon: '🖼️' },
    ],
  },
  {
    title: 'TAXONOMY & REVENUE',
    items: [
      { label: '카테고리 관리', to: '/admin/categories', icon: '🏷️' },
      { label: '국가 · 도시 관리', to: '/admin/locations', icon: '📍' },
      { label: '광고 슬롯 관리', to: '/admin/ads', icon: '📢' },
      { label: '제휴 수익화 (Trip/Get)', to: '/admin/affiliate', icon: '💰' },
    ],
  },
  {
    title: 'GOVERNANCE & AUDIT',
    items: [
      { label: '트래픽 & 봇 분석', to: '/admin/analytics', icon: '📈' },
      { label: 'SEO & 뉴스 사이트맵', to: '/admin/seo', icon: '🔍' },
      { label: '편집국 계정 및 권한', to: '/admin/users', icon: '👥' },
      { label: '편집국 감사 로그', to: '/admin/logs', icon: '📜' },
      { label: '시스템 설정', to: '/admin/settings', icon: '🛠️' },
    ],
  },
]

const pageLabel = computed(() => {
  if (route.path === '/admin/dashboard') return '뉴스룸 대시보드'
  if (route.path === '/admin/articles') return '기사 목록 및 관리'
  if (route.path === '/admin/articles/new') return '새 기사 작성 및 AI 생성'
  if (route.path === '/admin/review') return '편집국 검토 대기열'
  if (route.path === '/admin/schedules') return '예약 발행 큐'
  if (route.path === '/admin/sources') return '뉴스 수집 출처'
  if (route.path === '/admin/automation') return '자동화 정책 설정'
  if (route.path === '/admin/translations') return '다국어 번역 현황'
  if (route.path === '/admin/media') return '미디어 & 저작권'
  if (route.path === '/admin/categories') return '카테고리 관리'
  if (route.path === '/admin/locations') return '국가 · 도시 관리'
  if (route.path === '/admin/ads') return '광고 슬롯 관리'
  if (route.path === '/admin/affiliate') return '제휴 수익화 관리'
  if (route.path === '/admin/analytics') return '트래픽 & 봇 분석'
  if (route.path === '/admin/seo') return 'SEO & 사이트맵'
  if (route.path === '/admin/users') return '편집국 계정 및 권한'
  if (route.path === '/admin/logs') return '편집국 감사 로그'
  if (route.path === '/admin/settings') return '시스템 설정'
  if (route.path.startsWith('/admin/articles/')) return '기사 편집기'
  return '편집국 관리자'
})

async function logout() {
  logoutError.value = ''
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await router.replace('/admin/login')
  } catch {
    logoutError.value = '로그아웃하지 못했습니다. 다시 시도해 주세요.'
  }
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <NuxtLink class="wordmark admin-wordmark" to="/admin/dashboard">
        <span class="wordmark-mark">C.</span>
        <span>CHECK-IN <b>DAILY</b></span>
      </NuxtLink>

      <div class="admin-workspace">
        <span class="admin-workspace-icon">CD</span>
        <span><strong>체크인데일리</strong><small>글로벌 뉴스룸 CMS</small></span>
      </div>

      <nav class="admin-navigation" aria-label="관리자 메뉴">
        <div v-for="group in navGroups" :key="group.title" class="admin-nav-group">
          <p class="admin-nav-label">{{ group.title }}</p>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            :class="{ active: route.path === item.to || (item.to === '/admin/articles' && route.path.startsWith('/admin/articles/') && route.path !== '/admin/articles/new') }"
          >
            <span class="admin-nav-emoji">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>

      <div class="admin-sidebar-bottom">
        <span class="admin-online-dot" aria-hidden="true"></span>
        <span><strong>운영 중</strong><small>Cloudflare D1 & Workers</small></span>
      </div>
    </aside>

    <div class="admin-workarea">
      <header class="admin-toolbar">
        <div class="admin-breadcrumb"><span>편집국</span><span aria-hidden="true">/</span><strong>{{ pageLabel }}</strong></div>
        <div class="admin-toolbar-actions">
          <a class="admin-view-site" href="/news" target="_blank" rel="noreferrer">사이트 보기 <span aria-hidden="true">↗</span></a>
          <span class="admin-toolbar-divider" aria-hidden="true"></span>
          <span class="admin-avatar" aria-hidden="true">E</span>
          <span class="admin-account">편집자 (Editor)</span>
          <button class="admin-logout" type="button" @click="logout">로그아웃</button>
        </div>
      </header>
      <p v-if="logoutError" class="admin-global-error" role="alert">{{ logoutError }}</p>
      <main class="admin-main"><slot /></main>
    </div>
  </div>
</template>

<style scoped>
.admin-nav-group {
  margin-bottom: 18px;
}
.admin-nav-emoji {
  margin-right: 8px;
  font-size: 14px;
}
.admin-sidebar {
  overflow-y: auto;
  max-height: 100vh;
}
</style>
