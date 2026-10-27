<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const darkMode = useState('site-dark-mode', () => false)
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
      innerHTML: `(function(){try{var t=localStorage.getItem('checkin-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.dataset.theme='dark';}else{document.documentElement.dataset.theme='light';}}catch(e){}})();`,
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

// 실시간 날짜 & 시간 (Asia/Seoul 기준 동적 렌더링)
const currentDateTime = ref(getSeoulDateTimeString())

function updateClock() {
  currentDateTime.value = getSeoulDateTimeString()
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
  <div class="site-shell bkp-theme-root">
    <!-- 방콕포스트 공식 최상단 유틸리티 바 (divnav-top) -->
    <header v-if="!isAdminRoute" class="bkp-header-wrapper">
      <div class="bkp-utility-bar">
        <div class="bkp-page-container bkp-utility-inner">
          <div class="bkp-datetime-label">
            <span class="bkp-red-bullet" />
            <span>{{ currentDateTime }}</span>
          </div>
          <div class="bkp-utility-links">
            <span class="bkp-tagline-text">THE WORLD’S WINDOW ON TRAVEL JOURNALISM</span>
            <span class="bkp-pipe">|</span>
            <!-- 다국어 6개 국어 언어 스위처 트리거 -->
            <div class="bkp-lang-selector-top">
              <button
                type="button"
                class="bkp-lang-trigger-btn"
                aria-label="언어 선택 / Select Language"
                @click="openLangModal"
              >
                <span class="bkp-lang-globe">🌐</span>
                <span class="bkp-lang-flag">{{ currentLocaleMeta.flag }}</span>
                <span class="bkp-lang-name">{{ currentLocaleMeta.nativeName }}</span>
                <span class="bkp-lang-code">({{ currentLocaleMeta.code.toUpperCase() }})</span>
                <svg class="bkp-lang-chevron" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
            </div>
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

      <!-- 방콕포스트 메인 마스트헤드 (데스크톱 & 모바일 반응형) -->
      <div class="bkp-masthead-bar">
        <div class="bkp-page-container bkp-masthead-inner">
          <!-- 모바일 전용 햄버거 메뉴 버튼 -->
          <button
            class="bkp-mobile-btn bkp-hamburger-btn"
            type="button"
            aria-label="전체 메뉴 열기"
            @click="toggleMobileDrawer"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <!-- 로고 영역: 공식 벡터 SVG 로고 -->
          <div class="bkp-logo-unit">
            <NuxtLink :to="locUrl('/news')" class="bkp-main-brand" title="Check-in Daily">
              <!-- 데스크톱용 풀 벡터 로고 -->
              <img src="/logo.svg" alt="Check-in Daily" class="bkp-vector-logo bkp-desktop-only" width="310" height="52">
              <!-- 모바일용 콤팩트 브랜드 유닛 -->
              <div class="bkp-mobile-only bkp-mobile-logo-wrap">
                <img src="/favicon.svg" alt="Check-in Daily" class="bkp-mobile-logo-icon" width="36" height="36">
                <div class="bkp-brand-headings">
                  <span class="bkp-brand-name">CHECK-IN <b>DAILY</b></span>
                </div>
              </div>
            </NuxtLink>
          </div>

          <!-- 데스크톱 검색 & 북마크 도구 -->
          <div class="bkp-masthead-tools bkp-desktop-only">
            <form class="bkp-search-box" role="search" @submit.prevent="submitSearch">
              <input v-model="search" :placeholder="t('search_placeholder')" aria-label="뉴스 검색">
              <button type="submit" aria-label="검색">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span>{{ t('search') }}</span>
              </button>
            </form>
            <NuxtLink :to="locUrl('/saved')" class="bkp-btn-subscribe" title="스크랩한 뉴스">
              <span>★ {{ t('saved').toUpperCase() }}</span>
            </NuxtLink>
          </div>

          <!-- 모바일 전용 상단 우측 액션 버튼들 -->
          <div class="bkp-mobile-actions bkp-mobile-only">
            <!-- 모바일 언어 스위치 버튼 (모달 오픈) -->
            <button
              class="bkp-mobile-lang-pill"
              type="button"
              aria-label="언어 변경 (Select Language)"
              @click="openLangModal"
            >
              <span>🌐 {{ currentLocaleMeta.flag }} {{ locale.toUpperCase() }}</span>
            </button>
            <button
              class="bkp-mobile-btn"
              type="button"
              :class="{ active: isMobileSearchOpen }"
              aria-label="기사 검색창 토글"
              @click="toggleMobileSearch"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
            <NuxtLink :to="locUrl('/saved')" class="bkp-mobile-btn" aria-label="스크랩북 이동">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </NuxtLink>
          </div>
        </div>

        <!-- 모바일 검색창 드롭다운 (토글 시 부드럽게 노출) -->
        <div v-if="isMobileSearchOpen" class="bkp-mobile-search-bar">
          <form class="bkp-mobile-search-form" @submit.prevent="submitSearch">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              v-model="search"
              type="search"
              :placeholder="t('search_placeholder')"
              aria-label="모바일 뉴스 검색"
              autofocus
            >
            <button type="submit" class="bkp-mobile-search-submit">{{ t('search') }}</button>
          </form>
        </div>
      </div>

      <!-- 방콕포스트 시그니처 딥 네이비(#060D81) 메인 메뉴 바 (모바일 가로 스크롤 스와이프 지원) -->
      <nav class="bkp-nav-wrapper" aria-label="메인 카테고리 네비게이션">
        <div class="bkp-page-container bkp-nav-container">
          <ul class="bkp-menu-list">
            <li><NuxtLink :to="locUrl('/news')" active-class="active">{{ t('all_news').toUpperCase() }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/major')" active-class="active">{{ t('major').toUpperCase() }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/airline')" active-class="active">{{ t('airline').toUpperCase() }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/hotel')" active-class="active">{{ t('hotel').toUpperCase() }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/destination')" active-class="active">{{ t('destination').toUpperCase() }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/realtime')" active-class="active">{{ t('realtime').toUpperCase() }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/region')" active-class="active">{{ t('region').toUpperCase() }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/saved')" active-class="active">{{ t('saved').toUpperCase() }}</NuxtLink></li>
          </ul>
        </div>
      </nav>
    </header>

    <!-- 모바일 오프캔버스 슬라이드 드로어 메뉴 -->
    <Teleport to="body">
      <div
        v-if="isMobileDrawerOpen"
        class="bkp-drawer-backdrop"
        @click="closeMobileDrawer"
      />
      <aside
        class="bkp-mobile-drawer"
        :class="{ 'is-open': isMobileDrawerOpen }"
        aria-label="모바일 전체 메뉴"
      >
        <div class="bkp-drawer-header">
          <div class="bkp-drawer-brand">
            <img src="/favicon.svg" alt="Check-in Daily" width="30" height="30">
            <span class="bkp-brand-name">CHECK-IN <b>DAILY</b></span>
          </div>
          <button class="bkp-drawer-close-btn" type="button" aria-label="메뉴 닫기" @click="closeMobileDrawer">
            ✕
          </button>
        </div>

        <div class="bkp-drawer-time">
          <span class="bkp-red-bullet" />
          <span>{{ currentDateTime }}</span>
        </div>

        <!-- 모바일 6개국어 언어 그리드 선택기 -->
        <div class="bkp-drawer-lang-selector">
          <div class="bkp-drawer-lang-header">
            <span class="bkp-drawer-lang-label">🌐 SELECT LANGUAGE (언어 선택)</span>
            <span class="bkp-drawer-lang-current">{{ currentLocaleMeta.flag }} {{ currentLocaleMeta.nativeName }}</span>
          </div>
          <div class="bkp-drawer-lang-grid">
            <button
              v-for="item in supportedLocales"
              :key="item.code"
              type="button"
              class="bkp-dlang-card"
              :class="{ active: locale === item.code }"
              @click="() => { switchLocale(item.code); closeMobileDrawer(); }"
            >
              <span class="bkp-dlang-flag">{{ item.flag }}</span>
              <span class="bkp-dlang-native">{{ item.nativeName }}</span>
              <span class="bkp-dlang-code">{{ item.code.toUpperCase() }}</span>
            </button>
          </div>
        </div>

        <nav class="bkp-drawer-nav">
          <div class="bkp-drawer-sec-label">SECTIONS</div>
          <ul class="bkp-drawer-list">
            <li>
              <NuxtLink :to="locUrl('/news')" @click="closeMobileDrawer">
                <span class="bkp-drawer-icon">📰</span>
                <div class="bkp-drawer-item-text">
                  <span class="name-ko">{{ t('all_news') }}</span>
                  <span class="name-en">ALL NEWS</span>
                </div>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/major')" @click="closeMobileDrawer">
                <span class="bkp-drawer-icon">⭐</span>
                <div class="bkp-drawer-item-text">
                  <span class="name-ko">{{ t('major') }}</span>
                  <span class="name-en">MAJOR STORIES</span>
                </div>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/airline')" @click="closeMobileDrawer">
                <span class="bkp-drawer-icon">✈️</span>
                <div class="bkp-drawer-item-text">
                  <span class="name-ko">{{ t('airline') }}</span>
                  <span class="name-en">AIRLINES & MILES</span>
                </div>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/hotel')" @click="closeMobileDrawer">
                <span class="bkp-drawer-icon">🏨</span>
                <div class="bkp-drawer-item-text">
                  <span class="name-ko">{{ t('hotel') }}</span>
                  <span class="name-en">HOTELS & RESORTS</span>
                </div>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/destination')" @click="closeMobileDrawer">
                <span class="bkp-drawer-icon">🗺️</span>
                <div class="bkp-drawer-item-text">
                  <span class="name-ko">{{ t('destination') }}</span>
                  <span class="name-en">DESTINATIONS</span>
                </div>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/realtime')" @click="closeMobileDrawer">
                <span class="bkp-drawer-icon">🔥</span>
                <div class="bkp-drawer-item-text">
                  <span class="name-ko">{{ t('realtime') }}</span>
                  <span class="name-en">TOP STORIES</span>
                </div>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="locUrl('/news/region')" @click="closeMobileDrawer">
                <span class="bkp-drawer-icon">🌏</span>
                <div class="bkp-drawer-item-text">
                  <span class="name-ko">{{ t('region') }}</span>
                  <span class="name-en">BY REGION</span>
                </div>
              </NuxtLink>
            </li>
          </ul>

          <div class="bkp-drawer-sec-label">MY SERVICES</div>
          <ul class="bkp-drawer-list">
            <li>
              <NuxtLink :to="locUrl('/saved')" @click="closeMobileDrawer">
                <span class="bkp-drawer-icon">📌</span>
                <div class="bkp-drawer-item-text">
                  <span class="name-ko">{{ t('saved') }}</span>
                  <span class="name-en">SAVED ARTICLES</span>
                </div>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/login" @click="closeMobileDrawer">
                <span class="bkp-drawer-icon">⚙️</span>
                <div class="bkp-drawer-item-text">
                  <span class="name-ko">{{ t('admin_login') }}</span>
                  <span class="name-en">EDITORIAL DESK</span>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <div class="bkp-drawer-footer">
          <button
            class="bkp-drawer-theme-toggle"
            type="button"
            @click="darkMode = !darkMode"
          >
            <span>{{ darkMode ? '☀ 밝은 화면 (LIGHT)' : '◐ 어두운 화면 (DARK)' }}</span>
          </button>
          <p class="bkp-drawer-copy">© 2026 Check-in Daily Media Group</p>
        </div>
      </aside>
    </Teleport>

    <!-- 글로벌 6개국어 언어 선택 팝업 모달 -->
    <Teleport to="body">
      <div
        v-if="isLangModalOpen"
        class="bkp-modal-backdrop"
        @click.self="closeLangModal"
      >
        <div class="bkp-lang-modal" role="dialog" aria-labelledby="lang-modal-title" aria-modal="true">
          <div class="bkp-lang-modal-head">
            <div class="bkp-lang-modal-title-wrap">
              <span class="bkp-lang-modal-icon">🌐</span>
              <div>
                <h3 id="lang-modal-title" class="bkp-lang-modal-title">Select Language / 언어 선택</h3>
                <p class="bkp-lang-modal-sub">Choose your preferred edition of Check-in Daily</p>
              </div>
            </div>
            <button class="bkp-lang-modal-close" type="button" aria-label="닫기" @click="closeLangModal">
              ✕
            </button>
          </div>

          <div class="bkp-lang-modal-grid">
            <button
              v-for="item in supportedLocales"
              :key="item.code"
              type="button"
              class="bkp-lang-option-card"
              :class="{ active: locale === item.code }"
              @click="handleSelectLocale(item.code)"
            >
              <div class="bkp-lang-card-left">
                <span class="bkp-lang-card-flag">{{ item.flag }}</span>
                <div class="bkp-lang-card-text">
                  <span class="bkp-lang-card-native">{{ item.nativeName }}</span>
                  <span class="bkp-lang-card-en">{{ item.name }}</span>
                </div>
              </div>
              <div class="bkp-lang-card-right">
                <span class="bkp-lang-badge">{{ item.code.toUpperCase() }}</span>
                <span v-if="locale === item.code" class="bkp-lang-active-check">✓</span>
              </div>
            </button>
          </div>

          <div class="bkp-lang-modal-foot">
            <p class="bkp-lang-modal-note">
              * 언어 전환 시 각 언어별 전용 URL(예: <code>/news</code>, <code>/en/news</code>, <code>/zh/news</code>, <code>/th/news</code>, <code>/vi/news</code>, <code>/es/news</code>)로 즉시 이동합니다.
            </p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 메인 컨텐츠 영역 -->
    <main v-if="!isAdminRoute" class="bkp-main-content">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </main>
    <div v-else class="admin-route-root">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </div>

    <!-- 모바일 하단 고정 탭 바 (일반 페이지에서 한 손 엄지 손가락 조작 최적화) -->
    <!-- 기사 상세 페이지에서는 기사 전용 읽기 툴바가 대신 표시됨 -->
    <nav
      v-if="!isAdminRoute && !isArticleRoute"
      class="bkp-mobile-bottom-nav"
      aria-label="모바일 하단 내비게이션"
    >
      <NuxtLink :to="locUrl('/news')" class="bkp-bnav-item" active-class="active" exact-active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>{{ t('home') }}</span>
      </NuxtLink>
      <NuxtLink :to="locUrl('/news/airline')" class="bkp-bnav-item" active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.2-2 1-.3.8-.1 1.7.5 2.2l4.8 3.6-2.5 2.5-2.2-.5c-.5-.1-1.1.1-1.4.5-.4.4-.4 1.1 0 1.5l2.2 2.2 2.2 2.2c.4.4 1.1.4 1.5 0 .4-.3.6-.9.5-1.4l-.5-2.2 2.5-2.5 3.6 4.8c.5.6 1.4.8 2.2.5.8-.4 1.2-1.2 1-2z"/></svg>
        <span>{{ t('airline') }}</span>
      </NuxtLink>
      <NuxtLink :to="locUrl('/news/hotel')" class="bkp-bnav-item" active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/></svg>
        <span>{{ t('hotel') }}</span>
      </NuxtLink>
      <NuxtLink :to="locUrl('/news/destination')" class="bkp-bnav-item" active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/></svg>
        <span>{{ t('places') }}</span>
      </NuxtLink>
      <NuxtLink :to="locUrl('/saved')" class="bkp-bnav-item" active-class="active">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>{{ t('saved') }}</span>
      </NuxtLink>
    </nav>

    <!-- 방콕포스트 공식 3단 동적 푸터 (SiteFooter) -->
    <SiteFooter v-if="!isAdminRoute" />
  </div>
</template>

<style>
.bkp-theme-root {
  background: #FFFFFF;
  color: #111827;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  min-height: 100vh;
}

html[data-theme='dark'] .bkp-theme-root {
  background: #0F172A;
  color: #F8FAFC;
}

html[data-theme='dark'] .bkp-utility-bar {
  background: #090D16;
  border-bottom-color: #1E293B;
}

html[data-theme='dark'] .bkp-datetime-label {
  color: #94A3B8;
}

html[data-theme='dark'] .bkp-tagline-text {
  color: #64748B;
}

html[data-theme='dark'] .bkp-masthead-bar {
  background: #0F172A;
  border-bottom-color: #1E293B;
}

html[data-theme='dark'] .bkp-main-brand {
  color: #F8FAFC;
}

html[data-theme='dark'] .bkp-search-box input {
  background: #1E293B;
  color: #F8FAFC;
  border-color: #334155;
}

html[data-theme='dark'] .bkp-mode-toggle {
  border-color: #334155;
  color: #CBD5E1;
}

html[data-theme='dark'] .bkp-mode-toggle:hover {
  background: #1E293B;
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

/* 6-Language Switcher (Top Utility Bar) */
.bkp-lang-selector-top {
  display: inline-flex;
  align-items: center;
}

.bkp-lang-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #E5E7EB;
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  color: #1F2937;
  cursor: pointer;
  transition: all 0.15s ease;
}

.bkp-lang-trigger-btn:hover {
  background: #060D81;
  border-color: #060D81;
  color: #FFFFFF;
}

.bkp-lang-globe {
  font-size: 12px;
}

.bkp-lang-flag {
  font-size: 13px;
  line-height: 1;
}

.bkp-lang-name {
  font-size: 11px;
  font-weight: 700;
}

.bkp-lang-code {
  font-size: 10px;
  opacity: 0.75;
}

.bkp-lang-chevron {
  opacity: 0.6;
  transition: transform 0.15s ease;
}

.bkp-lang-trigger-btn:hover .bkp-lang-chevron {
  transform: translateY(1px);
}

.bkp-mobile-lang-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #060D81;
  color: #FFFFFF;
  border: 0;
  font-size: 11px;
  font-weight: 800;
  padding: 5px 9px;
  border-radius: 4px;
  cursor: pointer;
  font-family: 'DM Mono', monospace;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(6, 13, 129, 0.2);
}

.bkp-mobile-lang-pill:active {
  transform: scale(0.96);
}

/* Vector Logos */
.bkp-vector-logo {
  max-height: 48px;
  width: auto;
  display: block;
}

.bkp-mobile-logo-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bkp-footer-vector-logo {
  max-height: 42px;
  width: auto;
  display: block;
  margin-bottom: 12px;
}

/* Drawer Language Selector */
.bkp-drawer-lang-selector {
  padding: 14px 16px;
  border-bottom: 1px solid #E2E8F0;
  background: #F8FAFC;
}

.bkp-drawer-lang-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.bkp-drawer-lang-label {
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  font-weight: 800;
  color: #64748B;
  letter-spacing: 0.5px;
}

.bkp-drawer-lang-current {
  font-size: 11px;
  font-weight: 700;
  color: #060D81;
  background: #EEF2FF;
  padding: 2px 6px;
  border-radius: 3px;
}

.bkp-drawer-lang-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.bkp-dlang-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #1E293B;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.bkp-dlang-card.active {
  background: #060D81;
  border-color: #060D81;
  color: #FFFFFF;
  box-shadow: 0 2px 6px rgba(6, 13, 129, 0.25);
}

.bkp-dlang-flag {
  font-size: 15px;
  margin-right: 6px;
}

.bkp-dlang-native {
  flex: 1;
  font-size: 12px;
}

.bkp-dlang-code {
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  opacity: 0.75;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 4px;
  border-radius: 3px;
}

.bkp-dlang-card.active .bkp-dlang-code {
  background: rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
}

/* Global 6-Language Modal */
.bkp-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: bkpFadeIn 0.18s ease-out;
}

