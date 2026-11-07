<script setup lang="ts">
import { HREFLANG } from '~/config/locales'

interface TrendingResponse {
  articles: Array<{ id: number; title: string; category: string; isBreaking: boolean }>
}

const route = useRoute()
const { locale, t, locUrl, switchLocale, supportedLocales, formatDate } = useI18n()
const isAdminRoute = computed(() => route.path.startsWith('/admin'))

const NAV_CATEGORIES = ['major', 'airline', 'hotel', 'destination', 'realtime', 'region'] as const

useHead(() => ({
  htmlAttrs: { lang: HREFLANG[locale.value], 'data-theme': 'light' },
  link: [
    { rel: 'alternate', type: 'application/rss+xml', title: 'Check-in Daily RSS', href: locale.value === 'ko' ? '/rss.xml' : `/rss.xml?lang=${locale.value}` },
  ],
}))

const { data: trending } = await useFetch<TrendingResponse>('/api/trending', {
  key: 'header-trending',
  default: () => ({ articles: [] }),
  query: { lang: locale },
})
const tickerItems = computed(() => (trending.value?.articles || []).slice(0, 8))

const { data: latest } = await useFetch<{ data: Array<{ publishedAt: string | null }> }>('/api/articles', {
  key: 'header-latest',
  query: { limit: 1, page: 1 },
  default: () => ({ data: [] }),
})
const lastUpdated = computed(() => latest.value?.data?.[0]?.publishedAt || null)
const today = computed(() => formatDate(new Date().toISOString()))

const isDrawerOpen = ref(false)
const isSearchOpen = ref(false)
const isLangOpen = ref(false)
const langRoot = ref<HTMLElement | null>(null)

watch(() => route.fullPath, () => {
  isDrawerOpen.value = false
  isSearchOpen.value = false
  isLangOpen.value = false
})

async function selectLocale(code: (typeof supportedLocales)[number]['code']) {
  isLangOpen.value = false
  isDrawerOpen.value = false
  await switchLocale(code)
}

