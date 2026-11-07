<script setup lang="ts">
import type { Article } from '~/stores/articles'

const props = defineProps<{
  category?: string
  countryCode?: string
  cityId?: string
}>()

const route = useRoute()
const store = useArticlesStore()
const requestFetch = useRequestFetch()
const pageSize = 12

const { locale, t, locUrl, formatNumber, categoryLabel, placeName } = useI18n()

const country = ref<{ code: string; nameKo: string; nameEn: string } | null>(null)
const city = ref<{ id: string; nameKo: string; nameEn: string } | null>(null)
const lastPageCount = ref(pageSize)
const loadingMore = ref(false)
const isRealtime = computed(() => props.category === 'realtime')

const filters = computed(() => ({
  // The realtime view ranks every category by views.
  category: isRealtime.value ? undefined : props.category,
  country: props.countryCode,
  city: props.cityId,
}))

async function loadFirstPage() {
  lastPageCount.value = await store.load({
    ...filters.value,
    limit: pageSize,
    ...(isRealtime.value ? { sort: 'views' as const } : {}),
    lang: locale.value,
  })
  return true
}

await useAsyncData(`news-list-${route.fullPath}`, loadFirstPage)

const { data: popularArticles } = await useAsyncData<Article[]>(
  `news-listing-popular-${locale.value}`,
  () => requestFetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views', lang: locale.value } }).catch(() => [] as Article[]),
  { default: () => [] },
)

watch(filters, async () => {
  await loadFirstPage()
}, { deep: true })

watch(() => [props.countryCode, props.cityId], async ([countryCode, cityId]) => {
  country.value = null
  city.value = null
  if (!countryCode) return
  try {
    const countries = await store.loadCountries()
    country.value = countries.find((item) => item.code === countryCode) || null
    const cities = await store.loadCities(countryCode)
    city.value = cities.find((item) => item.id === cityId) || null
  } catch {
    country.value = null
    city.value = null
  }
}, { immediate: true })

const canLoadMore = computed(() => lastPageCount.value === pageSize && store.articles.length < store.totalCount)

const title = computed(() => {
  if (city.value) return t('news_in_place', { name: placeName(city.value) })
  if (country.value) return t('news_in_place', { name: placeName(country.value) })
  if (props.category) return categoryLabel(props.category)
  return t('all_news')
})

const { origin: siteOrigin } = useSiteDomain()
const listCanonicalUrl = computed(() => `${siteOrigin.value}${route.path}`)

const breadcrumbs = computed(() => [
  { label: t('home'), to: locUrl('/news') },
  ...(props.category ? [{ label: categoryLabel(props.category), to: locUrl(`/news/${props.category}`) }] : []),
  ...(country.value ? [{ label: placeName(country.value), to: locUrl(props.category ? `/news/${props.category}/${country.value.code}` : `/news/region/${country.value.code}`) }] : []),
  ...(city.value ? [{ label: placeName(city.value), to: locUrl(route.path) }] : []),
])

useSeoMeta({
  title: () => `${title.value} | Check-in Daily`,
  ogTitle: () => `${title.value} | Check-in Daily`,
  description: () => t('list_description', { name: title.value }),
  ogDescription: () => t('list_description', { name: title.value }),
  ogType: 'website',
  ogUrl: listCanonicalUrl,
  ogImage: () => `${siteOrigin.value}/images/og-default.png`,
  twitterImage: () => `${siteOrigin.value}/images/og-default.png`,
  twitterCard: 'summary_large_image',
})

useHead(() => ({
  link: [{ rel: 'canonical', href: listCanonicalUrl.value }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.value.map((b, idx) => ({ '@type': 'ListItem', position: idx + 1, name: b.label, item: `${siteOrigin.value}${b.to}` })),
    }),
  }],
}))

async function loadMore() {
  loadingMore.value = true
  try {
    lastPageCount.value = await store.load({
      ...filters.value,
      limit: pageSize,
      offset: store.articles.length,
      ...(isRealtime.value ? { sort: 'views' as const } : {}),
      lang: locale.value,
    }, false, true)
  } finally {
    loadingMore.value = false
  }
}
</script>