@keyframes bkpFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.bkp-lang-modal {
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 520px;
  overflow: hidden;
  animation: bkpScaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid #E2E8F0;
}

@keyframes bkpScaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.bkp-lang-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #E2E8F0;
  background: #F8FAFC;
}

.bkp-lang-modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bkp-lang-modal-icon {
  font-size: 26px;
}

.bkp-lang-modal-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #0F172A;
  font-family: 'DM Mono', -apple-system, sans-serif;
}

.bkp-lang-modal-sub {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: #64748B;
}

.bkp-lang-modal-close {
  background: transparent;
  border: 0;
  font-size: 20px;
  line-height: 1;
  color: #64748B;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.bkp-lang-modal-close:hover {
  background: #E2E8F0;
  color: #0F172A;
}

.bkp-lang-modal-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 16px 20px;
  background: #FFFFFF;
}

.bkp-lang-option-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #F8FAFC;
  border: 2px solid #E2E8F0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.bkp-lang-option-card:hover {
  border-color: #060D81;
  background: #EEF2FF;
  transform: translateY(-1px);
}

.bkp-lang-option-card.active {
  border-color: #060D81;
  background: #060D81;
  color: #FFFFFF;
  box-shadow: 0 4px 12px rgba(6, 13, 129, 0.25);
}

