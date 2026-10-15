<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import type { Article } from '~/stores/articles'

const route = useRoute()
const store = useArticlesStore()
const savedStore = useSavedStore()
const { locale, t, locUrl } = useI18n()
const category = String(route.params.category)

let article: Article
try {
  article = await store.loadById(String(route.params.id), category, locale.value)
} catch {
  throw createError({ statusCode: 404, statusMessage: 'News article not found' })
}

// 안전한 마크다운 파싱 (Cloudflare Workers SSR 호환)
function renderMarkdown(raw: string): string {
  try {
    const parsed = marked.parse(raw || '', { async: false }) as string
    const sanitizeFn = (DOMPurify as any)?.sanitize || (DOMPurify as any)?.default?.sanitize
    if (typeof sanitizeFn === 'function') {
      return sanitizeFn(parsed)
    }
    return parsed
  } catch {
    return raw || ''
  }
}

const html = computed(() => renderMarkdown(article.content || ''))

const router = useRouter()
const apiFetch = useRequestFetch()

const { data: recommendedData } = await useAsyncData(
  `article-recommended-${article.id}-${locale.value}`,
  () => apiFetch<Article[]>('/api/articles', { query: { category, limit: 5, sort: 'views', lang: locale.value } }).catch(() => []),
  { default: () => [] },
)
const recommendedArticles = computed(() => (recommendedData.value || []).filter((item) => item.id !== article.id).slice(0, 3))

const { data: popularData } = await useAsyncData<Article[]>(
  `article-popular-rail-${locale.value}`,
  () => apiFetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views', lang: locale.value } }).catch(() => []),
  { default: () => [] },
)
const popularArticles = computed(() => popularData.value || [])

function getCategoryName(cat: string): string {
  const map: Record<string, string> = {
    major: t('major'),
    airline: t('airline'),
    hotel: t('hotel'),
    destination: t('destination'),
    realtime: t('realtime'),
    region: t('region'),
  }
  return map[cat] || t(cat) || cat
}

const categoryNames = computed(() => ({
  major: t('major'),
  airline: t('airline'),
  hotel: t('hotel'),
  destination: t('destination'),
  realtime: t('realtime'),
  region: t('region'),
}))

const categoryDisplayName = computed(() => getCategoryName(category))

const articleCanonicalUrl = `https://travel-checkin-daily.dnjstjqppk.workers.dev/news/${category}/article/${article.id}`

useSeoMeta({
  title: computed(() => `${article.title} | Check-in Daily`),
  ogTitle: computed(() => article.title),
  description: computed(() => article.summary),
  ogDescription: computed(() => article.summary),
  ogImage: article.coverImage || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&auto=format&fit=crop&q=80',
  twitterImage: article.coverImage || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&auto=format&fit=crop&q=80',
  ogType: 'article',
  ogUrl: articleCanonicalUrl,
  articlePublishedTime: article.publishedAt || undefined,
  articleAuthor: [article.author || 'Check-in Daily Editorial Desk'],
  articleSection: categoryDisplayName.value,
  twitterCard: 'summary_large_image',
})

useHead({
  link: [
    { rel: 'canonical', href: articleCanonicalUrl },
    { rel: 'alternate', hreflang: 'ko', href: `https://travel-checkin-daily.dnjstjqppk.workers.dev/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'en', href: `https://travel-checkin-daily.dnjstjqppk.workers.dev/en/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'zh-Hans', href: `https://travel-checkin-daily.dnjstjqppk.workers.dev/zh/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'th', href: `https://travel-checkin-daily.dnjstjqppk.workers.dev/th/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'vi', href: `https://travel-checkin-daily.dnjstjqppk.workers.dev/vi/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'es', href: `https://travel-checkin-daily.dnjstjqppk.workers.dev/es/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'x-default', href: `https://travel-checkin-daily.dnjstjqppk.workers.dev/news/${category}/article/${article.id}` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: article.title,
        description: article.summary,
        image: article.coverImage ? [article.coverImage] : [],
        datePublished: article.publishedAt,
        dateModified: article.publishedAt,
        author: {
          '@type': 'Person',
          name: article.author || 'Check-in Daily Reporter',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Check-in Daily',
          logo: {
            '@type': 'ImageObject',
            url: 'https://travel-checkin-daily.dnjstjqppk.workers.dev/logo.svg',
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': articleCanonicalUrl,
        },
      }),
    },
  ],
})

