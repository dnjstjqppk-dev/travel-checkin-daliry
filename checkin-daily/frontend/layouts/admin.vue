<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const logoutError = ref('')

const navigation = [
  { label: '콘텐츠', to: '/admin/dashboard', icon: '01' },
  { label: '카테고리', to: '/admin/categories', icon: '02' },
  { label: '국가 · 도시', to: '/admin/locations', icon: '03' },
  { label: '광고 슬롯', to: '/admin/ads', icon: '04' },
]

const pageLabel = computed(() => {
  if (route.path === '/admin/dashboard' || route.path === '/admin/news') return '콘텐츠 관리'
  if (route.path === '/admin/categories') return '카테고리 관리'
  if (route.path === '/admin/locations') return '국가 · 도시 관리'
  if (route.path === '/admin/ads') return '광고 슬롯 관리'
  if (route.path === '/admin/articles/new') return '새 기사 작성'
  if (route.path.startsWith('/admin/articles/')) return '기사 수정'
  return '뉴스룸'
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
        <span><strong>체크인데일리</strong><small>뉴스룸 워크스페이스</small></span>
        <span class="admin-workspace-chevron">⌄</span>
      </div>

      <p class="admin-nav-label">WORKSPACE</p>
      <nav class="admin-navigation" aria-label="관리자 메뉴">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :class="{ active: route.path === item.to || (item.to === '/admin/dashboard' && route.path.startsWith('/admin/articles/')) }"
        >
          <span class="admin-nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span v-if="item.to === '/admin/dashboard'" class="admin-nav-arrow">›</span>
        </NuxtLink>
      </nav>

      <div class="admin-sidebar-bottom">
        <span class="admin-online-dot" aria-hidden="true"></span>
        <span><strong>운영 중</strong><small>Cloudflare Workers</small></span>
      </div>
    </aside>

    <div class="admin-workarea">
      <header class="admin-toolbar">
        <div class="admin-breadcrumb"><span>뉴스룸</span><span aria-hidden="true">/</span><strong>{{ pageLabel }}</strong></div>
        <div class="admin-toolbar-actions">
          <a class="admin-view-site" href="/news" target="_blank" rel="noreferrer">사이트 보기 <span aria-hidden="true">↗</span></a>
          <span class="admin-toolbar-divider" aria-hidden="true"></span>
          <span class="admin-avatar" aria-hidden="true">A</span>
          <span class="admin-account">관리자</span>
          <button class="admin-logout" type="button" @click="logout">로그아웃</button>
        </div>
      </header>
      <p v-if="logoutError" class="admin-global-error" role="alert">{{ logoutError }}</p>
      <main class="admin-main"><slot /></main>
    </div>
  </div>
</template>