.bkp-lang-card-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bkp-lang-card-flag {
  font-size: 24px;
  line-height: 1;
}

.bkp-lang-card-text {
  display: flex;
  flex-direction: column;
}

.bkp-lang-card-native {
  font-size: 13.5px;
  font-weight: 700;
  color: #0F172A;
}

.bkp-lang-option-card.active .bkp-lang-card-native {
  color: #FFFFFF;
}

.bkp-lang-card-en {
  font-size: 11px;
  color: #64748B;
  font-family: 'DM Mono', monospace;
}

.bkp-lang-option-card.active .bkp-lang-card-en {
  color: rgba(255, 255, 255, 0.8);
}

.bkp-lang-card-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bkp-lang-badge {
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  font-weight: 800;
  padding: 2px 5px;
  background: #E2E8F0;
  color: #475569;
  border-radius: 3px;
}

.bkp-lang-option-card.active .bkp-lang-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
}

.bkp-lang-active-check {
  font-size: 14px;
  font-weight: 900;
  color: #38BDF8;
}

.bkp-lang-modal-foot {
  padding: 12px 20px;
  background: #F8FAFC;
  border-top: 1px solid #E2E8F0;
}

.bkp-lang-modal-note {
  margin: 0;
  font-size: 11px;
  color: #64748B;
  line-height: 1.4;
}