function onDocumentClick(event: MouseEvent) {
  if (langRoot.value && !langRoot.value.contains(event.target as Node)) isLangOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div class="site-shell">
    <NuxtLoadingIndicator color="#1D4ED8" :height="3" />

    <header v-if="!isAdminRoute" class="site-header">
      <div class="utility-bar">
        <div class="container utility-inner">
          <span class="today">{{ today }}</span>
          <div v-if="tickerItems.length" class="ticker" :aria-label="t('top_stories')">
            <span class="ticker-label">{{ t('top_stories') }}</span>
            <div class="ticker-viewport">
              <div class="ticker-track">
                <template v-for="pass in 2" :key="pass">
                  <NuxtLink v-for="item in tickerItems" :key="`${pass}-${item.id}`" :to="locUrl(`/news/${item.category}/article/${item.id}`)"
                    class="ticker-item" :tabindex="pass === 2 ? -1 : 0" :aria-hidden="pass === 2">
                    <span v-if="item.isBreaking" class="flash">{{ t('breaking') }}</span>{{ item.title }}
                  </NuxtLink>
                </template>
              </div>
            </div>
          </div>
          <span v-if="lastUpdated" class="engine-badge" :title="lastUpdated">
            <span class="pulse" aria-hidden="true" />{{ t('updated_label') }} {{ formatDate(lastUpdated, true) }}
          </span>
        </div>
      </div>

      <div class="container masthead">
        <button class="icon-btn mobile-only" type="button" :aria-label="t('open_menu')" @click="isDrawerOpen = true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>

        <NuxtLink :to="locUrl('/news')" class="brand" aria-label="Check-in Daily">
          <span class="brand-mark" aria-hidden="true">C</span>
          <span class="brand-name">Check-in <b>Daily</b></span>
        </NuxtLink>

        <div class="masthead-tools">
          <div class="search-desktop"><HeaderSearchBar /></div>
          <button class="icon-btn mobile-only" type="button" :aria-label="t('open_search')" :aria-expanded="isSearchOpen" @click="isSearchOpen = !isSearchOpen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </button>
          <div ref="langRoot" class="lang">
            <button class="lang-btn" type="button" :aria-label="t('select_language')" aria-haspopup="listbox" :aria-expanded="isLangOpen" @click="isLangOpen = !isLangOpen">
              {{ locale.toUpperCase() }}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z" /></svg>
            </button>
            <ul v-if="isLangOpen" class="lang-menu" role="listbox" :aria-label="t('select_language')">
              <li v-for="item in supportedLocales" :key="item.code">
                <button type="button" role="option" :aria-selected="locale === item.code" :class="{ active: locale === item.code }" @click="selectLocale(item.code)">
                  <span>{{ item.nativeName }}</span><span class="code">{{ item.code.toUpperCase() }}</span>
                </button>
              </li>
            </ul>
          </div>
          <PushNotificationBell />
        </div>
      </div>

      <div v-if="isSearchOpen" class="container search-mobile">
        <HeaderSearchBar :is-mobile="true" @submit="isSearchOpen = false" @select="isSearchOpen = false" />
      </div>

      <nav class="category-nav" :aria-label="t('main_navigation')">
        <div class="container category-inner">
          <NuxtLink :to="locUrl('/news')" class="cat-link" exact-active-class="active">{{ t('all_news') }}</NuxtLink>
          <NuxtLink v-for="slug in NAV_CATEGORIES" :key="slug" :to="locUrl(`/news/${slug}`)" class="cat-link" active-class="active">{{ t(slug) }}</NuxtLink>
        </div>
      </nav>
    </header>

    <Teleport to="body">
      <div v-if="isDrawerOpen && !isAdminRoute" class="drawer-backdrop" @click="isDrawerOpen = false" />
      <aside v-if="!isAdminRoute" class="drawer" :class="{ open: isDrawerOpen }" :inert="!isDrawerOpen" :aria-hidden="!isDrawerOpen" :aria-label="t('main_navigation')">
        <div class="drawer-head">
          <span class="brand-name">Check-in <b>Daily</b></span>
          <button class="icon-btn" type="button" :aria-label="t('close_menu')" @click="isDrawerOpen = false">✕</button>
        </div>
        <nav class="drawer-nav">
          <NuxtLink :to="locUrl('/news')">{{ t('all_news') }}</NuxtLink>
          <NuxtLink v-for="slug in NAV_CATEGORIES" :key="slug" :to="locUrl(`/news/${slug}`)">{{ t(slug) }}</NuxtLink>
        </nav>
        <div class="drawer-langs">
          <p>{{ t('select_language') }}</p>
          <div class="drawer-lang-grid">
            <button v-for="item in supportedLocales" :key="item.code" type="button" :class="{ active: locale === item.code }" @click="selectLocale(item.code)">
              {{ item.nativeName }}
            </button>
          </div>
        </div>
      </aside>
    </Teleport>

    <main v-if="!isAdminRoute" class="site-main">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </main>
    <div v-else class="admin-route-root">
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </div>

    <SiteFooter v-if="!isAdminRoute" />
  </div>
</template>

<style>
.site-shell { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-primary); color: var(--text-base); }
.site-main { flex: 1; }
.container { width: min(1240px, 100%); margin: 0 auto; padding: 0 20px; }

.site-header { position: sticky; top: 0; z-index: 100; background: var(--bg-primary); border-bottom: 1px solid var(--border); }

