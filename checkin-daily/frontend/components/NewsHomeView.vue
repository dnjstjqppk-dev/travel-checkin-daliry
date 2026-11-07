<script setup lang="ts">
import type { Article } from '~/stores/articles'
import { FALLBACK_COVER_IMAGE, categoryCoverImage } from '~/utils/editorial-media'
import { HREFLANG, LOCALES } from '~/config/locales'

interface Paged { data: Article[]; total_count: number; total_pages: number; page: number }

const route = useRoute()
const apiFetch = useRequestFetch()
const { locale, t, locUrl, formatDate, formatNumber, categoryLabel } = useI18n()

const CURATED = ['major', 'airline', 'hotel', 'destination'] as const
const FEED_PAGE = 12

const searchQuery = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim().slice(0, 100) : ''))
const searchPage = computed(() => Math.max(1, Number.parseInt(String(route.query.page || '1'), 10) || 1))

const emptyPage = (): Paged => ({ data: [], total_count: 0, total_pages: 0, page: 1 })
const list = (query: Record<string, string | number>) =>
  apiFetch<Paged>('/api/articles', { query: { lang: locale.value, with_meta: 'true', ...query } }).catch(() => null)

// Search mode
const { data: searchData, status: searchStatus } = await useAsyncData(
  () => `home-search-${locale.value}-${searchQuery.value}-${searchPage.value}`,
  async () => (searchQuery.value ? (await list({ q: searchQuery.value, page: searchPage.value, limit: FEED_PAGE })) ?? emptyPage() : emptyPage()),
  { watch: [searchQuery, searchPage], default: emptyPage },
)

// Home mode
const { data: leadData } = await useAsyncData(
  () => `home-lead-${locale.value}`,
  async () => (await list({ page: 1, limit: 5 + FEED_PAGE })) ?? emptyPage(),
  { default: emptyPage },
)
const { data: popular } = await useAsyncData(
  () => `home-popular-${locale.value}`,
  () => apiFetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views', lang: locale.value } }).catch(() => [] as Article[]),
  { default: () => [] as Article[] },
)
const { data: curated } = await useAsyncData(
  () => `home-curated-${locale.value}`,
  async () => {
    const sections = await Promise.all(CURATED.map(async slug => ({ slug, items: ((await list({ category: slug, page: 1, limit: 4 })) ?? emptyPage()).data })))
    return sections.filter(section => section.items.length)
  },
  { default: () => [] as Array<{ slug: string; items: Article[] }> },
)

const hero = computed(() => leadData.value.data[0])
const subLeads = computed(() => leadData.value.data.slice(1, 5))
const feed = ref<Article[]>([])
watch(leadData, value => { feed.value = value.data.slice(5) }, { immediate: true })
const feedOffset = computed(() => 5 + feed.value.length)
const hasMoreFeed = computed(() => feedOffset.value < leadData.value.total_count)
const loadingMore = ref(false)
async function loadMore() {
  loadingMore.value = true
  try {
    const next = await $fetch<Article[]>('/api/articles', { query: { lang: locale.value, limit: FEED_PAGE, offset: feedOffset.value } })
    const seen = new Set(feed.value.map(item => item.id))
    feed.value = [...feed.value, ...next.filter(item => !seen.has(item.id))]
  } finally {
    loadingMore.value = false
  }
}

const heroCover = ref('')
watch(hero, value => {
  heroCover.value = value?.coverImage && /^(https?:\/\/|\/)/.test(value.coverImage) ? value.coverImage : categoryCoverImage(value?.category || 'major')
}, { immediate: true })
function onHeroError() {
  heroCover.value = heroCover.value === FALLBACK_COVER_IMAGE ? '' : FALLBACK_COVER_IMAGE
}

const pageNumbers = computed(() => {
  const total = searchData.value.total_pages
  const current = searchPage.value
  const start = Math.max(1, Math.min(current - 2, total - 4))
  return Array.from({ length: Math.min(5, total) }, (_, i) => start + i)
})
const searchLink = (page: number) => ({ path: locUrl('/news'), query: { q: searchQuery.value, page } })