.bkp-lang-modal-note code {
  background: #E2E8F0;
  padding: 1px 4px;
  border-radius: 3px;
  color: #060D81;
  font-family: 'DM Mono', monospace;
  font-size: 10.5px;
}

/* Dark Mode Overrides for Language Components */
html[data-theme='dark'] .bkp-lang-trigger-btn {
  background: #1E293B;
  border-color: #334155;
  color: #E2E8F0;
}

html[data-theme='dark'] .bkp-lang-trigger-btn:hover {
  background: #3B82F6;
  border-color: #3B82F6;
  color: #FFFFFF;
}

html[data-theme='dark'] .bkp-drawer-lang-selector {
  background: #111827;
  border-bottom-color: #1F2937;
}

html[data-theme='dark'] .bkp-dlang-card {
  background: #1E293B;
  border-color: #334155;
  color: #F1F5F9;
}

html[data-theme='dark'] .bkp-dlang-card.active {
  background: #3B82F6;
  border-color: #3B82F6;
  color: #FFFFFF;
}

html[data-theme='dark'] .bkp-lang-modal {
  background: #0F172A;
  border-color: #334155;
}

html[data-theme='dark'] .bkp-lang-modal-head,
html[data-theme='dark'] .bkp-lang-modal-foot {
  background: #1E293B;
  border-color: #334155;
}

