<script setup lang="ts">
import type { Article } from '~/stores/articles'

const store = useArticlesStore()
const route = useRoute()
const requestFetch = useRequestFetch()
const { locale, t, locUrl } = useI18n()

const categoryNames = computed<Record<string, string>>(() => ({
  major: t('major'),
  airline: t('airline'),
  hotel: t('hotel'),
  destination: t('destination'),
  realtime: t('realtime'),
}))

const activeTab = ref<'all' | 'major' | 'airline' | 'hotel' | 'destination' | 'realtime'>('all')
const radarFilter = ref<'all' | 'airline' | 'hotel'>('all')

const searchQuery = computed(() => typeof route.query.q === 'string' ? route.query.q.trim() : '')
const searchPage = computed(() => {
  const p = route.query.page
  return typeof p === 'string' ? Math.max(1, parseInt(p, 10) || 1) : 1
})

await useAsyncData(
  `news-home-${locale.value}-${searchQuery.value}-${searchPage.value}`,
  () => store.load({
    limit: searchQuery.value ? 12 : 24,
    page: searchQuery.value ? searchPage.value : 1,
    search: searchQuery.value,
    lang: locale.value,
  })
)

const { data: popularArticles, error: popularLoadError } = await useAsyncData<Article[]>(
  `news-home-popular-${locale.value}`,
  () => requestFetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views', lang: locale.value } }),
  { default: () => [] },
)

watch([searchQuery, searchPage], async ([search, page]) => {
  await store.load({
    limit: search ? 12 : 24,
    page: search ? page : 1,
    search,
    lang: locale.value,
  })
})

// Tabbed & Category-filtered views
const filteredTabArticles = computed(() => {
  if (activeTab.value === 'all') return store.articles
  return store.articles.filter((a) => a.category === activeTab.value)
})

const featuredArticle = computed(() => filteredTabArticles.value[0] || store.articles[0])
const subLeadArticles = computed(() => filteredTabArticles.value.slice(1, 3))

// Radar Column articles (Airlines & Hotels feed)
const radarArticles = computed(() => {
  if (radarFilter.value === 'airline') {
    return store.articles.filter((a) => a.category === 'airline').slice(0, 6)
  }
  if (radarFilter.value === 'hotel') {
    return store.articles.filter((a) => a.category === 'hotel').slice(0, 6)
  }
  return store.articles.filter((a) => a.category === 'airline' || a.category === 'hotel').slice(0, 6)
})

// Bottom stream articles
const bottomStreamArticles = computed(() => store.articles.slice(3, 15))

function hasCoverImage(article: Article | undefined) {
  return Boolean(article?.coverImage && (/^https?:\/\//i.test(article.coverImage) || article.coverImage.startsWith('/')))
}

function formatDate(date: string | null) {
  if (!date) return 'LATEST WIRE'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(new Date(date))
}

function formatViews(views = 0) {
  return new Intl.NumberFormat('ko-KR').format(views)
}

// Newsletter state
const newsletterEmail = ref('')
const newsletterSubmitting = ref(false)
const newsletterMessage = ref('')
const newsletterSuccess = ref(false)

async function handleNewsletterSubmit() {
  if (!newsletterEmail.value) return
  newsletterSubmitting.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/newsletter/subscribe', {
      method: 'POST',
      body: { email: newsletterEmail.value },
    })
    newsletterSuccess.value = true
    newsletterMessage.value = res.message || '인텔리전스 뉴스레터 구독이 완료되었습니다.'
    newsletterEmail.value = ''
  } catch {
    newsletterSuccess.value = false
    newsletterMessage.value = '구독 신청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    newsletterSubmitting.value = false
  }
}

const { origin: siteOrigin } = useSiteDomain()
const currentLangPrefix = computed(() => locale.value === 'ko' ? '' : `/${locale.value}`)
const homeCanonicalUrl = computed(() => `${siteOrigin.value}${currentLangPrefix.value}/news`)

