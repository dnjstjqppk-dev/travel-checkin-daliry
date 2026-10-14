<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import type { Article } from '~/stores/articles'

const route = useRoute()
const store = useArticlesStore()
const savedStore = useSavedStore()
const category = String(route.params.category)

let article: Article
try {
  article = await store.loadById(String(route.params.id), category)
} catch {
  throw createError({ statusCode: 404, statusMessage: 'News article not found' })
}

const html = DOMPurify.sanitize(await marked.parse(article.content || ''))
const { data: recommendedData } = await useAsyncData(
  `article-recommended-${article.id}`,
  () => $fetch<Article[]>('/api/articles', { query: { category, limit: 5, sort: 'views' } }),
)
const recommendedArticles = computed(() => (recommendedData.value || []).filter((item) => item.id !== article.id).slice(0, 3))

const { data: popularArticles } = await useAsyncData<Article[]>(
  'article-popular-rail',
  () => $fetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views' } }),
  { default: () => [] },
)

const categoryNames: Record<string, string> = {
  major: '주요뉴스',
  airline: '항공',
  hotel: '호텔',
  destination: '여행지',
  realtime: '실시간 뉴스',
}

useSeoMeta({
  title: `${article.title} | Check-in Daily`,
  description: article.summary,
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

function copyUrl() {
  if (!import.meta.client) return
  navigator.clipboard.writeText(window.location.href)
  alert('기사 주소가 클립보드에 복사되었습니다.')
}
</script>

<template>
  <div class="bkp-page-container bkp-article-page">
    <!-- 상단 브레드크럼 -->
    <nav class="bkp-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink to="/news" class="bkp-bc-link">HOME</NuxtLink>
      <span class="bkp-bc-sep">›</span>
      <NuxtLink :to="`/news/${category}`" class="bkp-bc-link">{{ (categoryNames[category] || category).toUpperCase() }}</NuxtLink>
      <span class="bkp-bc-sep">›</span>
      <span class="bkp-bc-current">ARTICLE</span>
    </nav>

    <!-- 방콕포스트 2단 레이아웃 (좌측 기사 본문 68% : 우측 사이드바 32%) -->
    <div class="bkp-highlight-row">
      <!-- 좌측: 기사 본문 영역 -->
      <article class="bkp-col-main bkp-article-main-body">
        <header class="bkp-article-header">
          <span class="bkp-article-sec-badge">{{ (categoryNames[category] || category).toUpperCase() }}</span>
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
              <button class="bkp-share-btn" type="button" @click="copyUrl">COPY LINK</button>
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
            <span>[Photo: Check-in Daily / Reference news photo] {{ article.title }}</span>
          </figcaption>
        </figure>

        <!-- 도시/국가 태그 -->
        <div v-if="article.cities?.length" class="bkp-article-tags-row">
          <NuxtLink
            v-for="city in article.cities"
            :key="city.id"
            :to="`/news/${category}/${city.countryCode}/${city.id}`"
            class="bkp-article-tag-chip"
          >
            # {{ city.country?.nameKo || city.countryCode }} · {{ city.nameKo }}
          </NuxtLink>
        </div>

        <AdSlot placement-id="article_top" />

        <!-- 기사 본문 텍스트 (신문사 타이포그래피) -->
        <div class="bkp-article-content-html" v-html="html" />

        <AdSlot placement-id="article_bottom" />

        <!-- 관련 기사 섹션 (MORE TO EXPLORE) -->
        <section v-if="recommendedArticles.length" class="bkp-related-section">
          <div class="bkp-sec-header">
            <div class="bkp-sec-title-wrap">
              <span class="bkp-color-bar default" />
              <h2>RELATED STORIES</h2>
            </div>
            <NuxtLink :to="`/news/${category}`" class="bkp-sec-more">MORE {{ (categoryNames[category] || category).toUpperCase() }} →</NuxtLink>
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
            <NuxtLink to="/news/realtime" class="bkp-widget-more">MORE ↗</NuxtLink>
          </div>
          <ol class="bkp-rank-ordered-list">
            <li v-for="(art, idx) in popularArticles.slice(0, 5)" :key="art.id" class="bkp-rank-line">
              <span class="bkp-rank-number" :class="{ 'red': idx < 3 }">{{ idx + 1 }}</span>
              <div class="bkp-rank-body">
                <NuxtLink :to="`/news/${art.category}/article/${art.id}`">
                  <strong class="bkp-rank-text">{{ art.title }}</strong>
                </NuxtLink>
                <div class="bkp-rank-submeta">
                  <span class="bkp-rank-tag">{{ categoryNames[art.category] || art.category }}</span>
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
  color: #6B7280;
  margin-bottom: 16px;
}

.bkp-bc-link {
  color: #4B5563;
  text-decoration: none;
  font-weight: 600;
}

.bkp-bc-link:hover {
  color: #060D81;
}

.bkp-bc-sep {
  color: #9CA3AF;
}

.bkp-bc-current {
  color: #060D81;
  font-weight: 700;
}

.bkp-article-header {
  margin-bottom: 24px;
}

.bkp-article-sec-badge {
  display: inline-block;
  background: #060D81;
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 2px;
  letter-spacing: 0.8px;
  margin-bottom: 12px;
}

.bkp-article-headline {
  font-size: clamp(26px, 3.8vw, 38px);
  font-weight: 800;
  color: #111827;
  line-height: 1.25;
  letter-spacing: -0.5px;
  margin: 0 0 16px;
}

.bkp-article-lead-summary {
  font-size: 17px;
  font-weight: 500;
  color: #4B5563;
  line-height: 1.7;
  border-left: 3px solid #060D81;
  padding-left: 16px;
  margin: 0 0 20px;
}

.bkp-article-byline-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #E5E7EB;
  border-bottom: 1px solid #E5E7EB;
  padding: 12px 0;
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
  gap: 8px;
}

