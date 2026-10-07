<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const darkMode = useState('site-dark-mode', () => false)

onMounted(() => {
  darkMode.value = localStorage.getItem('checkin-theme') === 'dark'
  document.documentElement.dataset.theme = darkMode.value ? 'dark' : 'light'
})

watch(darkMode, (enabled) => {
  if (!import.meta.client) return
  document.documentElement.dataset.theme = enabled ? 'dark' : 'light'
  localStorage.setItem('checkin-theme', enabled ? 'dark' : 'light')
})

watch(() => route.query.q, (query) => {
  search.value = typeof query === 'string' ? query : ''
})

async function submitSearch() {
  const query = search.value.trim()
  await router.push(query ? { path: '/news', query: { q: query } } : '/news')
}
</script>

<template>
  <div class="site-shell">
    <header v-if="route.path !== '/admin/login'" class="site-header">
      <NuxtLink class="wordmark" to="/news" aria-label="체크인데일리 홈">
        <span class="wordmark-mark">C.</span>
        <span>CHECK-IN <b>DAILY</b></span>
      </NuxtLink>
      <nav class="main-nav" aria-label="주요 메뉴">
        <NuxtLink to="/news">뉴스 홈</NuxtLink>
        <NuxtLink to="/news/major">주요뉴스</NuxtLink>
        <NuxtLink to="/news/airline">항공</NuxtLink>
        <NuxtLink to="/news/hotel">호텔</NuxtLink>
        <NuxtLink to="/news/destination">여행지</NuxtLink>
        <NuxtLink to="/news/realtime">실시간</NuxtLink>
        <NuxtLink to="/saved">스크랩</NuxtLink>
        <NuxtLink to="/admin/news">에디터룸</NuxtLink>
      </nav>
      <form class="header-search" role="search" @submit.prevent="submitSearch">
        <input v-model="search" aria-label="뉴스 검색" placeholder="뉴스 검색">
        <button type="submit" aria-label="검색">⌕</button>
      </form>
      <button class="theme-toggle" type="button" :aria-pressed="darkMode" @click="darkMode = !darkMode">{{ darkMode ? '라이트' : '다크' }}</button>
    </header>
    <main><NuxtPage /></main>
    <footer v-if="route.path !== '/admin/login'" class="site-footer">
      <NuxtLink class="wordmark footer-mark" to="/news">CHECK-IN <b>DAILY</b></NuxtLink>
      <span>여행의 다음 장면을 먼저 읽습니다.</span>
      <span>© 2025 Check-in Daily</span>
    </footer>
  </div>
</template>