// Newsletter
const email = ref('')
const subscribing = ref(false)
const newsletterState = ref<'idle' | 'ok' | 'error'>('idle')
async function subscribe() {
  if (!email.value) return
  subscribing.value = true
  try {
    await $fetch('/api/newsletter/subscribe', { method: 'POST', body: { email: email.value, lang: locale.value } })
    newsletterState.value = 'ok'
    email.value = ''
  } catch {
    newsletterState.value = 'error'
  } finally {
    subscribing.value = false
  }
}

// SEO
const { origin } = useSiteDomain()
const prefix = (code: string) => (code === 'ko' ? '' : `/${code}`)
const canonical = computed(() => `${origin.value}${prefix(locale.value)}/news`)
useSeoMeta({
  title: () => (searchQuery.value ? `${t('search_results_for', { q: searchQuery.value })} | Check-in Daily` : t('home_title')),
  description: () => t('footer_tagline'),
  ogTitle: () => t('home_title'),
  ogDescription: () => t('footer_tagline'),
  ogType: 'website',
  ogUrl: canonical,
  ogImage: () => `${origin.value}/images/og-default.png`,
  twitterCard: 'summary_large_image',
  robots: () => (searchQuery.value ? 'noindex, follow' : 'index, follow, max-image-preview:large'),
})
useHead(() => ({
  link: [
    { rel: 'canonical', href: canonical.value },
    ...LOCALES.map(code => ({ rel: 'alternate' as const, hreflang: HREFLANG[code], href: `${origin.value}${prefix(code)}/news` })),
    { rel: 'alternate' as const, hreflang: 'x-default', href: `${origin.value}/news` },
  ],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${origin.value}/#website`,
          name: 'Check-in Daily',
          url: origin.value,
          inLanguage: HREFLANG[locale.value],
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${origin.value}${prefix(locale.value)}/news?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'NewsMediaOrganization',
          '@id': `${origin.value}/#organization`,
          name: 'Check-in Daily',
          url: origin.value,
          logo: { '@type': 'ImageObject', url: `${origin.value}/logo.svg` },
          ethicsPolicy: `${origin.value}/policy`,
          correctionsPolicy: `${origin.value}/corrections`,
        },
      ],
    }),
  }],
}))
</script>