html[data-theme='dark'] .bkp-lang-modal-title {
  color: #F8FAFC;
}

html[data-theme='dark'] .bkp-lang-modal-grid {
  background: #0F172A;
}

html[data-theme='dark'] .bkp-lang-option-card {
  background: #1E293B;
  border-color: #334155;
}

html[data-theme='dark'] .bkp-lang-card-native {
  color: #F8FAFC;
}

html[data-theme='dark'] .bkp-lang-option-card.active {
  background: #2563EB;
  border-color: #3B82F6;
  color: #FFFFFF;
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

/* Mobile / Desktop Display Helpers */
.bkp-mobile-only {
  display: none !important;
}

.bkp-desktop-only {
  display: flex !important;
}

/* Mobile Header Buttons */
.bkp-mobile-btn {
  background: transparent;
  border: 0;
  color: #060D81;
  padding: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
  text-decoration: none;
}

.bkp-mobile-btn:active {
  background: #E5E7EB;
}

.bkp-mobile-btn.active {
  background: #060D81;
  color: #FFFFFF;
}

.bkp-mobile-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Mobile Search Dropdown */
.bkp-mobile-search-bar {
  background: #F3F4F6;
  border-top: 1px solid #E5E7EB;
  padding: 10px 16px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.bkp-mobile-search-form {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  padding: 0 10px;
  gap: 8px;
}

.bkp-mobile-search-form input {
  flex: 1;
  border: 0;
  outline: 0;
  padding: 10px 0;
  font-size: 14px;
  color: #111827;
}

.bkp-mobile-search-submit {
  background: #060D81;
  color: #FFFFFF;
  border: 0;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

/* Off-Canvas Mobile Drawer */
.bkp-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  z-index: 998;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.bkp-mobile-drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 82%;
  max-width: 320px;
  background: #FFFFFF;
  z-index: 999;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.2);
  transform: translateX(-100%);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow-y: auto;
}

.bkp-mobile-drawer.is-open {
  transform: translateX(0);
}

.bkp-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 2px solid #060D81;
}

