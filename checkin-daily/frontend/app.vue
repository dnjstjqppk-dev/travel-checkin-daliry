<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const darkMode = useState('site-dark-mode', () => false)
const currentDesign = useState<string>('current-design-concept', () => '1')
const isAdminRoute = computed(() => route.path.startsWith('/admin'))

onMounted(() => {
  darkMode.value = localStorage.getItem('checkin-theme') === 'dark'
  document.documentElement.dataset.theme = darkMode.value ? 'dark' : 'light'

  const queryDesign = typeof route.query.design === 'string' ? route.query.design : ''
  if (['1', '2', '3'].includes(queryDesign)) {
    currentDesign.value = queryDesign
  } else {
    const savedDesign = localStorage.getItem('checkin-design-concept')
    if (savedDesign && ['1', '2', '3'].includes(savedDesign)) {
      currentDesign.value = savedDesign
    }
  }
  document.documentElement.dataset.design = currentDesign.value
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
  <div class="site-shell" :class="`theme-design-${currentDesign}`">
    <!-- 전역 디자인 시안 실시간 전환기 -->
    <DesignSwitcher v-if="!isAdminRoute" />

    <!-- 안 1 (모던 인텔리전스) 전용 실시간 속보 & 환율 티커 -->
    <NewsTickerBar v-if="!isAdminRoute && currentDesign === '1'" :articles="[]" />

    <!-- 공개 사이트 헤더 -->
    <header v-if="!isAdminRoute" class="site-header" :class="`header-design-${currentDesign}`">
      <!-- 안 2 (에디토리얼 매거진) 전용 클래식 마스트헤드 상단 바 -->
      <div v-if="currentDesign === '2'" class="magazine-top-meta page-wrap">
        <span>VOL. 24 · ISSUE AUTUMN 2026</span>
        <span>SEOUL · TOKYO · PARIS · NEW YORK</span>
        <button class="theme-toggle" type="button" :aria-pressed="darkMode" :aria-label="darkMode ? '라이트 모드' : '다크 모드'" @click="darkMode = !darkMode">
          {{ darkMode ? '☀ LIGHT' : '◐ DARK' }}
        </button>
      </div>

      <div class="header-main-row page-wrap">
        <NuxtLink class="wordmark" to="/news" aria-label="체크인데일리 홈">
          <span class="wordmark-mark">C.</span>
          <span class="wordmark-title">CHECK-IN <b>DAILY</b></span>
        </NuxtLink>

        <span v-if="currentDesign === '1'" class="edition masthead-edition">INTELLIGENCE DESK</span>
        <span v-else-if="currentDesign === '2'" class="edition masthead-edition">INDEPENDENT JOURNALISM</span>

        <nav class="main-nav" aria-label="주요 메뉴">
          <NuxtLink to="/news">뉴스 홈</NuxtLink>
          <NuxtLink to="/news/major">주요뉴스</NuxtLink>
          <NuxtLink to="/news/airline">항공</NuxtLink>
          <NuxtLink to="/news/hotel">호텔</NuxtLink>
          <NuxtLink to="/news/destination">여행지</NuxtLink>
          <NuxtLink to="/news/realtime">인기 순위</NuxtLink>
          <NuxtLink to="/saved">스크랩</NuxtLink>
        </nav>

        <div class="header-actions">
          <form class="header-search" role="search" @submit.prevent="submitSearch">
            <input v-model="search" aria-label="뉴스 검색" placeholder="기사, 항공, 호텔 검색">
            <button type="submit" aria-label="검색">⌕</button>
          </form>
          <button v-if="currentDesign !== '2'" class="theme-toggle" type="button" :aria-pressed="darkMode" :aria-label="darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'" @click="darkMode = !darkMode">
            {{ darkMode ? '☀' : '◐' }}
          </button>
        </div>
      </div>
    </header>

    <main v-if="!isAdminRoute"><NuxtLayout><NuxtPage /></NuxtLayout></main>
    <div v-else class="admin-route-root"><NuxtLayout><NuxtPage /></NuxtLayout></div>

    <footer v-if="!isAdminRoute" class="public-footer">
      <div class="public-footer-main page-wrap">
        <div class="public-footer-brand">
          <NuxtLink class="wordmark footer-mark" to="/news"><span class="wordmark-mark">C.</span><span>CHECK-IN <b>DAILY</b></span></NuxtLink>
          <p>여행 업계의 변화를 읽고,<br>더 나은 다음 여정을 준비합니다.</p>
          <span class="footer-editorial-note">독립적인 여행 전문 뉴스룸</span>
        </div>
        <div class="public-footer-links">
          <div><strong>뉴스룸</strong><NuxtLink to="/news/major">주요 뉴스</NuxtLink><NuxtLink to="/news/airline">항공</NuxtLink><NuxtLink to="/news/hotel">호텔</NuxtLink></div>
          <div><strong>여행 인사이트</strong><NuxtLink to="/news/destination">여행지</NuxtLink><NuxtLink to="/news/realtime">많이 읽는 뉴스</NuxtLink><NuxtLink to="/news/region">국가별 뉴스</NuxtLink></div>
          <div><strong>나의 뉴스룸</strong><NuxtLink to="/saved">스크랩한 기사</NuxtLink><NuxtLink to="/admin/login">에디터 로그인</NuxtLink><NuxtLink to="/news">최신 기사</NuxtLink></div>
        </div>
      </div>
      <div class="public-footer-bottom">
        <div class="page-wrap">
          <span>© 2026 CHECK-IN DAILY. 여행의 다음 장면을 먼저 읽습니다.</span>
          <span>환율은 공개 환율 API 기준 참고 정보이며 실제 결제 환율과 다를 수 있습니다.</span>
        </div>
      </div>
    </footer>
  </div>
</template>