<template>
  <div class="home container">
    <!-- Search mode -->
    <section v-if="searchQuery" class="search" aria-live="polite">
      <header class="search-head">
        <h1>{{ t('search_results_for', { q: searchQuery }) }}</h1>
        <span v-if="searchStatus !== 'pending'" class="count">{{ t('results_count', { n: formatNumber(searchData.total_count) }) }}</span>
      </header>

      <div v-if="searchStatus === 'pending'" class="grid-3" aria-busy="true">
        <div v-for="n in 6" :key="n" class="skeleton-card"><div class="sk sk-thumb" /><div class="sk sk-line" /><div class="sk sk-line short" /></div>
      </div>
      <div v-else-if="!searchData.data.length" class="empty">
        <p class="empty-title">{{ t('no_results', { q: searchQuery }) }}</p>
        <p>{{ t('no_results_hint') }}</p>
        <div class="empty-links">
          <NuxtLink v-for="slug in CURATED" :key="slug" :to="locUrl(`/news/${slug}`)" class="chip">{{ categoryLabel(slug) }}</NuxtLink>
        </div>
      </div>
      <template v-else>
        <div class="grid-3">
          <NewsArticleCard v-for="item in searchData.data" :key="item.id" :article="item" :highlight="searchQuery" />
        </div>
        <nav v-if="searchData.total_pages > 1" class="pagination" :aria-label="t('pagination')">
          <NuxtLink v-if="searchPage > 1" :to="searchLink(searchPage - 1)" class="page-btn">← {{ t('prev_page') }}</NuxtLink>
          <NuxtLink v-for="p in pageNumbers" :key="p" :to="searchLink(p)" class="page-num" :class="{ active: p === searchPage }"
            :aria-current="p === searchPage ? 'page' : undefined">{{ p }}</NuxtLink>
          <NuxtLink v-if="searchPage < searchData.total_pages" :to="searchLink(searchPage + 1)" class="page-btn">{{ t('next_page') }} →</NuxtLink>
        </nav>
      </template>
    </section>

    <!-- Home mode -->
    <template v-else>
      <h1 class="sr-only">{{ t('home_heading') }}</h1>

      <div v-if="!hero" class="empty"><p class="empty-title">{{ t('no_articles') }}</p></div>

      <div v-else class="top-grid">
        <section class="lead" :aria-label="t('top_story')">
          <article class="hero">
            <NuxtLink :to="locUrl(`/news/${hero.category}/article/${hero.id}`)" class="hero-link">
              <div class="hero-media">
                <img v-if="heroCover" :src="heroCover" :alt="hero.title" fetchpriority="high" decoding="async" @error="onHeroError">
              </div>
              <p class="kicker">{{ categoryLabel(hero.category) }}</p>
              <h2 class="hero-title">{{ hero.title }}</h2>
              <p class="hero-summary">{{ hero.summary }}</p>
              <p class="meta"><time v-if="hero.publishedAt" :datetime="hero.publishedAt">{{ formatDate(hero.publishedAt, true) }}</time></p>
            </NuxtLink>
          </article>

          <ul v-if="subLeads.length" class="subleads">
            <li v-for="item in subLeads" :key="item.id">
              <NewsArticleCard :article="item" variant="compact" />
            </li>
          </ul>
        </section>

        <aside class="rail">
          <section v-if="popular.length" class="most-read">
            <h2 class="section-title">{{ t('most_read') }}</h2>
            <ol>
              <li v-for="(item, index) in popular" :key="item.id">
                <span class="rank">{{ String(index + 1).padStart(2, '0') }}</span>
                <NuxtLink :to="locUrl(`/news/${item.category}/article/${item.id}`)">{{ item.title }}</NuxtLink>
              </li>
            </ol>
          </section>

          <section class="newsletter">
            <h2 class="section-title">{{ t('newsletter_title') }}</h2>
            <p>{{ t('newsletter_desc') }}</p>
            <form @submit.prevent="subscribe">
              <label class="sr-only" for="newsletter-email">{{ t('email_placeholder') }}</label>
              <input id="newsletter-email" v-model="email" type="email" required autocomplete="email" :placeholder="t('email_placeholder')">
              <button type="submit" :disabled="subscribing">{{ t('subscribe') }}</button>
            </form>
            <p v-if="newsletterState === 'ok'" class="note ok" role="status">{{ t('newsletter_success') }}</p>
            <p v-else-if="newsletterState === 'error'" class="note err" role="alert">{{ t('newsletter_error') }}</p>
          </section>
        </aside>
      </div>

      <section v-for="section in curated" :key="section.slug" class="curation">
        <div class="section-head">
          <h2 class="section-title">{{ categoryLabel(section.slug) }}</h2>
          <NuxtLink :to="locUrl(`/news/${section.slug}`)">{{ t('more') }} →</NuxtLink>
        </div>
        <div class="grid-4">
          <NewsArticleCard v-for="item in section.items" :key="item.id" :article="item" />
        </div>
      </section>

      <section v-if="feed.length" class="latest">
        <div class="section-head"><h2 class="section-title">{{ t('latest_news') }}</h2></div>
        <div class="grid-3">
          <NewsArticleCard v-for="item in feed" :key="item.id" :article="item" />
          <template v-if="loadingMore">
            <div v-for="n in 3" :key="`sk-${n}`" class="skeleton-card" aria-hidden="true"><div class="sk sk-thumb" /><div class="sk sk-line" /><div class="sk sk-line short" /></div>
          </template>
        </div>
        <div v-if="hasMoreFeed" class="load-more">
          <button type="button" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? t('loading') : t('load_more') }}</button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.home { padding-top: 28px; padding-bottom: 80px; }
.section-title { margin: 0; font-family: var(--font-sans); font-size: 19px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.01em; }
.section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid var(--text-primary); }
.section-head a { font-size: 14px; font-weight: 700; color: var(--accent); }