function hasCoverImage(value: string) {
  return /^https:\/\//i.test(value)
}

function formatDate(date: string | null) {
  if (!date) return '14 OCT 2026'
  const d = new Date(date)
  const datePart = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Seoul' }).format(d)
  const timePart = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(d)
  return `${datePart.toUpperCase()} AT ${timePart}`
}

// 모바일 읽기 편의: 글자 크기 조절 (보통 / 크게 / 아주크게)
const fontSize = ref<'normal' | 'large' | 'xlarge'>('normal')
function toggleFontSize() {
  if (fontSize.value === 'normal') fontSize.value = 'large'
  else if (fontSize.value === 'large') fontSize.value = 'xlarge'
  else fontSize.value = 'normal'
}

const copySuccess = ref(false)
function copyUrl() {
  if (!import.meta.client) return
  navigator.clipboard.writeText(window.location.href)
  copySuccess.value = true
  setTimeout(() => { copySuccess.value = false }, 2500)
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="bkp-page-container bkp-article-page">
    <!-- 상단 브레드크럼 -->
    <nav class="bkp-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink :to="locUrl('/news')" class="bkp-bc-link">HOME</NuxtLink>
      <span class="bkp-bc-sep">›</span>
      <NuxtLink :to="locUrl(`/news/${category}`)" class="bkp-bc-link">{{ categoryDisplayName.toUpperCase() }}</NuxtLink>
      <span class="bkp-bc-sep">›</span>
      <span class="bkp-bc-current">ARTICLE</span>
    </nav>

    <!-- 방콕포스트 2단 레이아웃 (좌측 기사 본문 68% : 우측 사이드바 32%) -->
    <div class="bkp-highlight-row">
      <!-- 좌측: 기사 본문 영역 -->
      <article class="bkp-col-main bkp-article-main-body">
        <header class="bkp-article-header">
          <span class="bkp-article-sec-badge">{{ categoryDisplayName.toUpperCase() }}</span>
          <h1 class="bkp-article-headline">{{ article.title }}</h1>
          <p class="bkp-article-lead-summary">{{ article.summary }}</p>

          <!-- 방콕포스트 공식 바이라인 & 게시일 -->
          <div class="bkp-article-byline-bar">
            <div class="bkp-byline-left">
              <span>PUBLISHED : {{ formatDate(article.publishedAt) }}</span>
              <span class="bkp-pipe">|</span>
              <span>WRITER: <strong>{{ (article.author || 'CHECK-IN DAILY EDITORIAL DESK').toUpperCase() }}</strong></span>
              <span v-if="article.viewCount" class="bkp-pipe">|</span>
              <span v-if="article.viewCount">{{ article.viewCount.toLocaleString('ko-KR') }} VIEWS</span>
            </div>
            <div class="bkp-share-tools">
              <button class="bkp-share-btn" type="button" @click="copyUrl">
                {{ copySuccess ? 'COPIED!' : 'COPY LINK' }}
              </button>
              <button
                class="bkp-share-btn save"
                type="button"
                @click="savedStore.toggle(article.slug)"
              >
                {{ savedStore.has(article.slug) ? '★ SAVED' : '☆ SAVE' }}
              </button>
            </div>
          </div>
        </header>

        <!-- 메인 커버 이미지 -->
        <figure v-if="hasCoverImage(article.coverImage)" class="bkp-article-featured-image">
          <img :src="article.coverImage" :alt="article.title" fetchpriority="high">
          <figcaption class="bkp-image-caption">
            <span>{{ locale === 'en' ? `[Photo: Unsplash Editorial License / Reference image] ${article.title}` : `[자료 사진: Unsplash 에디토리얼 라이선스 / 기사 보도 참고용] ${article.title}` }}</span>
          </figcaption>
        </figure>

        <!-- 도시/국가 태그 -->
        <div v-if="article.cities?.length" class="bkp-article-tags-row">
          <NuxtLink
            v-for="city in article.cities"
            :key="city.id"
            :to="locUrl(`/news/${category}/${city.countryCode}/${city.id}`)"
            class="bkp-article-tag-chip"
          >
            # {{ locale === 'en' ? (city.country?.nameEn || city.countryCode) : (city.country?.nameKo || city.countryCode) }} · {{ locale === 'en' ? city.nameEn : city.nameKo }}
          </NuxtLink>
        </div>

        <AdSlot placement-id="article_top" />

        <!-- 기사 본문 텍스트 (신문사 타이포그래피) -->
        <div class="bkp-article-content-html" :class="`font-${fontSize}`" v-html="html" />

        <AdSlot placement-id="article_bottom" />

        <!-- 관련 기사 섹션 (MORE TO EXPLORE) -->
        <section v-if="recommendedArticles.length" class="bkp-related-section">
          <div class="bkp-sec-header">
            <div class="bkp-sec-title-wrap">
              <span class="bkp-color-bar default" />
              <h2>RELATED STORIES</h2>
            </div>
            <NuxtLink :to="locUrl(`/news/${category}`)" class="bkp-sec-more">MORE {{ categoryDisplayName.toUpperCase() }} →</NuxtLink>
          </div>
          <div class="bkp-card-grid-3">
            <NewsArticleCard v-for="item in recommendedArticles" :key="item.id" :article="item" />
          </div>
        </section>
      </article>

      <!-- 우측: 방콕포스트 TOP STORIES & 환율 사이드바 -->
      <aside class="bkp-col-side">
        <div class="bkp-side-widget bkp-topstories-widget">
          <div class="bkp-widget-header">
            <span class="bkp-widget-indicator" />
            <h3>TOP STORIES</h3>
            <NuxtLink :to="locUrl('/news/realtime')" class="bkp-widget-more">MORE ↗</NuxtLink>
          </div>
          <ol class="bkp-rank-ordered-list">
            <li v-for="(art, idx) in popularArticles.slice(0, 5)" :key="art.id" class="bkp-rank-line">
              <span class="bkp-rank-number" :class="{ 'red': idx < 3 }">{{ idx + 1 }}</span>
              <div class="bkp-rank-body">
                <NuxtLink :to="locUrl(`/news/${art.category}/article/${art.id}`)">
                  <strong class="bkp-rank-text">{{ art.title }}</strong>
                </NuxtLink>
                <div class="bkp-rank-submeta">
                  <span class="bkp-rank-tag">{{ getCategoryName(art.category) }}</span>
                  <span>{{ art.viewCount?.toLocaleString('ko-KR') || 0 }} views</span>
                </div>
              </div>
            </li>
          </ol>
        </div>

        <div class="bkp-side-widget">
          <CurrencyRates />
        </div>
      </aside>
    </div>

    <!-- 모바일 전용 플로팅 읽기 바 (화면 하단 고정) -->
    <nav class="bkp-mobile-reading-bar" aria-label="기사 읽기 컨트롤">
      <button class="mbar-btn" type="button" aria-label="이전 화면으로 돌아가기" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        <span>{{ locale === 'en' ? 'Back' : '뒤로' }}</span>
      </button>
      <button class="mbar-btn" type="button" aria-label="글자 크기 변경" @click="toggleFontSize">
        <span class="mbar-font-indicator">A<sup>+</sup></span>
        <span>{{ fontSize === 'normal' ? (locale === 'en' ? 'Normal' : '기본글꼴') : fontSize === 'large' ? (locale === 'en' ? 'Large' : '크게') : (locale === 'en' ? 'Extra' : '아주크게') }}</span>
      </button>
      <button class="mbar-btn" type="button" aria-label="기사 링크 복사" @click="copyUrl">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span>{{ copySuccess ? (locale === 'en' ? 'Copied!' : '복사완료!') : (locale === 'en' ? 'Share' : '공유') }}</span>
      </button>
      <button
        class="mbar-btn"
        :class="{ active: savedStore.has(article.slug) }"
        type="button"
        aria-label="기사 스크랩 저장"
        @click="savedStore.toggle(article.slug)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" :fill="savedStore.has(article.slug) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>{{ savedStore.has(article.slug) ? (locale === 'en' ? 'Saved' : '저장됨') : (locale === 'en' ? 'Save' : '스크랩') }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.bkp-article-page {
  padding: 20px 0 60px;
}