.bkp-drawer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bkp-drawer-close-btn {
  background: transparent;
  border: 0;
  font-size: 20px;
  color: #6B7280;
  cursor: pointer;
  padding: 6px;
  line-height: 1;
}

.bkp-drawer-time {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  color: #64748B;
  font-weight: 600;
}

.bkp-drawer-nav {
  flex: 1;
  padding: 16px 0;
}

.bkp-drawer-sec-label {
  font-size: 10.5px;
  font-family: 'DM Mono', monospace;
  font-weight: 800;
  color: #94A3B8;
  padding: 8px 20px 4px;
  letter-spacing: 1px;
}

.bkp-drawer-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.bkp-drawer-list li a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  color: #1E293B;
  text-decoration: none;
  border-left: 3px solid transparent;
  transition: background 0.15s, border-left-color 0.15s;
}

.bkp-drawer-list li a:active,
.bkp-drawer-list li a.router-link-active {
  background: #EFF6FF;
  border-left-color: #060D81;
  color: #060D81;
}

.bkp-drawer-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.bkp-drawer-item-text {
  display: flex;
  flex-direction: column;
}

.bkp-drawer-item-text .name-ko {
  font-size: 14.5px;
  font-weight: 700;
  line-height: 1.25;
}

.bkp-drawer-item-text .name-en {
  font-size: 10.5px;
  font-family: 'DM Mono', monospace;
  color: #64748B;
  margin-top: 1px;
}