<template>
  <div class="ttr-page-container ttr-listing-root">
    <nav class="ttr-breadcrumb-nav" :aria-label="t('breadcrumb')">
      <template v-for="(item, index) in breadcrumbs" :key="item.label">
        <span v-if="index" class="ttr-bc-sep">/</span>
        <NuxtLink :to="item.to" class="ttr-bc-link">{{ item.label }}</NuxtLink>
      </template>
    </nav>

    <div class="ttr-list-header-bar">
      <div class="ttr-list-title-group">
        <span class="ttr-color-bar" :class="{ realtime: isRealtime }" />
        <div>
          <h1 class="ttr-list-page-title">{{ title }}</h1>
          <p v-if="isRealtime" class="ttr-realtime-sublabel">{{ t('ranked_by_views') }}</p>
        </div>
      </div>
      <div class="ttr-list-count">{{ t('results_count', { n: formatNumber(store.totalCount || store.articles.length) }) }}</div>
    </div>

    <div class="ttr-highlight-row">
      <section class="ttr-col-main">
        <div v-if="store.loading && !store.articles.length" class="ttr-card-grid-2" aria-busy="true">
          <div v-for="n in 4" :key="n" class="skeleton-card"><div class="sk sk-thumb" /><div class="sk sk-line" /><div class="sk sk-line short" /></div>
        </div>
        <div v-else-if="store.error" class="ttr-empty-state"><p>{{ t(store.error) }}</p></div>
        <div v-else-if="!store.articles.length" class="ttr-empty-state"><p>{{ t('no_articles') }}</p></div>
        <div v-else class="ttr-card-grid-2">
          <NewsArticleCard
            v-for="(article, idx) in store.articles"
            :key="article.id"
            :article="article"
            :rank="isRealtime ? idx + 1 : undefined"
          />
          <template v-if="loadingMore">
            <div v-for="n in 2" :key="`sk-${n}`" class="skeleton-card" aria-hidden="true"><div class="sk sk-thumb" /><div class="sk sk-line" /><div class="sk sk-line short" /></div>
          </template>
        </div>

        <div v-if="canLoadMore" class="ttr-load-more-wrap">
          <button class="ttr-load-more-btn" type="button" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? t('loading') : t('load_more') }}
          </button>
        </div>
      </section>

      <aside class="ttr-col-side">
        <div v-if="popularArticles.length" class="ttr-side-widget ttr-topstories-widget">
          <div class="ttr-widget-header">
            <div class="ttr-widget-title-wrap">
              <span class="ttr-widget-indicator" />
              <h2>{{ t('most_read') }}</h2>
            </div>
            <NuxtLink :to="locUrl('/news/realtime')" class="ttr-widget-more">{{ t('more') }} →</NuxtLink>
          </div>
          <ol class="ttr-rank-ordered-list">
            <li v-for="(art, idx) in popularArticles.slice(0, 5)" :key="art.id" class="ttr-rank-line">
              <span class="ttr-rank-number" :class="{ 'accent': idx < 3 }">{{ idx + 1 }}</span>
              <div class="ttr-rank-body">
                <NuxtLink :to="locUrl(`/news/${art.category}/article/${art.id}`)">
                  <strong class="ttr-rank-text">{{ art.title }}</strong>
                </NuxtLink>
                <div class="ttr-rank-submeta">
                  <span class="ttr-rank-tag">{{ categoryLabel(art.category) }}</span>
                  <span class="ttr-rank-views">{{ t('views_count', { n: formatNumber(art.viewCount) }) }}</span>
                </div>
              </div>
            </li>
          </ol>
        </div>

        <div class="ttr-side-widget">
          <CurrencyRates />
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.skeleton-card { display: grid; gap: 10px; }
.sk { border-radius: 6px; background: linear-gradient(90deg, var(--bg-surface) 25%, var(--border) 50%, var(--bg-surface) 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
.sk-thumb { aspect-ratio: 16 / 10; }
.sk-line { height: 16px; }
.sk-line.short { width: 60%; }
@keyframes shimmer { to { background-position: -200% 0; } }
.ttr-load-more-btn:disabled { opacity: 0.6; cursor: progress; }
.ttr-widget-title-wrap h2 { margin: 0; font-size: 15px; font-family: var(--font-sans); font-weight: 800; }
</style>

<style scoped>
.ttr-listing-root {
  max-width: 1360px;
  margin: 0 auto;
  padding: 24px 20px 80px;
}

.ttr-breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  color: var(--text-muted, #8b949e);
  margin-bottom: 18px;
  letter-spacing: 0.8px;
}

.ttr-bc-link {
  color: var(--text-muted, #8b949e);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s ease;
}

.ttr-bc-link:hover {
  color: var(--accent);
}

.ttr-bc-sep {
  color: var(--text-dim);
}

.ttr-list-header-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 1px solid var(--border, #23253a);
  padding-bottom: 18px;
  margin-bottom: 28px;
}

.ttr-list-title-group {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.ttr-color-bar {
  width: 4px;
  height: 48px;
  background: var(--accent);
  border-radius: 2px;
  flex-shrink: 0;
  box-shadow: var(--shadow-card);
}

.ttr-color-bar.realtime {
  background: var(--red);
  box-shadow: 0 0 12px rgba(255, 82, 82, 0.5);
}

.ttr-kicker-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.ping-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.ttr-list-page-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.6px;
}

.ttr-realtime-sublabel {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--red);
  font-weight: 600;
  font-family: 'DM Mono', monospace;
}

.ttr-list-count {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
  font-family: 'DM Mono', monospace;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
}

.ttr-highlight-row {
  display: grid;
  grid-template-columns: 1.45fr 0.55fr;
  gap: 32px;
  align-items: start;
}

.ttr-col-main {
  min-width: 0;
}

.ttr-col-side {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.ttr-side-widget {
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 6px;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.ttr-side-widget::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
}

.ttr-widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border, #23253a);
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.ttr-widget-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ttr-widget-indicator {
  width: 3px;
  height: 14px;
  background: var(--accent);
  border-radius: 1px;
}

.ttr-widget-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: 0.6px;
  font-family: 'DM Mono', monospace;
}

.ttr-widget-more {
  color: var(--text-muted, #8b949e);
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  font-family: 'DM Mono', monospace;
  transition: color 0.15s;
}

.ttr-widget-more:hover {
  color: var(--accent);
}

.ttr-rank-ordered-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.ttr-rank-line {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #1c1d2e;
  align-items: baseline;
}

.ttr-rank-line:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.ttr-rank-number {
  font-family: 'DM Mono', monospace;
  font-size: 18px;
  font-weight: 800;
  color: var(--text-secondary);
  line-height: 1;
  text-align: center;
}

.ttr-rank-number.accent {
  color: var(--accent);
}

.ttr-rank-body {
  min-width: 0;
}

.ttr-rank-body a {
  text-decoration: none;
  color: inherit;
  display: block;
}

.ttr-rank-text {
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 600;
  transition: color 0.15s;
}

.ttr-rank-line:hover .ttr-rank-text {
  color: var(--accent);
}

.ttr-rank-submeta {
  margin-top: 5px;
  font-size: 10px;
  color: var(--text-muted, #8b949e);
  display: flex;
  gap: 10px;
  font-family: 'DM Mono', monospace;
}

.ttr-rank-tag {
  color: var(--accent);
  font-weight: 700;
  text-transform: uppercase;
}

.ttr-rank-views {
  color: var(--text-muted);
}

.ttr-empty-state {
  padding: 60px 20px;
  color: var(--text-muted, #8b949e);
  text-align: center;
  font-size: 14px;
  background: var(--bg-surface, #13141f);
  border: 1px dashed var(--border, #23253a);
  border-radius: 6px;
}

.ttr-empty-state .empty-icon {
  font-size: 28px;
  display: block;
  margin-bottom: 12px;
}

.ttr-card-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.ttr-load-more-wrap {
  display: flex;
  justify-content: center;
  margin-top: 40px;
}

.ttr-load-more-btn {
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  color: var(--text-primary);
  padding: 13px 36px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  letter-spacing: 0.8px;
}

.ttr-load-more-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--bg-card, #181927);
  box-shadow: var(--shadow-card);
}

@media (max-width: 900px) {
  .ttr-highlight-row {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

@media (max-width: 640px) {
  .ttr-listing-root {
    padding: 16px 12px 48px;
  }
  .ttr-list-header-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
  }
  .ttr-list-page-title {
    font-size: 20px;
  }
  .ttr-card-grid-2 {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .ttr-load-more-btn {
    width: 100%;
    padding: 12px 0;
  }
}
</style>