.utility-bar { background: var(--bg-surface); border-bottom: 1px solid var(--border); font-size: 12.5px; color: var(--text-muted); }
.utility-inner { display: flex; align-items: center; gap: 16px; height: 34px; }
.today { white-space: nowrap; font-weight: 600; }
.ticker { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
.ticker-label { flex-shrink: 0; font-weight: 800; color: var(--accent); }
.ticker-viewport { position: relative; flex: 1; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
.ticker-track { display: inline-flex; gap: 32px; white-space: nowrap; animation: ticker-scroll 60s linear infinite; }
.ticker-viewport:hover .ticker-track, .ticker-viewport:focus-within .ticker-track { animation-play-state: paused; }
.ticker-item { color: var(--text-secondary); }
.ticker-item:hover { color: var(--accent); }
.flash { margin-right: 6px; padding: 1px 6px; border-radius: 3px; background: var(--red); color: #fff; font-size: 11px; font-weight: 800; }
@keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .ticker-track { animation: none; } }
.engine-badge { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.pulse { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.18); }

.masthead { display: flex; align-items: center; gap: 16px; height: 64px; }
.brand { display: inline-flex; align-items: center; gap: 10px; margin-right: auto; }
.brand-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 7px; background: var(--accent); color: #fff; font-family: var(--font-display); font-size: 19px; font-weight: 700; }
.brand-name { font-family: var(--font-display); font-size: 23px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary); }
.brand-name b { color: var(--accent); }
.masthead-tools { display: flex; align-items: center; gap: 10px; }
.search-desktop { width: 300px; }
.icon-btn { display: inline-grid; place-items: center; width: 38px; height: 38px; border: 0; border-radius: 8px; background: transparent; color: var(--text-primary); cursor: pointer; }
.icon-btn:hover { background: var(--bg-surface); }
.mobile-only { display: none; }

.lang { position: relative; }
.lang-btn { display: inline-flex; align-items: center; gap: 4px; height: 36px; padding: 0 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px; font-weight: 700; cursor: pointer; }
.lang-btn:hover { border-color: var(--accent); }
.lang-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 120; min-width: 180px; margin: 0; padding: 6px; list-style: none; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-card); }
.lang-menu button { display: flex; justify-content: space-between; width: 100%; padding: 9px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text-base); font-size: 14px; cursor: pointer; text-align: left; }
.lang-menu button:hover, .lang-menu button.active { background: var(--accent-dim); color: var(--accent); }
.lang-menu .code { font-size: 12px; color: var(--text-muted); }

.search-mobile { padding-bottom: 12px; }

.category-nav { border-top: 1px solid var(--border); }
.category-inner { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
.category-inner::-webkit-scrollbar { display: none; }
.cat-link { position: relative; padding: 12px 12px; font-size: 15px; font-weight: 700; color: var(--text-secondary); white-space: nowrap; }
.cat-link:hover { color: var(--accent); }
.cat-link.active { color: var(--text-primary); }
.cat-link.active::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--accent); }

.drawer-backdrop { position: fixed; inset: 0; z-index: 300; background: rgba(15, 23, 42, 0.35); }
.drawer { position: fixed; top: 0; bottom: 0; left: 0; z-index: 310; width: min(320px, 86vw); padding: 16px; overflow-y: auto; background: var(--bg-primary); box-shadow: var(--shadow-card); transform: translateX(-100%); transition: transform 0.2s ease; }
.drawer.open { transform: none; }
.drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.drawer-nav { display: grid; }
.drawer-nav a { padding: 13px 4px; border-bottom: 1px solid var(--border); font-size: 16px; font-weight: 700; color: var(--text-primary); }
.drawer-langs p { margin: 20px 0 10px; font-size: 13px; font-weight: 700; color: var(--text-muted); }
.drawer-lang-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.drawer-lang-grid button { padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-primary); color: var(--text-base); font-size: 14px; cursor: pointer; }
.drawer-lang-grid button.active { border-color: var(--accent); color: var(--accent); font-weight: 700; }

@media (max-width: 900px) {
  .search-desktop { display: none; }
  .mobile-only { display: inline-grid; }
  .brand { margin-right: auto; }
  .engine-badge { display: none; }
}
@media (max-width: 560px) {
  .container { padding: 0 16px; }
  .today { display: none; }
  .brand-name { font-size: 20px; }
  .masthead { height: 56px; gap: 8px; }
}
</style>