.bkp-breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  margin-bottom: 20px;
  color: #6B7280;
}

.bkp-bc-link {
  color: #6B7280;
  text-decoration: none;
  font-weight: 700;
}

.bkp-bc-link:hover {
  color: #060D81;
}

.bkp-bc-sep {
  color: #9CA3AF;
}

.bkp-bc-current {
  color: #060D81;
  font-weight: 800;
}

.bkp-highlight-row {
  display: grid;
  grid-template-columns: 1.45fr 0.55fr;
  gap: 32px;
  align-items: start;
}

.bkp-col-main {
  min-width: 0;
}

.bkp-col-side {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.bkp-article-sec-badge {
  display: inline-block;
  background: #060D81;
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 2px;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.bkp-article-headline {
  font-family: Georgia, 'Times New Roman', Times, serif;
  font-size: clamp(26px, 3.5vw, 36px);
  font-weight: 900;
  line-height: 1.25;
  color: #111827;
  margin: 0 0 14px;
}

.bkp-article-lead-summary {
  font-size: 17px;
  line-height: 1.7;
  color: #4B5563;
  margin: 0 0 18px;
  font-weight: 500;
}

.bkp-article-byline-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #E5E7EB;
  border-bottom: 1px solid #E5E7EB;
  padding: 10px 0;
  margin-bottom: 24px;
  font-size: 11px;
  color: #6B7280;
  font-family: 'DM Mono', monospace;
  flex-wrap: wrap;
  gap: 12px;
}

.bkp-byline-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.bkp-pipe {
  color: #D1D5DB;
}

.bkp-share-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bkp-share-btn {
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  color: #374151;
  padding: 5px 10px;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
  transition: all 0.15s;
}

.bkp-share-btn:hover {
  background: #E5E7EB;
  color: #060D81;
}

.bkp-share-btn.save {
  background: #FEF2F2;
  border-color: #FECACA;
  color: #D0021B;
}

.bkp-share-btn.save:hover {
  background: #FEE2E2;
}

.bkp-article-featured-image {
  margin: 0 0 28px;
  width: 100%;
}

.bkp-article-featured-image img {
  width: 100%;
  max-height: 520px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}

.bkp-image-caption {
  font-size: 11px;
  color: #6B7280;
  margin-top: 8px;
  font-family: 'DM Mono', monospace;
}

.bkp-article-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.bkp-article-tag-chip {
  background: #EFF6FF;
  border: 1px solid #DBEAFE;
  color: #1E40AF;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 3px;
  text-decoration: none;
  font-family: 'DM Mono', monospace;
}

.bkp-article-tag-chip:hover {
  background: #DBEAFE;
}

.bkp-article-content-html {
  color: #1F2937;
  margin-bottom: 40px;
}

.bkp-article-content-html :deep(p) {
  margin: 0 0 20px;
}

.bkp-article-content-html :deep(h2) {
  font-size: 22px;
  font-weight: 800;
  color: #060D81;
  margin: 36px 0 16px;
  border-left: 4px solid #060D81;
  padding-left: 12px;
}

.bkp-article-content-html :deep(h3) {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 28px 0 12px;
}

.bkp-article-content-html :deep(blockquote) {
  border-left: 4px solid #D0021B;
  background: #F9FAFB;
  margin: 24px 0;
  padding: 16px 20px;
  font-style: italic;
  color: #374151;
}

.bkp-article-content-html :deep(ul),
.bkp-article-content-html :deep(ol) {
  margin: 0 0 20px;
  padding-left: 24px;
}

.bkp-article-content-html :deep(li) {
  margin-bottom: 8px;
}

.bkp-related-section {
  margin-top: 48px;
  border-top: 2px solid #060D81;
  padding-top: 24px;
}

.bkp-sec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.bkp-sec-title-wrap {
  display: flex;
  align-items: center;
}

.bkp-color-bar.default {
  width: 5px;
  height: 20px;
  background: #D0021B;
  margin-right: 10px;
  display: inline-block;
}

.bkp-sec-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #111827;
}