.bkp-drawer-footer {
  padding: 16px 20px;
  border-top: 1px solid #E2E8F0;
  background: #F8FAFC;
}

.bkp-drawer-theme-toggle {
  width: 100%;
  padding: 10px;
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  font-family: 'DM Mono', monospace;
  margin-bottom: 12px;
}

.bkp-drawer-copy {
  margin: 0;
  font-size: 10px;
  color: #94A3B8;
  text-align: center;
  font-family: 'DM Mono', monospace;
}

/* Mobile Fixed Bottom Navigation Bar (Thumb Zone) */
.bkp-mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #FFFFFF;
  border-top: 1px solid #E2E8F0;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
  z-index: 990;
  padding: 6px 8px;
  padding-bottom: max(6px, env(safe-area-inset-bottom, 6px));
  justify-content: space-around;
  align-items: center;
}

.bkp-bnav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex: 1;
  padding: 4px 0;
  color: #64748B;
  text-decoration: none;
  font-size: 10.5px;
  font-weight: 700;
  transition: color 0.15s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}

.bkp-bnav-item svg {
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.bkp-bnav-item:active {
  transform: scale(0.92);
}

.bkp-bnav-item.active {
  color: #060D81;
}

.bkp-bnav-item.active svg {
  stroke: #060D81;
  transform: translateY(-2px);
}

@media (max-width: 900px) {
  .bkp-footer-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .bkp-mobile-only {
    display: flex !important;
  }
  .bkp-desktop-only {
    display: none !important;
  }
  .bkp-mobile-bottom-nav {
    display: flex;
  }
  .bkp-main-content {
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 8px));
  }
  .bkp-utility-bar {
    display: none;
  }
  .bkp-masthead-bar {
    padding: 10px 0;
  }
  .bkp-masthead-inner {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .bkp-brand-mark {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }
  .bkp-brand-name {
    font-size: 20px;
  }
  .bkp-brand-motto {
    display: none;
  }
  .bkp-menu-list a {
    padding: 10px 14px;
    font-size: 12px;
  }
  .bkp-site-footer {
    padding-bottom: 70px;
  }
}

@media (max-width: 640px) {
  .bkp-tagline-text {
    display: none;
  }
}
</style>