useSeoMeta({
  title: computed(() => locale.value === 'en'
    ? 'Check-in Daily | Global Travel Intelligence & Newsroom'
    : '체크인데일리 | 글로벌 항공·호텔·여행지 전문 인텔리전스 뉴스룸'),
  ogTitle: computed(() => 'Check-in Daily — Global Travel Intelligence & Newsroom'),
  description: computed(() => t('footer_tagline')),
  ogDescription: computed(() => t('footer_tagline')),
  ogImage: computed(() => `${siteOrigin.value}/images/og-default.png`),
  twitterImage: computed(() => `${siteOrigin.value}/images/og-default.png`),
  ogType: 'website',
  ogUrl: homeCanonicalUrl,
  twitterCard: 'summary_large_image',
})

useHead(() => ({
  link: [
    { rel: 'canonical', href: homeCanonicalUrl.value },
    { rel: 'alternate', hreflang: 'ko', href: `${siteOrigin.value}/news` },
    { rel: 'alternate', hreflang: 'en', href: `${siteOrigin.value}/en/news` },
    { rel: 'alternate', hreflang: 'zh-Hans', href: `${siteOrigin.value}/zh/news` },
    { rel: 'alternate', hreflang: 'th', href: `${siteOrigin.value}/th/news` },
    { rel: 'alternate', hreflang: 'vi', href: `${siteOrigin.value}/vi/news` },
    { rel: 'alternate', hreflang: 'es', href: `${siteOrigin.value}/es/news` },
    { rel: 'alternate', hreflang: 'x-default', href: `${siteOrigin.value}/news` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': `${siteOrigin.value}/#website`,
            name: 'Check-in Daily',
            url: siteOrigin.value,
            description: '글로벌 항공, 호텔, 여행지 트렌드를 심층 취재하고 데이터 기반으로 보도하는 독립 여행 저널리즘 미디어',
            inLanguage: locale.value === 'zh' ? 'zh-Hans' : locale.value,
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${siteOrigin.value}${currentLangPrefix.value}/news?q={search_term_string}`,
              },
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@type': 'NewsMediaOrganization',
            '@id': `${siteOrigin.value}/#organization`,
            name: 'Check-in Daily',
            url: siteOrigin.value,
            logo: {
              '@type': 'ImageObject',
              url: `${siteOrigin.value}/logo.svg`,
              width: 310,
              height: 52,
            },
            sameAs: [
              'https://twitter.com/CheckInDaily',
              'https://facebook.com/CheckInDailyNews',
            ],
            ethicsPolicy: `${siteOrigin.value}/policy`,
            correctionsPolicy: `${siteOrigin.value}/corrections`,
          },
        ],
      }),
    },
  ],
}))
</script>