.bkp-sec-more {
  color: #060D81;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  font-family: 'DM Mono', monospace;
}

.bkp-side-widget {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-top: 3px solid #060D81;
  padding: 20px;
  border-radius: 2px;
}

.bkp-widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #E5E7EB;
  padding-bottom: 10px;
  margin-bottom: 16px;
}

.bkp-widget-indicator {
  width: 4px;
  height: 16px;
  background: #D0021B;
  margin-right: 8px;
  display: inline-block;
}

.bkp-widget-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #060D81;
  letter-spacing: 0.5px;
  flex: 1;
}

.bkp-widget-more {
  color: #6B7280;
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  font-family: 'DM Mono', monospace;
}

.bkp-rank-ordered-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.bkp-rank-line {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #F3F4F6;
  align-items: baseline;
}

.bkp-rank-line:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.bkp-rank-number {
  font-family: 'DM Mono', monospace;
  font-size: 20px;
  font-weight: 800;
  color: #9CA3AF;
  line-height: 1;
  text-align: center;
}

.bkp-rank-number.red {
  color: #D0021B;
}

.bkp-rank-body {
  min-width: 0;
}

.bkp-rank-body a {
  text-decoration: none;
  color: inherit;
  display: block;
}

.bkp-rank-text {
  font-size: 13px;
  line-height: 1.45;
  color: #111827;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 600;
}

