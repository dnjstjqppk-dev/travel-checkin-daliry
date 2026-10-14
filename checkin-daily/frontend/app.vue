<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const darkMode = useState('site-dark-mode', () => false)
const isAdminRoute = computed(() => route.path.startsWith('/admin'))

// 실시간 날짜 문자열
const todayString = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(new Date())
})

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
  <div class="site-shell bkp-shell">
    <!-- 방콕포스트 스타일 탑 유틸리티 바 -->
    <div v-if="!isAdminRoute" class="bkp-top-bar">
      <div class="page-wrap bkp-top-inner">
        <div class="bkp-date-box">
          <span class="bkp-live-dot" />
          <span class="bkp-date-text">{{ todayString }} | SEOUL · BANGKOK · TOKYO</span>
        </div>
        <div class="bkp-top-right">
          <span class="bkp-edition-tag">THE WINDOW ON GLOBAL TRAVEL</span>
          <button
            class="bkp-theme-btn"
            type="button"
            :aria-pressed="darkMode"
            @click="darkMode = !darkMode"
          >
            {{ darkMode ? '☀ LIGHT MODE' : '◐ DARK MODE' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 방콕포스트 스타일 메인 마스트헤드 (로고 + 검색) -->
    <header v-if="!isAdminRoute" class="bkp-masthead">
      <div class="page-wrap bkp-masthead-inner">
        <div class="bkp-logo-area">
          <NuxtLink to="/news" class="bkp-logo-link" aria-label="체크인데일리 홈">
            <div class="bkp-logo-mark">C.</div>
            <div class="bkp-logo-text">
              <span class="bkp-logo-title">CHECK-IN <b>DAILY</b></span>
              <span class="bkp-logo-sub">THE INDEPENDENT TRAVEL JOURNALISM & INDUSTRY INTELLIGENCE</span>
            </div>
          </NuxtLink>
        </div>

        <div class="bkp-header-tools">
          <form class="bkp-search-form" role="search" @submit.prevent="submitSearch">
            <input v-model="search" aria-label="뉴스 검색" placeholder="Search news, airlines, hotels...">
            <button type="submit" aria-label="검색">
              <span>SEARCH</span>
            </button>
          </form>
          <NuxtLink to="/saved" class="bkp-saved-btn" aria-label="스크랩한 기사">
            <span class="bkp-saved-icon">★</span>
            <span>SCRAPBOOK</span>
          </NuxtLink>
        </div>
      </div>

      <!-- 방콕포스트 시그니처 딥 네이비(#060D81) 메인 네비게이션 바 -->
      <nav class="bkp-nav-bar" aria-label="메인 카테고리 메뉴">
        <div class="page-wrap bkp-nav-inner">
          <ul class="bkp-nav-list">
            <li><NuxtLink to="/news" active-class="active">ALL NEWS</NuxtLink></li>
            <li><NuxtLink to="/news/major" active-class="active">MAJOR HEADLINES</NuxtLink></li>
            <li><NuxtLink to="/news/airline" active-class="active">AIRLINES & MILES</NuxtLink></li>
            <li><NuxtLink to="/news/hotel" active-class="active">HOTELS & STAY</NuxtLink></li>
            <li><NuxtLink to="/news/destination" active-class="active">DESTINATIONS</NuxtLink></li>
            <li><NuxtLink to="/news/realtime" active-class="active">TOP 10 STORIES</NuxtLink></li>
            <li><NuxtLink to="/news/region" active-class="active">BY COUNTRY</NuxtLink></li>
          </ul>
        </div>
      </nav>
    </header>

    <!-- 메인 컨텐츠 영역 -->
    <main v-if="!isAdminRoute">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </main>
    <div v-else class="admin-route-root">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </div>

    <!-- 방콕포스트 스타일 정통 일간지 푸터 -->
    <footer v-if="!isAdminRoute" class="bkp-footer">
      <div class="bkp-footer-top">
        <div class="page-wrap bkp-footer-grid">
          <div class="bkp-footer-col brand-col">
            <NuxtLink to="/news" class="bkp-footer-logo">
              <span class="bkp-logo-mark small">C.</span>
              <span class="bkp-logo-title">CHECK-IN <b>DAILY</b></span>
            </NuxtLink>
            <p class="bkp-footer-desc">
              여행 산업의 지각 변동과 최신 트렌드를 가장 빠르고 깊이 있게 전하는 글로벌 여행 전문 저널입니다.
            </p>
            <div class="bkp-social-icons">
              <span>NEWSROOM DESK</span>
              <span>·</span>
              <span>EST. 2026</span>
            </div>
          </div>

          <div class="bkp-footer-col">
            <h4>SECTIONS</h4>
            <ul>
              <li><NuxtLink to="/news/major">주요 뉴스 (Major)</NuxtLink></li>
              <li><NuxtLink to="/news/airline">항공 & 마일리지 (Aviation)</NuxtLink></li>
              <li><NuxtLink to="/news/hotel">호텔 & 스테이 (Hospitality)</NuxtLink></li>
              <li><NuxtLink to="/news/destination">여행지 탐색 (Destinations)</NuxtLink></li>
            </ul>
          </div>

          <div class="bkp-footer-col">
            <h4>INTELLIGENCE</h4>
            <ul>
              <li><NuxtLink to="/news/realtime">실시간 랭킹 (Top Stories)</NuxtLink></li>
              <li><NuxtLink to="/news/region">국가별 뉴스룸</NuxtLink></li>
              <li><NuxtLink to="/saved">나의 스크랩북</NuxtLink></li>
              <li><NuxtLink to="/admin/login">기자/편집국 로그인</NuxtLink></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="bkp-footer-bottom">
        <div class="page-wrap bkp-footer-legal">
          <span>© 2026 CHECK-IN DAILY MEDIA GROUP. ALL RIGHTS RESERVED.</span>
          <span>REFERENCE BENCHMARK: BANGKOK POST STYLE ARCHITECTURE</span>
        </div>
      </div>
    </footer>
  </div>
</template>