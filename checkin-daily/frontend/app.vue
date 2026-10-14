<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const darkMode = useState('site-dark-mode', () => false)
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const isSearchOpen = ref(false)

// 방콕포스트 스타일 실시간 날짜 & 시간
const currentDateTime = ref('')

function updateClock() {
  const now = new Date()
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(now)
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(now)
  currentDateTime.value = `${dateStr} | ${timeStr} KST`
}

onMounted(() => {
  updateClock()
  const interval = setInterval(updateClock, 1000)
  onUnmounted(() => clearInterval(interval))

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
  <div class="site-shell bkp-theme-root">
    <!-- 방콕포스트 공식 최상단 유틸리티 바 (divnav-top) -->
    <header v-if="!isAdminRoute" class="bkp-header-wrapper">
      <div class="bkp-utility-bar">
        <div class="bkp-page-container bkp-utility-inner">
          <div class="bkp-datetime-label">
            <span class="bkp-red-bullet" />
            <span>{{ currentDateTime || '14 Oct 2026 | SEOUL' }}</span>
          </div>
          <div class="bkp-utility-links">
            <span class="bkp-tagline-text">THE WORLD’S WINDOW ON TRAVEL JOURNALISM</span>
            <span class="bkp-pipe">|</span>
            <button
              class="bkp-mode-toggle"
              type="button"
              :aria-pressed="darkMode"
              @click="darkMode = !darkMode"
            >
              {{ darkMode ? '☀ LIGHT' : '◐ DARK' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 방콕포스트 메인 마스트헤드 (로고 + 검색창 + 스크랩북) -->
      <div class="bkp-masthead-bar">
        <div class="bkp-page-container bkp-masthead-inner">
          <div class="bkp-logo-unit">
            <NuxtLink to="/news" class="bkp-main-brand" title="Check-in Daily">
              <span class="bkp-brand-mark">C.</span>
              <div class="bkp-brand-headings">
                <span class="bkp-brand-name">CHECK-IN <b>DAILY</b></span>
                <span class="bkp-brand-motto">THE WORLD'S WINDOW ON TRAVEL & HOSPITALITY</span>
              </div>
            </NuxtLink>
          </div>

          <div class="bkp-masthead-tools">
            <form class="bkp-search-box" role="search" @submit.prevent="submitSearch">
              <input v-model="search" placeholder="Search news, airlines, hotels..." aria-label="뉴스 검색">
              <button type="submit" aria-label="검색">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span>SEARCH</span>
              </button>
            </form>
            <NuxtLink to="/saved" class="bkp-btn-subscribe" title="스크랩한 뉴스">
              <span>★ SCRAPBOOK</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- 방콕포스트 시그니처 딥 네이비(#060D81) 메인 메뉴 바 (divnav-menu) -->
      <nav class="bkp-nav-wrapper" aria-label="메인 카테고리 네비게이션">
        <div class="bkp-page-container bkp-nav-container">
          <ul class="bkp-menu-list">
            <li><NuxtLink to="/news" active-class="active">ALL NEWS</NuxtLink></li>
            <li><NuxtLink to="/news/major" active-class="active">MAJOR</NuxtLink></li>
            <li><NuxtLink to="/news/airline" active-class="active">AIRLINES & MILES</NuxtLink></li>
            <li><NuxtLink to="/news/hotel" active-class="active">HOTELS & STAY</NuxtLink></li>
            <li><NuxtLink to="/news/destination" active-class="active">DESTINATIONS</NuxtLink></li>
            <li><NuxtLink to="/news/realtime" active-class="active">TOP STORIES</NuxtLink></li>
            <li><NuxtLink to="/news/region" active-class="active">BY REGION</NuxtLink></li>
            <li><NuxtLink to="/saved" active-class="active">SAVED</NuxtLink></li>
          </ul>
        </div>
      </nav>
    </header>

    <!-- 메인 컨텐츠 영역 -->
    <main v-if="!isAdminRoute" class="bkp-main-content">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </main>
    <div v-else class="admin-route-root">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </div>

    <!-- 방콕포스트 공식 3단 푸터 (divfooter) -->
    <footer v-if="!isAdminRoute" class="bkp-site-footer">
      <div class="bkp-footer-main">
        <div class="bkp-page-container bkp-footer-grid">
          <div class="bkp-fcol brand-col">
            <NuxtLink to="/news" class="bkp-footer-logo">
              <span class="bkp-brand-mark small">C.</span>
              <span class="bkp-brand-name white">CHECK-IN <b>DAILY</b></span>
            </NuxtLink>
            <p class="bkp-footer-summary">
              체크인데일리는 글로벌 항공, 호텔, 여행지 트렌드를 심층 취재하고 데이터 기반으로 보도하는 독립 여행 저널리즘 미디어입니다.
            </p>
            <div class="bkp-footer-meta-tags">
              <span>EDITORIAL OFFICE: SEOUL & BANGKOK</span>
              <span>·</span>
              <span>EST. 2026</span>
            </div>
          </div>

          <div class="bkp-fcol">
            <h4>SECTIONS</h4>
            <ul>
              <li><NuxtLink to="/news">전체 뉴스 (All News)</NuxtLink></li>
              <li><NuxtLink to="/news/major">주요 뉴스 (Major)</NuxtLink></li>
              <li><NuxtLink to="/news/airline">항공 & 마일리지 (Airlines)</NuxtLink></li>
              <li><NuxtLink to="/news/hotel">호텔 & 스테이 (Hotels)</NuxtLink></li>
              <li><NuxtLink to="/news/destination">여행지 탐색 (Destinations)</NuxtLink></li>
            </ul>
          </div>

          <div class="bkp-fcol">
            <h4>SERVICES</h4>
            <ul>
              <li><NuxtLink to="/news/realtime">실시간 랭킹 (Top Stories)</NuxtLink></li>
              <li><NuxtLink to="/news/region">국가/도시별 뉴스</NuxtLink></li>
              <li><NuxtLink to="/saved">나의 스크랩북 (Saved)</NuxtLink></li>
              <li><NuxtLink to="/admin/login">편집국 관리자 로그인</NuxtLink></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="bkp-footer-bottom">
        <div class="bkp-page-container bkp-footer-legal-row">
          <span>© 2026 CHECK-IN DAILY MEDIA GROUP. BANGKOK POST STYLE ARCHITECTURE.</span>
          <span>모든 기사 및 콘텐츠는 저작권법의 보호를 받습니다. 무단 전재 및 배포를 금합니다.</span>
        </div>
      </div>
    </footer>
  </div>
</template>