.bkp-rank-line:hover .bkp-rank-text {
  color: #060D81;
}

.bkp-rank-submeta {
  margin-top: 4px;
  font-size: 11px;
  color: #6B7280;
  display: flex;
  gap: 8px;
  font-family: 'DM Mono', monospace;
}

.bkp-rank-tag {
  color: #060D81;
  font-weight: 700;
}

.bkp-card-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.bkp-article-content-html.font-normal {
  font-size: 17px;
  line-height: 1.85;
}

.bkp-article-content-html.font-large {
  font-size: 19.5px;
  line-height: 1.95;
}

.bkp-article-content-html.font-xlarge {
  font-size: 22px;
  line-height: 2.05;
}

.bkp-mobile-reading-bar {
  display: none;
}

@media (max-width: 900px) {
  .bkp-highlight-row {
    grid-template-columns: 1fr;
  }
  .bkp-card-grid-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .bkp-article-page {
    padding-bottom: 90px;
  }
  .bkp-mobile-reading-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 58px;
    background: #FFFFFF;
    border-top: 1px solid #E5E7EB;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-around;
    z-index: 1000;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .mbar-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: transparent;
    border: 0;
    color: #4B5563;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    min-width: 64px;
    height: 100%;
    padding: 0;
    transition: color 0.15s, transform 0.15s;
  }
  .mbar-btn:active {
    transform: scale(0.92);
  }
  .mbar-btn.active {
    color: #D0021B;
  }
  .mbar-font-indicator {
    font-size: 15px;
    font-weight: 900;
    line-height: 1;
    font-family: 'DM Mono', monospace;
  }
}

@media (max-width: 640px) {
  .bkp-card-grid-3 {
    grid-template-columns: 1fr;
  }
  .bkp-article-headline {
    font-size: 24px;
    line-height: 1.3;
  }
}
</style>