.bkp-share-btn {
  background: #F3F4F6;
  border: 1px solid #D1D5DB;
  color: #374151;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 3px;
}

.bkp-share-btn:hover {
  background: #E5E7EB;
}

.bkp-share-btn.save {
  background: #FEF2F2;
  border-color: #FECACA;
  color: #D0021B;
}

.bkp-article-featured-image {
  margin: 20px 0 24px;
}

.bkp-article-featured-image img {
  width: 100%;
  height: auto;
  max-height: 480px;
  object-fit: cover;
  border-radius: 4px;
}

.bkp-image-caption {
  font-size: 12px;
  color: #6B7280;
  font-style: italic;
  margin-top: 6px;
  padding-left: 4px;
  border-left: 2px solid #D1D5DB;
}

.bkp-article-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}

.bkp-article-tag-chip {
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  color: #1D4ED8;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 3px;
  text-decoration: none;
  font-weight: 600;
}

.bkp-article-content-html {
  font-size: 17px;
  line-height: 1.85;
  color: #1F2937;
  margin-top: 24px;
}

:deep(.bkp-article-content-html h2) {
  font-size: 22px;
  font-weight: 800;
  color: #060D81;
  margin-top: 36px;
  border-bottom: 2px solid #E5E7EB;
  padding-bottom: 8px;
}

:deep(.bkp-article-content-html p) {
  margin: 18px 0;
}

:deep(.bkp-article-content-html ul) {
  padding-left: 24px;
  margin: 18px 0;
}

:deep(.bkp-article-content-html li) {
  margin: 8px 0;
}

.bkp-related-section {
  margin-top: 48px;
  border-top: 2px solid #060D81;
  padding-top: 24px;
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

@media (max-width: 900px) {
  .bkp-highlight-row {
    grid-template-columns: 1fr;
  }
  .bkp-card-grid-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .bkp-card-grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
