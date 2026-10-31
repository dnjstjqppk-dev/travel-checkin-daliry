<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const darkMode = useState('site-dark-mode', () => true)
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const isArticleRoute = computed(() => route.path.includes('/article/'))
const isMobileDrawerOpen = ref(false)
const isMobileSearchOpen = ref(false)
const { locale, t, locUrl, switchLocale, supportedLocales } = useI18n()
const isLangModalOpen = ref(false)

useHead(() => ({
  htmlAttrs: {
    lang: locale.value === 'zh' ? 'zh-Hans' : locale.value,
  },
  script: [
    {
      key: 'theme-fouc-guard',
      innerHTML: `(function(){try{var t=localStorage.getItem('checkin-theme');if(t==='light'){document.documentElement.dataset.theme='light';}else{document.documentElement.dataset.theme='dark';}}catch(e){}})();`,
    },
  ],
}))

const currentLocaleMeta = computed(() => {
  const found = supportedLocales.find((l) => l.code === locale.value)
  if (found) return found
  return supportedLocales[0] || { code: 'ko', name: '한국어', nativeName: '한국어', flag: '🇰🇷' }
})

function openLangModal() {
  isLangModalOpen.value = true
  isMobileDrawerOpen.value = false
}

function closeLangModal() {
  isLangModalOpen.value = false
}

async function handleSelectLocale(code: import('./composables/useI18n').Locale) {
  closeLangModal()
  await switchLocale(code)
}

function getSeoulDateTimeString() {
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
  return `${dateStr} | ${timeStr} KST`
}

const currentDateTime = useState('header-clock', getSeoulDateTimeString)

function updateClock() {
  currentDateTime.value = getSeoulDateTimeString()
}