.top-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 40px; align-items: start; }
.lead { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 28px; }
.hero-link { display: grid; gap: 10px; color: inherit; }
.hero-media { aspect-ratio: 16 / 10; border-radius: 8px; overflow: hidden; background: var(--bg-surface); }
.hero-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.kicker { margin: 6px 0 0; font-size: 13px; font-weight: 800; color: var(--accent); }
.hero-title { margin: 0; font-family: var(--font-display); font-size: clamp(26px, 3vw, 34px); line-height: 1.25; color: var(--text-primary); word-break: keep-all; overflow-wrap: anywhere; }
.hero-link:hover .hero-title { color: var(--accent); }
.hero-summary { margin: 0; font-size: 16.5px; line-height: 1.65; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.meta { margin: 0; font-size: 13px; color: var(--text-muted); }
.subleads { list-style: none; margin: 0; padding: 0; display: grid; align-content: start; }
.subleads li { padding: 14px 0; border-bottom: 1px solid var(--border); }
.subleads li:first-child { padding-top: 0; }

.rail { position: sticky; top: 150px; display: grid; gap: 28px; }
.most-read ol { list-style: none; margin: 12px 0 0; padding: 0; }
.most-read li { display: grid; grid-template-columns: 34px 1fr; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 15px; line-height: 1.45; font-weight: 650; color: var(--text-primary); }
.most-read .rank { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--accent); }
.most-read a:hover { color: var(--accent); }
.newsletter { padding: 20px; border-radius: 8px; background: var(--bg-surface); }
.newsletter p { margin: 8px 0 12px; font-size: 14px; line-height: 1.55; color: var(--text-secondary); }
.newsletter form { display: grid; gap: 8px; }
.newsletter input { height: 42px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); }
.newsletter button, .load-more button { height: 42px; padding: 0 18px; border: 0; border-radius: 6px; background: var(--accent); color: #fff; font-weight: 800; cursor: pointer; }
.newsletter button:disabled, .load-more button:disabled { opacity: 0.6; cursor: progress; }
.note { margin: 8px 0 0 !important; font-size: 13px !important; }
.note.ok { color: var(--accent) !important; }
.note.err { color: var(--red) !important; }

.curation, .latest { margin-top: 56px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 22px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px 22px; }
.load-more { display: flex; justify-content: center; margin-top: 32px; }

.search-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; margin-bottom: 24px; }
.search-head h1 { margin: 0; font-family: var(--font-display); font-size: 28px; color: var(--text-primary); }
.count { color: var(--text-muted); font-size: 15px; }
.empty { padding: 56px 20px; text-align: center; border: 1px dashed var(--border-strong); border-radius: 8px; color: var(--text-secondary); }
.empty-title { margin: 0 0 6px; font-size: 18px; font-weight: 800; color: var(--text-primary); }
.empty-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 16px; }
.chip { padding: 7px 14px; border-radius: 999px; background: var(--bg-surface); font-size: 14px; font-weight: 700; }
.chip:hover { color: var(--accent); }
.pagination { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 36px; }
.page-btn, .page-num { min-width: 40px; height: 40px; display: inline-grid; place-items: center; padding: 0 12px; border: 1px solid var(--border); border-radius: 6px; font-weight: 700; font-size: 14px; }
.page-num.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.page-btn:hover, .page-num:hover:not(.active) { border-color: var(--accent); color: var(--accent); }

.skeleton-card { display: grid; gap: 10px; }
.sk { border-radius: 6px; background: linear-gradient(90deg, var(--bg-surface) 25%, var(--border) 50%, var(--bg-surface) 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
.sk-thumb { aspect-ratio: 16 / 10; }
.sk-line { height: 16px; }
.sk-line.short { width: 60%; }
@keyframes shimmer { to { background-position: -200% 0; } }

@media (max-width: 1100px) {
  .top-grid { grid-template-columns: 1fr; }
  .rail { position: static; grid-template-columns: 1fr 1fr; }
  .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .lead { grid-template-columns: 1fr; }
  .rail { grid-template-columns: 1fr; }
  .grid-3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 520px) {
  .home { padding-top: 18px; }
  .grid-3, .grid-4 { grid-template-columns: 1fr; }
}
</style>
