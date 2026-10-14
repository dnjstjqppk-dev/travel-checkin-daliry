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

<style>
.bkp-theme-root {
  background: #FFFFFF !important;
  color: #111827;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  min-height: 100vh;
}

.bkp-page-container {
  width: 100%;
  max-width: 1240px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 16px;
  padding-right: 16px;
  box-sizing: border-box;
}

/* 1. 최상단 실시간 유틸리티 바 */
.bkp-utility-bar {
  background: #F3F4F6;
  border-bottom: 1px solid #E5E7EB;
  height: 38px;
  display: flex;
  align-items: center;
  font-size: 11px;
}

.bkp-utility-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.bkp-datetime-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4B5563;
  font-family: 'DM Mono', monospace;
  font-weight: 600;
  font-size: 11px;
}

.bkp-red-bullet {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #D0021B;
  box-shadow: 0 0 6px #D0021B;
  display: inline-block;
}

.bkp-utility-links {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bkp-tagline-text {
  color: #6B7280;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.5px;
  font-size: 10.5px;
  font-weight: 500;
}

.bkp-pipe {
  color: #D1D5DB;
}

.bkp-mode-toggle {
  background: transparent;
  border: 1px solid #D1D5DB;
  padding: 3px 8px;
  font-size: 10px;
  cursor: pointer;
  border-radius: 3px;
  color: #374151;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
}

.bkp-mode-toggle:hover {
  background: #E5E7EB;
}

/* 2. 메인 마스트헤드 */
.bkp-masthead-bar {
  background: #FFFFFF;
  border-bottom: 1px solid #E5E7EB;
  padding: 22px 0;
  width: 100%;
}

.bkp-masthead-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.bkp-logo-unit {
  display: flex;
  align-items: center;
}

.bkp-main-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  text-decoration: none;
  color: inherit;
}

.bkp-brand-mark {
  width: 48px;
  height: 48px;
  background: #060D81;
  color: #FFFFFF;
  font-size: 28px;
  font-weight: 900;
  display: grid;
  place-items: center;
  border-radius: 4px;
  font-family: Georgia, 'Times New Roman', Times, serif;
  line-height: 1;
}

.bkp-brand-mark.small {
  width: 32px;
  height: 32px;
  font-size: 18px;
}

.bkp-brand-headings {
  display: flex;
  flex-direction: column;
}

.bkp-brand-name {
  font-size: clamp(24px, 3.2vw, 34px);
  font-weight: 900;
  letter-spacing: -0.5px;
  color: #060D81;
  line-height: 1;
  font-family: Georgia, 'Times New Roman', Times, serif;
}

.bkp-brand-name b {
  color: #D0021B;
}

.bkp-brand-name.white {
  color: #FFFFFF;
}

.bkp-brand-motto {
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  letter-spacing: 1.5px;
  color: #6B7280;
  margin-top: 5px;
  font-weight: 600;
}

.bkp-masthead-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bkp-search-box {
  display: flex;
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  overflow: hidden;
  background: #FFFFFF;
}

.bkp-search-box input {
  padding: 9px 14px;
  font-size: 13px;
  border: 0;
  outline: 0;
  width: 230px;
  color: #111827;
}

.bkp-search-box button {
  background: #060D81;
  color: #FFFFFF;
  border: 0;
  padding: 0 16px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bkp-search-box button:hover {
  background: #040854;
}

.bkp-btn-subscribe {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  color: #D0021B;
  padding: 9px 14px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
  font-family: 'DM Mono', monospace;
}

.bkp-btn-subscribe:hover {
  background: #FEE2E2;
}

/* 3. 방콕포스트 시그니처 딥 네이비(#060D81) 메인 GNB 메뉴 바 */
.bkp-nav-wrapper {
  background: #060D81;
  box-shadow: 0 2px 8px rgba(6, 13, 129, 0.22);
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
}

.bkp-nav-container {
  padding-left: 16px;
  padding-right: 16px;
}

.bkp-menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  overflow-x: auto;
  scrollbar-width: none;
}

.bkp-menu-list::-webkit-scrollbar {
  display: none;
}

.bkp-menu-list li {
  margin: 0;
  padding: 0;
  white-space: nowrap;
}

.bkp-menu-list a {
  display: block;
  color: #FFFFFF;
  padding: 13px 18px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-decoration: none;
  border-bottom: 4px solid transparent;
  transition: all 0.2s ease;
}

.bkp-menu-list a:hover,
.bkp-menu-list a.active,
.bkp-menu-list a.router-link-active {
  background: rgba(255, 255, 255, 0.12);
  border-bottom-color: #D0021B;
  color: #FFFFFF;
}

/* 4. 메인 컨텐츠 영역 */
.bkp-main-content {
  min-height: 80vh;
  background: #FFFFFF;
}

/* 5. 정통 일간지 다크 푸터 */
.bkp-site-footer {
  background: #0B1120;
  color: #94A3B8;
  border-top: 4px solid #060D81;
  margin-top: 60px;
  width: 100%;
}

.bkp-footer-main {
  padding: 48px 0 36px;
}

.bkp-footer-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 40px;
}

.bkp-fcol {
  min-width: 0;
}

.bkp-footer-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  margin-bottom: 14px;
}

.bkp-footer-summary {
  font-size: 13px;
  line-height: 1.7;
  color: #94A3B8;
  margin: 12px 0;
  max-width: 440px;
}

.bkp-footer-meta-tags {
  display: flex;
  gap: 8px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: #64748B;
}

.bkp-fcol h4 {
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 1px;
  margin: 0 0 16px;
  border-left: 3px solid #D0021B;
  padding-left: 8px;
}

.bkp-fcol ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bkp-fcol a {
  color: #94A3B8;
  font-size: 13px;
  text-decoration: none;
  transition: color 0.2s;
}

.bkp-fcol a:hover {
  color: #FFFFFF;
}

.bkp-footer-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px 0;
  font-size: 11px;
  color: #64748B;
  font-family: 'DM Mono', monospace;
}

.bkp-footer-legal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 900px) {
  .bkp-footer-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .bkp-masthead-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  .bkp-search-box input {
    width: 160px;
  }
  .bkp-tagline-text {
    display: none;
  }
}
</style>