onMounted(() => {
  updateClock()
  const interval = setInterval(updateClock, 1000)
  onUnmounted(() => clearInterval(interval))

  const savedTheme = localStorage.getItem('checkin-theme')
  darkMode.value = savedTheme !== 'light'
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

watch(() => route.fullPath, () => {
  isMobileDrawerOpen.value = false
  isMobileSearchOpen.value = false
})

function toggleMobileDrawer() {
  isMobileDrawerOpen.value = !isMobileDrawerOpen.value
  if (isMobileDrawerOpen.value) {
    isMobileSearchOpen.value = false
  }
}

function closeMobileDrawer() {
  isMobileDrawerOpen.value = false
}

function toggleMobileSearch() {
  isMobileSearchOpen.value = !isMobileSearchOpen.value
  if (isMobileSearchOpen.value) {
    isMobileDrawerOpen.value = false
  }
}

async function submitSearch() {
  const query = search.value.trim()
  isMobileSearchOpen.value = false
  const target = locUrl('/news')
  await router.push(query ? { path: target, query: { q: query } } : target)
}
</script>

<template>
  <div class="site-shell ttr-root">
    <!-- Tetherrock Style Top Navigation & Ticker Header -->
    <header v-if="!isAdminRoute" class="ttr-header-root">
      <!-- 1. Top Nav Bar (Height 58px) -->
      <div class="top-nav">
        <!-- Left: Hamburger (Mobile) + Brand -->
        <div class="top-nav-left">
          <button
            class="ttr-mobile-menu-btn"
            type="button"
            aria-label="메뉴 열기"
            @click="toggleMobileDrawer"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <NuxtLink :to="locUrl('/news')" class="ttr-brand" title="Check-in Daily">
            <div class="ttr-brand-mark">
              <span class="ttr-live-ping" />
              <span class="ttr-brand-icon">📡</span>
            </div>
            <div class="ttr-brand-text">
              <span class="ttr-brand-title">CHECK-IN <b>DAILY</b></span>
              <span class="ttr-brand-kicker">TRAVEL INTELLIGENCE</span>
            </div>
          </NuxtLink>
        </div>

        <!-- Center: Navigation Tabs (Tetherrock .nav-tabs) -->
        <nav class="nav-tabs" aria-label="메인 카테고리 네비게이션">
          <NuxtLink :to="locUrl('/news')" class="nav-tab" active-class="active" exact-active-class="active">
            {{ t('all_news') }}
          </NuxtLink>
          <NuxtLink :to="locUrl('/news/major')" class="nav-tab" active-class="active">
            {{ t('major') }}
          </NuxtLink>
          <NuxtLink :to="locUrl('/news/airline')" class="nav-tab" active-class="active">
            ✈️ {{ t('airline') }}
          </NuxtLink>
          <NuxtLink :to="locUrl('/news/hotel')" class="nav-tab" active-class="active">
            🏨 {{ t('hotel') }}
          </NuxtLink>
          <NuxtLink :to="locUrl('/news/destination')" class="nav-tab" active-class="active">
            🗺️ {{ t('destination') }}
          </NuxtLink>
          <NuxtLink :to="locUrl('/news/realtime')" class="nav-tab" active-class="active">
            🔥 {{ t('realtime') }}
          </NuxtLink>
          <NuxtLink :to="locUrl('/news/region')" class="nav-tab" active-class="active">
            🌏 {{ t('region') }}
          </NuxtLink>
          <NuxtLink :to="locUrl('/saved')" class="nav-tab" active-class="active">
            ★ {{ t('saved') }}
          </NuxtLink>
        </nav>

        <!-- Right: Search, Language, Theme, Desk Link -->
        <div class="top-nav-right">
          <!-- Desktop Search Input with Autocomplete -->
          <div class="ttr-header-search-wrap">
            <HeaderSearchBar />
          </div>

          <!-- Mobile Search Trigger -->
          <button
            class="ttr-mobile-search-toggle"
            type="button"
            aria-label="검색창 열기"
            @click="toggleMobileSearch"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          <!-- 6-Language Switcher Pill -->
          <button
            type="button"
            class="ttr-lang-pill"
            aria-label="언어 선택 / Select Language"
            @click="openLangModal"
          >
            <span class="flag">{{ currentLocaleMeta.flag }}</span>
            <span class="code">{{ currentLocaleMeta.code.toUpperCase() }}</span>
            <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>

          <!-- Dark/Light Theme Toggle -->
          <button
            type="button"
            class="ttr-theme-btn"
            :aria-pressed="darkMode"
            title="테마 모드 전환"
            @click="darkMode = !darkMode"
          >
            {{ darkMode ? '☀' : '◐' }}
          </button>

          <!-- Editorial Desk (Admin) Button -->
          <NuxtLink to="/admin/login" class="ttr-desk-btn" title="편집국 데스크">
            <span>DESK ↗</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Mobile Search Bar Dropdown -->
      <div v-if="isMobileSearchOpen" class="ttr-mobile-search-bar">
        <HeaderSearchBar :is-mobile="true" @submit="isMobileSearchOpen = false" @select="isMobileSearchOpen = false" />
      </div>

      <!-- 2. Real-time Travel Indices & Wire Ticker (Height 34px) -->
      <NewsTickerBar />
    </header>

    <!-- Mobile Slide Drawer Menu -->
    <Teleport to="body">
      <div
        v-if="isMobileDrawerOpen"
        class="ttr-drawer-backdrop"
        @click="closeMobileDrawer"
      />
      <aside
        class="ttr-mobile-drawer"
        :class="{ 'is-open': isMobileDrawerOpen }"
        :inert="!isMobileDrawerOpen"
        :aria-hidden="!isMobileDrawerOpen"
        aria-label="모바일 전체 메뉴"
      >
        <div class="ttr-drawer-header">
          <div class="ttr-drawer-brand">
            <span class="ttr-live-ping" />
            <span class="ttr-brand-title">CHECK-IN <b>DAILY</b></span>
          </div>
          <button class="ttr-drawer-close-btn" type="button" aria-label="메뉴 닫기" @click="closeMobileDrawer">
            ✕
          </button>
        </div>

        <div class="ttr-drawer-time">
          <span class="ttr-clock-icon">⏱</span>
          <span>{{ currentDateTime }}</span>
        </div>

        <!-- Mobile 6-Language Grid Selector -->
        <div class="ttr-drawer-lang-selector">
          <div class="ttr-drawer-lang-header">
            <span>🌐 SELECT LANGUAGE (언어 선택)</span>
          </div>
          <div class="ttr-drawer-lang-grid">
            <button
              v-for="item in supportedLocales"
              :key="item.code"
              type="button"
              class="ttr-dlang-card"
              :class="{ active: locale === item.code }"
              @click="() => { switchLocale(item.code); closeMobileDrawer(); }"
            >
              <span class="flag">{{ item.flag }}</span>
              <span class="native">{{ item.nativeName }}</span>
              <span class="code">{{ item.code.toUpperCase() }}</span>
            </button>
          </div>
        </div>

        <!-- Drawer Navigation Links -->
        <nav class="ttr-drawer-nav">
          <div class="ttr-drawer-sec-label">TERMINAL CHANNELS</div>
          <ul class="ttr-drawer-list">
            <li>
              <NuxtLink :to="locUrl('/news')" @click="closeMobileDrawer">
                <span class="icon">📰</span>
                <span>{{ t('all_news') }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/major')" @click="closeMobileDrawer">
                <span class="icon">⭐</span>
                <span>{{ t('major') }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/airline')" @click="closeMobileDrawer">
                <span class="icon">✈️</span>
                <span>{{ t('airline') }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/hotel')" @click="closeMobileDrawer">
                <span class="icon">🏨</span>
                <span>{{ t('hotel') }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/destination')" @click="closeMobileDrawer">
                <span class="icon">🗺️</span>
                <span>{{ t('destination') }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/realtime')" @click="closeMobileDrawer">
                <span class="icon">🔥</span>
                <span>{{ t('realtime') }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/region')" @click="closeMobileDrawer">
                <span class="icon">🌏</span>
                <span>{{ t('region') }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/saved')" @click="closeMobileDrawer">
                <span class="icon">★</span>
                <span>{{ t('saved') }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/login" @click="closeMobileDrawer">
                <span class="icon">⚙️</span>
                <span>EDITORIAL DESK (관리자)</span>
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <div class="ttr-drawer-footer">
          <button
            class="ttr-drawer-theme-toggle"
            type="button"
            @click="darkMode = !darkMode"
          >
            <span>{{ darkMode ? '☀ 밝은 화면 (LIGHT)' : '◐ 어두운 화면 (DARK)' }}</span>
          </button>
          <p class="ttr-drawer-copy">© 2026 Check-in Daily Media Group</p>
        </div>
      </aside>
    </Teleport>

    <!-- Global 6-Language Modal (Tetherrock Terminal Style) -->
    <Teleport to="body">
      <div
        v-if="isLangModalOpen"
        class="ttr-modal-backdrop"
        @click.self="closeLangModal"
      >
        <div class="ttr-lang-modal" role="dialog" aria-labelledby="lang-modal-title" aria-modal="true">
          <div class="ttr-lang-modal-head">
            <div class="ttr-lang-modal-title-wrap">
              <span class="ttr-lang-modal-icon">🌐</span>
              <div>
                <h3 id="lang-modal-title" class="ttr-lang-modal-title">Select Edition &amp; Language</h3>
                <p class="ttr-lang-modal-sub">다국어 글로벌 에디션을 선택하세요</p>
              </div>
            </div>
            <button class="ttr-lang-modal-close" type="button" aria-label="닫기" @click="closeLangModal">
              ✕
            </button>
          </div>

          <div class="ttr-lang-modal-grid">
            <button
              v-for="item in supportedLocales"
              :key="item.code"
              type="button"
              class="ttr-lang-option-card"
              :class="{ active: locale === item.code }"
              @click="handleSelectLocale(item.code)"
            >
              <div class="left">
                <span class="flag">{{ item.flag }}</span>
                <div class="text">
                  <span class="native">{{ item.nativeName }}</span>
                  <span class="en">{{ item.name }}</span>
                </div>
              </div>
              <div class="right">
                <span class="badge">{{ item.code.toUpperCase() }}</span>
                <span v-if="locale === item.code" class="check">✓</span>
              </div>
            </button>
          </div>

          <div class="ttr-lang-modal-foot">
            <p class="note">
              * 언어 전환 시 각 언어별 전용 URL(예: <code>/news</code>, <code>/en/news</code>, <code>/zh/news</code>, <code>/th/news</code>, <code>/vi/news</code>, <code>/es/news</code>)로 즉시 이동합니다.
            </p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Main Content Root -->
    <main v-if="!isAdminRoute" class="ttr-main-content">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </main>
    <div v-else class="admin-route-root">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </div>

    <!-- Mobile Bottom Navigation Bar (Fixed 5-Tab Bar) -->
    <nav
      v-if="!isAdminRoute && !isArticleRoute"
      class="ttr-mobile-bottom-nav"
      aria-label="모바일 하단 내비게이션"
    >
      <NuxtLink :to="locUrl('/news')" class="ttr-bnav-item" active-class="active" exact-active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>{{ t('home') }}</span>
      </NuxtLink>
      <NuxtLink :to="locUrl('/news/airline')" class="ttr-bnav-item" active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.2-2 1-.3.8-.1 1.7.5 2.2l4.8 3.6-2.5 2.5-2.2-.5c-.5-.1-1.1.1-1.4.5-.4.4-.4 1.1 0 1.5l2.2 2.2 2.2 2.2c.4.4 1.1.4 1.5 0 .4-.3.6-.9.5-1.4l-.5-2.2 2.5-2.5 3.6 4.8c.5.6 1.4.8 2.2.5.8-.4 1.2-1.2 1-2z"/></svg>
        <span>{{ t('airline') }}</span>
      </NuxtLink>
      <NuxtLink :to="locUrl('/news/hotel')" class="ttr-bnav-item" active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/></svg>
        <span>{{ t('hotel') }}</span>
      </NuxtLink>
      <NuxtLink :to="locUrl('/news/destination')" class="ttr-bnav-item" active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/></svg>
        <span>{{ t('destination') }}</span>
      </NuxtLink>
      <NuxtLink :to="locUrl('/saved')" class="ttr-bnav-item" active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>{{ t('saved') }}</span>
      </NuxtLink>
    </nav>

    <!-- Site Footer -->
    <SiteFooter v-if="!isAdminRoute" />
  </div>
</template>

<style>
/* ── Tetherrock Core Layout & CSS Variables ── */
.ttr-root {
  background: var(--bg-primary, #0d0e1a);
  color: var(--text-secondary, #d2d9e3);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.ttr-header-root {
  position: sticky;
  top: 0;
  z-index: 200;
  background: var(--bg-secondary, #13141f);
}

/* 1. Top Nav Bar (Height 58px) */
.top-nav {
  height: 58px;
  background: var(--bg-secondary, #13141f);
  border-bottom: 1px solid var(--border, #23253a);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  z-index: 100;
  gap: 16px;
}

.top-nav-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ttr-mobile-menu-btn {
  display: none;
  background: transparent;
  border: 1px solid var(--border, #23253a);
  border-radius: 6px;
  padding: 6px;
  color: var(--text-secondary, #d2d9e3);
  cursor: pointer;
}

.ttr-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  user-select: none;
}

.ttr-brand-mark {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ttr-live-ping {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent, #00d4aa);
  box-shadow: 0 0 8px var(--accent, #00d4aa);
  animation: blink 2s infinite;
}

.ttr-brand-icon {
  font-size: 20px;
}

.ttr-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.ttr-brand-title {
  color: var(--text-primary, #f0f4f8);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.ttr-brand-title b {
  color: var(--accent, #00d4aa);
}

.ttr-brand-kicker {
  font-size: 8.5px;
  color: var(--text-dim, #7d8696);
  font-weight: 700;
  letter-spacing: 1px;
}

/* Center Navigation Tabs (.nav-tabs / .nav-tab) */
.nav-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.nav-tabs::-webkit-scrollbar {
  display: none;
}

.nav-tab {
  padding: 7px 14px;
  color: var(--text-muted, #8e99aa);
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.nav-tab:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.nav-tab.active {
  color: var(--accent, #00d4aa);
  background: var(--accent-dim, rgba(0, 212, 170, 0.12));
  border: 1px solid rgba(0, 212, 170, 0.3);
  font-weight: 700;
}

/* Right Nav Controls */
.top-nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ttr-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 5px 12px;
  color: var(--text-muted, #8e99aa);
  transition: border-color 0.15s ease;
}

.ttr-search-box:focus-within {
  border-color: var(--accent, #00d4aa);
}

.ttr-search-box input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary, #f0f4f8);
  font-size: 12.5px;
  width: 140px;
}

.ttr-mobile-search-toggle {
  display: none;
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 6px;
  padding: 6px;
  color: var(--text-muted, #8e99aa);
  cursor: pointer;
}

.ttr-lang-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--text-primary, #f0f4f8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ttr-lang-pill:hover {
  border-color: var(--accent, #00d4aa);
}

.ttr-lang-pill .flag {
  font-size: 13px;
}

.ttr-lang-pill .code {
  letter-spacing: 0.5px;
}

.ttr-theme-btn {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  color: var(--text-primary, #f0f4f8);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s ease;
}

.ttr-theme-btn:hover {
  border-color: var(--accent, #00d4aa);
}

.ttr-desk-btn {
  background: rgba(0, 212, 170, 0.12);
  border: 1px solid rgba(0, 212, 170, 0.35);
  border-radius: 8px;
  padding: 6px 12px;
  color: var(--accent, #00d4aa);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  letter-spacing: 0.5px;
  transition: all 0.15s ease;
}

.ttr-desk-btn:hover {
  background: var(--accent, #00d4aa);
  color: #0d0e1a;
}

/* Mobile Search Bar Dropdown */
.ttr-mobile-search-bar {
  background: var(--bg-secondary, #13141f);
  border-bottom: 1px solid var(--border, #23253a);
  padding: 8px 16px;
}

.ttr-mobile-search-form {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 6px 12px;
  color: var(--text-muted, #8e99aa);
}

.ttr-mobile-search-form input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary, #f0f4f8);
  font-size: 13px;
  flex: 1;
}

.ttr-mobile-search-submit {
  background: var(--accent, #00d4aa);
  color: #0d0e1a;
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

/* Main Content Container */
.ttr-main-content {
  flex: 1;
  width: 100%;
  max-width: 1360px;
  margin: 0 auto;
  padding: 20px 20px 60px;
  box-sizing: border-box;
}

/* Mobile Slide Drawer */
.ttr-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 998;
}

.ttr-mobile-drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(85vw, 340px);
  background: var(--bg-secondary, #13141f);
  border-right: 1px solid var(--border, #23253a);
  z-index: 999;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 10px 0 30px rgba(0, 0, 0, 0.5);
  overflow-y: auto;
}

.ttr-mobile-drawer.is-open {
  transform: translateX(0);
}

.ttr-drawer-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border, #23253a);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ttr-drawer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ttr-drawer-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted, #8e99aa);
  font-size: 18px;
  cursor: pointer;
}

.ttr-drawer-time {
  padding: 10px 20px;
  background: var(--bg-card, #181927);
  border-bottom: 1px solid var(--border, #23253a);
  font-size: 11px;
  color: var(--text-muted, #8e99aa);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ttr-drawer-lang-selector {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border, #23253a);
}

.ttr-drawer-lang-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted, #8e99aa);
  margin-bottom: 10px;
}

.ttr-drawer-lang-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.ttr-dlang-card {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary, #d2d9e3);
  font-size: 11.5px;
  cursor: pointer;
  text-align: left;
}

.ttr-dlang-card.active {
  border-color: var(--accent, #00d4aa);
  color: var(--accent, #00d4aa);
  background: var(--accent-dim, rgba(0, 212, 170, 0.12));
  font-weight: 700;
}

.ttr-dlang-card .code {
  margin-left: auto;
  font-size: 10px;
  opacity: 0.7;
}

.ttr-drawer-nav {
  padding: 16px 20px;
  flex: 1;
}

.ttr-drawer-sec-label {
  font-size: 10.5px;
  font-weight: 800;
  color: var(--text-dim, #7d8696);
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.ttr-drawer-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ttr-drawer-list a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  color: var(--text-secondary, #d2d9e3);
  font-size: 13.5px;
  border-radius: 6px;
  text-decoration: none;
}

.ttr-drawer-list a:hover,
.ttr-drawer-list a.router-link-active {
  background: rgba(255, 255, 255, 0.05);
  color: var(--accent, #00d4aa);
}

.ttr-drawer-footer {
  padding: 20px;
  border-top: 1px solid var(--border, #23253a);
}

.ttr-drawer-theme-toggle {
  width: 100%;
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 6px;
  padding: 10px;
  color: var(--text-primary, #f0f4f8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 10px;
}

.ttr-drawer-copy {
  margin: 0;
  font-size: 10.5px;
  color: var(--text-dim, #7d8696);
  text-align: center;
}

/* Global 6-Language Modal */
.ttr-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.ttr-lang-modal {
  width: 100%;
  max-width: 500px;
  background: var(--bg-secondary, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

.ttr-lang-modal-head {
  padding: 18px 22px;
  border-bottom: 1px solid var(--border, #23253a);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ttr-lang-modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ttr-lang-modal-icon {
  font-size: 24px;
}

.ttr-lang-modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #f0f4f8);
}

.ttr-lang-modal-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted, #8e99aa);
}

.ttr-lang-modal-close {
  background: transparent;
  border: none;
  color: var(--text-muted, #8e99aa);
  font-size: 18px;
  cursor: pointer;
}

.ttr-lang-modal-grid {
  padding: 18px 22px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.ttr-lang-option-card {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.ttr-lang-option-card:hover {
  border-color: var(--accent, #00d4aa);
  transform: translateY(-1px);
}

.ttr-lang-option-card.active {
  border-color: var(--accent, #00d4aa);
  background: var(--accent-dim, rgba(0, 212, 170, 0.12));
}

.ttr-lang-option-card .left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ttr-lang-option-card .flag {
  font-size: 20px;
}

.ttr-lang-option-card .text {
  display: flex;
  flex-direction: column;
}

.ttr-lang-option-card .native {
  color: var(--text-primary, #f0f4f8);
  font-size: 13.5px;
  font-weight: 600;
}

.ttr-lang-option-card .en {
  color: var(--text-muted, #8e99aa);
  font-size: 11px;
}

.ttr-lang-option-card .right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ttr-lang-option-card .badge {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--text-muted, #8e99aa);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 5px;
  border-radius: 4px;
}

.ttr-lang-option-card.active .badge {
  color: var(--accent, #00d4aa);
  background: rgba(0, 212, 170, 0.2);
}

.ttr-lang-option-card .check {
  color: var(--accent, #00d4aa);
  font-weight: 900;
  font-size: 14px;
}

.ttr-lang-modal-foot {
  padding: 12px 22px;
  background: var(--bg-card, #181927);
  border-top: 1px solid var(--border, #23253a);
}

.ttr-lang-modal-foot .note {
  margin: 0;
  font-size: 11px;
  color: var(--text-dim, #7d8696);
  line-height: 1.4;
}

.ttr-lang-modal-foot code {
  color: var(--accent, #00d4aa);
  background: rgba(0, 212, 170, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
}

/* Mobile Bottom Navigation Bar */
.ttr-mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--bg-secondary, #13141f);
  border-top: 1px solid var(--border, #23253a);
  z-index: 150;
  align-items: center;
  justify-content: space-around;
  padding: 0 4px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.ttr-bnav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--text-muted, #8e99aa);
  text-decoration: none;
  font-size: 10.5px;
  font-weight: 500;
}

.ttr-bnav-item:hover,
.ttr-bnav-item.active {
  color: var(--accent, #00d4aa);
}

/* Responsive Breakpoints */
@media (max-width: 1024px) {
  .nav-tabs {
    display: none;
  }
  .ttr-mobile-menu-btn {
    display: flex;
  }
  .ttr-search-box {
    display: none;
  }
  .ttr-mobile-search-toggle {
    display: flex;
  }
  .ttr-mobile-bottom-nav {
    display: flex;
  }
  .ttr-main-content {
    padding-bottom: 80px;
  }
}

@media (max-width: 640px) {
  .top-nav {
    padding: 0 14px;
  }
  .ttr-brand-kicker {
    display: none;
  }
  .ttr-lang-modal-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .ttr-desk-btn { display: none; }
  .top-nav-right { gap: 4px; }
}

.ttr-header-search-wrap {
  width: 200px;
  max-width: 240px;
}
</style>