<template>
  <div class="ttr-page-wrap">
    <!-- 0. Search Mode Overlay View -->
    <section v-if="searchQuery" class="ttr-search-view">
      <div class="ttr-section-header">
        <div class="title-left">
          <span class="bar-indicator" />
          <h2>SEARCH RESULTS: “{{ searchQuery }}”</h2>
        </div>
        <span class="count-badge">총 {{ store.totalCount }}건 ({{ store.currentPage }} / {{ store.totalPages }} 페이지)</span>
      </div>

      <p v-if="store.error" class="ttr-empty">{{ store.error }}</p>
      <p v-else-if="!store.articles.length" class="ttr-empty">검색 결과가 없습니다.</p>
      <div v-else>
        <div class="ttr-card-grid-3">
          <NewsArticleCard v-for="article in store.articles" :key="article.id" :article="article" />
        </div>

        <nav v-if="store.totalPages > 1" class="ttr-pagination-bar" aria-label="Search Pagination">
          <NuxtLink
            v-if="store.currentPage > 1"
            :to="{ path: locUrl('/news'), query: { q: searchQuery, page: store.currentPage - 1 } }"
            class="ttr-page-btn prev"
          >
            ← 이전
          </NuxtLink>
          <div class="ttr-page-numbers">
            <NuxtLink
              v-for="p in store.totalPages"
              :key="p"
              :to="{ path: locUrl('/news'), query: { q: searchQuery, page: p } }"
              class="ttr-page-num"
              :class="{ active: p === store.currentPage }"
            >
              {{ p }}
            </NuxtLink>
          </div>
          <NuxtLink
            v-if="store.currentPage < store.totalPages"
            :to="{ path: locUrl('/news'), query: { q: searchQuery, page: store.currentPage + 1 } }"
            class="ttr-page-btn next"
          >
            다음 →
          </NuxtLink>
        </nav>
      </div>
    </section>

    <!-- 1. Tetherrock Style Main Intelligence Terminal -->
    <template v-else>
      <!-- NEWS PAGE HEADER (Tetherrock Style) -->
      <div class="ttr-terminal-header">
        <div class="header-left">
          <div class="title-row">
            <span class="pulse-icon">📡</span>
            <h1 class="main-title">TRAVEL INTELLIGENCE FEED</h1>
          </div>
          <p class="sub-title">글로벌 항공 · 호텔 · 여행지 · 여행 정책 뉴스</p>
        </div>
        <div class="header-right">
          <span class="live-pulse-dot" />
          <span class="live-status-text">최신 게시 기사</span>
        </div>
      </div>

      <!-- NEWS SECTION TABS (Tetherrock .news-tab-btn style) -->
      <div class="ttr-tabs-bar">
        <button
          type="button"
          class="news-tab-btn"
          :class="{ active: activeTab === 'all' }"
          @click="activeTab = 'all'"
        >
          전체 <span class="tab-count">{{ store.totalCount || 66 }}</span>
        </button>
        <button
          type="button"
          class="news-tab-btn"
          :class="{ active: activeTab === 'major' }"
          @click="activeTab = 'major'"
        >
          ⭐ 주요뉴스 <span class="tab-count">15</span>
        </button>
        <button
          type="button"
          class="news-tab-btn"
          :class="{ active: activeTab === 'airline' }"
          @click="activeTab = 'airline'"
        >
          ✈️ 항공·노선 <span class="tab-count">18</span>
        </button>
        <button
          type="button"
          class="news-tab-btn"
          :class="{ active: activeTab === 'hotel' }"
          @click="activeTab = 'hotel'"
        >
          🏨 호텔·스테이 <span class="tab-count">16</span>
        </button>
        <button
          type="button"
          class="news-tab-btn"
          :class="{ active: activeTab === 'destination' }"
          @click="activeTab = 'destination'"
        >
          🗺️ 여행지·비자 <span class="tab-count">17</span>
        </button>
        <button
          type="button"
          class="news-tab-btn"
          :class="{ active: activeTab === 'realtime' }"
          @click="activeTab = 'realtime'"
        >
          🔥 실시간속보 <span class="tab-count">12</span>
        </button>
      </div>

      <!-- 3 COLUMN INTELLIGENCE GRID (Tetherrock Terminal Structure) -->
      <div class="ttr-3col-grid">
        <!-- ── COLUMN 1: TOP LEAD STORY & IN-DEPTH WIRE ── -->
        <div class="col-lead">
          <!-- Featured Big Lead Story -->
          <article v-if="featuredArticle" class="ttr-hero-card">
            <NuxtLink :to="locUrl(`/news/${featuredArticle.category}/article/${featuredArticle.id}`)" class="hero-link">
              <div class="hero-image-wrap">
                <img
                  v-if="hasCoverImage(featuredArticle)"
                  :src="featuredArticle.coverImage"
                  :alt="featuredArticle.title"
                  fetchpriority="high"
                >
                <div v-else class="hero-fallback">
                  <span>{{ categoryNames[featuredArticle.category] || featuredArticle.category }}</span>
                </div>
                <div class="hero-badges">
                  <span class="cat-badge">
                    {{ (categoryNames[featuredArticle.category] || featuredArticle.category).toUpperCase() }}
                  </span>
                </div>
              </div>

              <div class="hero-body">
                <div class="hero-meta">
                  <span class="meta-date">{{ formatDate(featuredArticle.publishedAt) }}</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-author">취재 데스크: <strong>{{ (featuredArticle.author || 'Senior Editor').toUpperCase() }}</strong></span>
                  <span v-if="featuredArticle.viewCount" class="meta-sep">·</span>
                  <span v-if="featuredArticle.viewCount" class="meta-views">{{ formatViews(featuredArticle.viewCount) }} VIEWS</span>
                </div>

                <h2 class="hero-headline">{{ featuredArticle.title }}</h2>
                <p class="hero-summary">{{ featuredArticle.summary }}</p>

                <!-- AI Key Takeaways Box (Tetherrock Card) -->
                <div v-if="(featuredArticle as any).keyTakeaways?.length" class="hero-takeaways">
                  <div class="takeaways-header">
                    <span class="icon">⚡</span>
                    <span class="label">KEY INTELLIGENCE 3-LINE TAKEAWAYS</span>
                  </div>
                  <ul class="takeaways-points">
                    <li v-for="(pt, pIdx) in (featuredArticle as any).keyTakeaways" :key="pIdx">
                      {{ pt }}
                    </li>
                  </ul>
                </div>

                <span class="hero-read-cta">
                  {{ locale === 'en' ? 'READ FULL INVESTIGATION →' : '심층 보도 본문 읽기 →' }}
                </span>
              </div>
            </NuxtLink>
          </article>

          <!-- Sub-lead 2-Card Row -->
          <div v-if="subLeadArticles.length" class="sublead-grid">
            <article v-for="sub in subLeadArticles" :key="sub.id" class="sublead-card">
              <NuxtLink :to="locUrl(`/news/${sub.category}/article/${sub.id}`)">
                <div class="sublead-thumb">
                  <img v-if="hasCoverImage(sub)" :src="sub.coverImage" :alt="sub.title" loading="lazy">
                  <div v-else class="hero-fallback" />
                  <span class="sublead-cat">{{ categoryNames[sub.category] || sub.category }}</span>
                </div>
                <div class="sublead-body">
                  <div class="sublead-meta">{{ formatDate(sub.publishedAt) }}</div>
                  <h3 class="sublead-title">{{ sub.title }}</h3>
                  <p class="sublead-desc">{{ sub.summary }}</p>
                </div>
              </NuxtLink>
            </article>
          </div>
        </div>

        <!-- ── COLUMN 2: AVIATION & HOTEL RADAR PANEL (Tetherrock .news-section-panel) ── -->
        <div class="col-radar">
          <div class="news-section-panel">
            <div class="panel-header">
              <div class="panel-title">
                <span class="panel-icon">📰</span>
                <span>실시간 항공 &amp; 호텔 레이더</span>
              </div>
              <span class="panel-live-tag">
                <span class="pulse-mini" />
                <span>NEWS FEED</span>
              </span>
            </div>

            <!-- Filter Chips -->
            <div class="filter-chips">
              <button
                type="button"
                class="nf-chip"
                :class="{ on: radarFilter === 'all' }"
                @click="radarFilter = 'all'"
              >
                전체
              </button>
              <button
                type="button"
                class="nf-chip"
                :class="{ on: radarFilter === 'airline' }"
                @click="radarFilter = 'airline'"
              >
                ✈️ 항공·노선
              </button>
              <button
                type="button"
                class="nf-chip"
                :class="{ on: radarFilter === 'hotel' }"
                @click="radarFilter = 'hotel'"
              >
                🏨 호텔·스테이
              </button>
            </div>

            <!-- High-Density Feed Items -->
            <div class="radar-feed-list">
              <div v-for="item in radarArticles" :key="item.id" class="radar-feed-item">
                <NuxtLink :to="locUrl(`/news/${item.category}/article/${item.id}`)" class="radar-feed-link">
                  <div class="radar-feed-text">
                    <div class="radar-feed-meta">
                      <span class="cat-pill" :class="item.category">{{ categoryNames[item.category] || item.category }}</span>
                      <span class="time">{{ formatDate(item.publishedAt) }}</span>
                    </div>
                    <h4 class="radar-feed-title">{{ item.title }}</h4>
                    <p class="radar-feed-snippet">{{ item.summary }}</p>
                  </div>
                  <div v-if="hasCoverImage(item)" class="radar-feed-thumb">
                    <img :src="item.coverImage" :alt="item.title" loading="lazy">
                  </div>
                </NuxtLink>
              </div>
            </div>

            <div class="panel-footer">
              <NuxtLink :to="locUrl('/news/airline')" class="panel-more-link">
                항공·호텔 전문 피드 전체 보기 ↗
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- ── COLUMN 3: TERMINAL SIDEBAR (FX, TOP RANKING, PARTNER ADS) ── -->
        <div class="col-sidebar">
          <!-- Widget 1: 실시간 여행 환율 지표 (Live FX Rates) -->
          <div class="side-panel-wrap">
            <CurrencyRates />
          </div>

          <!-- Widget 2: 🏆 실시간 랭킹 (Top Stories 1~5) -->
          <div class="side-panel-wrap top-stories-panel">
            <div class="panel-header">
              <div class="panel-title">
                <span class="panel-icon">🏆</span>
                <span>실시간 인기 기사 TOP 5</span>
              </div>
              <NuxtLink :to="locUrl('/news/realtime')" class="panel-more-link">MORE ↗</NuxtLink>
            </div>
            <ol class="rank-list">
              <li v-for="(art, idx) in popularArticles.slice(0, 5)" :key="art.id" class="rank-item">
                <span class="rank-badge" :class="{ 'top-three': idx < 3 }">{{ idx + 1 }}</span>
                <div class="rank-info">
                  <NuxtLink :to="locUrl(`/news/${art.category}/article/${art.id}`)" class="rank-title">
                    {{ art.title }}
                  </NuxtLink>
                  <div class="rank-meta">
                    <span class="cat-tag">{{ categoryNames[art.category] || art.category }}</span>
                    <span class="views">{{ formatViews(art.viewCount) }} views</span>
                  </div>
                </div>
              </li>
            </ol>
          </div>

          <!-- Widget 3: 💡 여행자 공식 제휴 혜택 (Partners CTA) -->
          <div class="side-panel-wrap partner-cta-panel">
            <div class="panel-header">
              <div class="panel-title">
                <span class="panel-icon">💡</span>
                <span>여행자 공식 혜택 레이더</span>
              </div>
            </div>
            <div class="partner-cards">
              <a href="https://tripscanner.com" target="_blank" rel="sponsored noopener noreferrer" class="partner-card">
                <div class="partner-info">
                  <span class="p-badge">최저가 검색</span>
                  <strong>TripScanner</strong>
                  <p>전 세계 항공권 &amp; 5성급 호텔 실시간 가격 비교</p>
                </div>
                <span class="p-cta">비교하기 ↗</span>
              </a>

              <a href="https://getfortrip.com" target="_blank" rel="sponsored noopener noreferrer" class="partner-card getfortrip">
                <div class="partner-info">
                  <span class="p-badge tour">투어·패스</span>
                  <strong>GetForTrip</strong>
                  <p>태국 DTV 비자 · 공항 패스트트랙 · eSIM 즉시 발급</p>
                </div>
                <span class="p-cta">예약하기 ↗</span>
              </a>
            </div>
          </div>

          <!-- Widget 4: 뉴스레터 구독 위젯 -->
          <div class="side-panel-wrap newsletter-panel">
            <div class="panel-header">
              <div class="panel-title">
                <span class="panel-icon">📬</span>
                <span>INTELLIGENCE BRIEFING</span>
              </div>
            </div>
            <div class="newsletter-body">
              <p class="desc">글로벌 항공 노선, 호텔 특가, 비자 규정 변경 알림을 매주 가장 먼저 전달합니다.</p>
              <div v-if="newsletterSuccess" class="success-box">
                ✓ {{ newsletterMessage }}
              </div>
              <form v-else class="newsletter-form" @submit.prevent="handleNewsletterSubmit">
                <input
                  v-model="newsletterEmail"
                  type="email"
                  required
                  placeholder="name@example.com"
                  aria-label="이메일 주소"
                >
                <button type="submit" :disabled="newsletterSubmitting">
                  {{ newsletterSubmitting ? '신청 중...' : '구독 ↗' }}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- ── BOTTOM STREAM: ALL CATEGORIES COMPACT ARCHIVE ── -->
      <section v-if="bottomStreamArticles.length" class="ttr-bottom-stream">
        <div class="stream-header">
          <div class="title-left">
            <span class="stream-bar" />
            <h3>LATEST INVESTIGATIVE ARCHIVES</h3>
          </div>
          <NuxtLink :to="locUrl('/news/major')" class="stream-more">
            전체 아카이브 더보기 →
          </NuxtLink>
        </div>

        <div class="ttr-card-grid-3">
          <NewsArticleCard v-for="art in bottomStreamArticles" :key="art.id" :article="art" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ttr-page-wrap {
  width: 100%;
}

/* 0. Header Status Banner (Tetherrock Style) */
.ttr-terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 12px;
  margin-bottom: 14px;
}

.header-left .title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-icon {
  font-size: 18px;
}

.main-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.2px;
}

.sub-title {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted, #8e99aa);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted, #8e99aa);
}

.live-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent, #00d4aa);
  box-shadow: 0 0 8px var(--accent, #00d4aa);
  animation: blink 2s infinite;
}

/* Section Tabs (.news-tab-btn) */
.ttr-tabs-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border, #23253a);
  margin-bottom: 18px;
  overflow-x: auto;
  scrollbar-width: none;
}
.ttr-tabs-bar::-webkit-scrollbar {
  display: none;
}

.news-tab-btn {
  padding: 9px 18px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted, #8e99aa);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: -1px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.news-tab-btn:hover {
  color: #ffffff;
}

.news-tab-btn.active {
  border-bottom-color: var(--accent, #00d4aa);
  color: var(--accent, #00d4aa);
  font-weight: 700;
}

.tab-count {
  background: rgba(0, 212, 170, 0.12);
  color: var(--accent, #00d4aa);
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}

/* 3-Column Intelligence Grid */
.ttr-3col-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr 340px;
  gap: 16px;
  align-items: start;
}

/* Col 1: Lead Hero Card */
.ttr-hero-card {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: border-color 0.2s;
}

.ttr-hero-card:hover {
  border-color: var(--accent, #00d4aa);
}

.hero-link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.hero-image-wrap {
  position: relative;
  height: 380px;
  width: 100%;
  overflow: hidden;
  background: var(--bg-input, #11121d);
}

.hero-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.ttr-hero-card:hover .hero-image-wrap img {
  transform: scale(1.03);
}

.hero-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #13141f 0%, #1c2138 100%);
  color: var(--text-dim, #7d8696);
  font-size: 16px;
  font-weight: 800;
}

.hero-badges {
  position: absolute;
  top: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 2;
}

.cat-badge {
  background: rgba(13, 14, 26, 0.85);
  backdrop-filter: blur(4px);
  color: var(--accent, #00d4aa);
  border: 1px solid rgba(0, 212, 170, 0.35);
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.eeat-badge {
  background: rgba(13, 14, 26, 0.85);
  backdrop-filter: blur(4px);
  color: #ffffff;
  border: 1px solid var(--border, #23253a);
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
}

.hero-body {
  padding: 20px 22px;
}

.hero-meta {
  font-size: 11.5px;
  color: var(--text-muted, #8e99aa);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.meta-sep {
  color: var(--text-dim, #5a6474);
}

.hero-headline {
  margin: 0 0 10px;
  font-size: clamp(22px, 2.5vw, 28px);
  font-weight: 800;
  line-height: 1.35;
  color: var(--text-primary, #f0f4f8);
  letter-spacing: -0.3px;
  transition: color 0.15s;
}

.ttr-hero-card:hover .hero-headline {
  color: var(--accent, #00d4aa);
}

.hero-summary {
  margin: 0 0 16px;
  font-size: 13.5px;
  color: var(--text-secondary, #d2d9e3);
  line-height: 1.65;
}

.hero-takeaways {
  background: var(--bg-input, #11121d);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.takeaways-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 800;
  color: var(--accent, #00d4aa);
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.takeaways-points {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.takeaways-points li {
  font-size: 12px;
  color: var(--text-secondary, #d2d9e3);
  line-height: 1.5;
  position: relative;
  padding-left: 14px;
}

.takeaways-points li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--accent, #00d4aa);
  font-weight: 900;
}

.hero-read-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--accent, #00d4aa);
}

/* Sub-lead 2-Card Grid */
.sublead-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.sublead-card {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s;
}

.sublead-card:hover {
  border-color: var(--accent, #00d4aa);
  transform: translateY(-2px);
}

.sublead-card a {
  display: block;
  text-decoration: none;
  color: inherit;
}

.sublead-thumb {
  height: 135px;
  position: relative;
  overflow: hidden;
  background: var(--bg-input, #11121d);
}

.sublead-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.sublead-cat {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(13, 14, 26, 0.85);
  color: var(--accent, #00d4aa);
  border: 1px solid rgba(0, 212, 170, 0.3);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.sublead-body {
  padding: 12px 14px;
}

.sublead-meta {
  font-size: 10.5px;
  color: var(--text-muted, #8e99aa);
  margin-bottom: 4px;
}

.sublead-title {
  margin: 0 0 6px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary, #f0f4f8);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sublead-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary, #d2d9e3);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Col 2: Aviation & Hotel Radar Panel */
.news-section-panel {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border, #23253a);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.2px;
}

.panel-live-tag {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--accent, #00d4aa);
  font-weight: 700;
}

.pulse-mini {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent, #00d4aa);
  animation: blink 2s infinite;
}

.filter-chips {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border, #23253a);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.nf-chip {
  padding: 4px 10px;
  border-radius: 14px;
  border: 1px solid var(--border, #23253a);
  background: var(--bg-input, #11121d);
  color: var(--text-muted, #8e99aa);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.nf-chip.on {
  border-color: var(--accent, #00d4aa);
  background: rgba(0, 212, 170, 0.12);
  color: var(--accent, #00d4aa);
}

.radar-feed-list {
  display: flex;
  flex-direction: column;
}

.radar-feed-item {
  border-bottom: 1px solid var(--border, #23253a);
  transition: background 0.15s;
}

.radar-feed-item:last-child {
  border-bottom: none;
}

.radar-feed-item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.radar-feed-link {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-decoration: none;
  color: inherit;
}

.radar-feed-text {
  flex: 1;
  min-width: 0;
}

.radar-feed-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--text-muted, #8e99aa);
  margin-bottom: 4px;
}

.cat-pill {
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.cat-pill.airline {
  background: rgba(0, 212, 170, 0.15);
  color: var(--accent, #00d4aa);
}

.cat-pill.hotel {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.radar-feed-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #f0f4f8);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.radar-feed-link:hover .radar-feed-title {
  color: var(--accent, #00d4aa);
}

.radar-feed-snippet {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted, #8e99aa);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.radar-feed-thumb {
  width: 68px;
  height: 52px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.radar-feed-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.panel-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border, #23253a);
  text-align: center;
  background: rgba(0, 0, 0, 0.1);
}

.panel-more-link {
  color: var(--accent, #00d4aa);
  font-size: 11.5px;
  font-weight: 700;
  text-decoration: none;
}

/* Col 3: Terminal Sidebar */
.col-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.side-panel-wrap {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 12px;
  overflow: hidden;
}

/* Top 5 Ranking Panel */
.rank-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rank-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #23253a);
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-badge {
  font-size: 12px;
  font-weight: 900;
  color: var(--text-muted, #8e99aa);
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: var(--bg-input, #11121d);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.rank-badge.top-three {
  color: var(--accent, #00d4aa);
  background: rgba(0, 212, 170, 0.15);
  border: 1px solid rgba(0, 212, 170, 0.3);
}

.rank-info {
  flex: 1;
  min-width: 0;
}

.rank-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary, #f0f4f8);
  line-height: 1.4;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.rank-title:hover {
  color: var(--accent, #00d4aa);
}

.rank-meta {
  margin-top: 4px;
  font-size: 10.5px;
  color: var(--text-dim, #7d8696);
  display: flex;
  gap: 8px;
}

.cat-tag {
  color: var(--accent, #00d4aa);
}

/* Partner Benefits Panel */
.partner-cards {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.partner-card {
  background: var(--bg-input, #11121d);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-decoration: none;
  color: inherit;
  transition: all 0.15s;
}

.partner-card:hover {
  border-color: var(--accent, #00d4aa);
  transform: translateY(-1px);
}

.partner-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.p-badge {
  font-size: 9px;
  font-weight: 800;
  color: var(--accent, #00d4aa);
  background: rgba(0, 212, 170, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
  width: fit-content;
}

.p-badge.tour {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.partner-info strong {
  font-size: 13px;
  color: var(--text-primary, #f0f4f8);
}

.partner-info p {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted, #8e99aa);
}

.p-cta {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent, #00d4aa);
  background: rgba(0, 212, 170, 0.12);
  padding: 4px 8px;
  border-radius: 4px;
}

/* Newsletter Panel */
.newsletter-body {
  padding: 14px 16px;
}

.newsletter-body .desc {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--text-muted, #8e99aa);
  line-height: 1.5;
}

.newsletter-form {
  display: flex;
  gap: 6px;
}

.newsletter-form input {
  flex: 1;
  background: var(--bg-input, #11121d);
  border: 1px solid var(--border, #23253a);
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--text-primary, #f0f4f8);
  font-size: 12px;
  outline: none;
}

.newsletter-form input:focus {
  border-color: var(--accent, #00d4aa);
}

.newsletter-form button {
  background: var(--accent, #00d4aa);
  color: #0d0e1a;
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}

.success-box {
  background: rgba(0, 212, 170, 0.15);
  color: var(--accent, #00d4aa);
  border: 1px solid rgba(0, 212, 170, 0.3);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

/* Bottom Stream Section */
.ttr-bottom-stream {
  margin-top: 40px;
}

.stream-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border, #23253a);
  padding-bottom: 12px;
  margin-bottom: 18px;
}

.stream-header .title-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stream-bar {
  width: 4px;
  height: 16px;
  background: var(--accent, #00d4aa);
  border-radius: 2px;
}

.stream-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.3px;
}

.stream-more {
  font-size: 12px;
  color: var(--accent, #00d4aa);
  font-weight: 600;
  text-decoration: none;
}

.ttr-card-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

/* Responsive Rules */
@media (max-width: 1200px) {
  .ttr-3col-grid {
    grid-template-columns: 1fr 1fr;
  }
  .col-sidebar {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .ttr-3col-grid {
    grid-template-columns: 1fr;
  }
  .col-sidebar {
    grid-template-columns: 1fr;
  }
  .sublead-grid {
    grid-template-columns: 1fr;
  }
  .ttr-card-grid-3 {
    grid-template-columns: 1fr;
  }
  .hero-image-wrap {
    height: 240px;
  }
}
</style>
