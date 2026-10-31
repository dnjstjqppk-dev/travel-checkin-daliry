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

// 안전한 마크다운 파싱 (Cloudflare Workers SSR 호환 & 이미지 지연 로딩 캡션 렌더링 & 헤딩 ID 앵커)
function renderMarkdown(raw: string): string {
  try {
    const renderer = new marked.Renderer()
    renderer.image = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
      const cleanHref = href || ''
      const cleanAlt = text || '기사 보도 사진'
      const cleanTitle = title ? `<figcaption class="article-body-caption">${title}</figcaption>` : ''
      return `<figure class="article-body-figure"><img src="${cleanHref}" alt="${cleanAlt}" loading="lazy" class="article-body-img" />${cleanTitle}</figure>`
    }
    renderer.heading = function (arg: any) {
      const depth = typeof arg === 'object' && arg.depth ? arg.depth : 2
      const text = typeof arg === 'object' && arg.text ? arg.text : (typeof arg === 'string' ? arg : '')
      const cleanText = text.replace(/<[^>]*>/g, '')
      const slugId = 'sec-' + cleanText.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/(^-|-$)/g, '')
      return `<h${depth} id="${slugId}" class="article-subheading h${depth}">${text}</h${depth}>`
    }
    const parsed = marked.parse(raw || '', { renderer, async: false }) as string
    const sanitizeFn = (DOMPurify as any)?.sanitize || (DOMPurify as any)?.default?.sanitize
    if (typeof sanitizeFn === 'function') {
      return sanitizeFn(parsed)
    }
    return DOMPurify.sanitize(parsed)
  } catch {
    return (raw || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

interface TocItem {
  id: string
  text: string
  level: number
}

const tocItems = computed<TocItem[]>(() => {
  const raw = article.content || ''
  const lines = raw.split('\n')
  const items: TocItem[] = []
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (match?.[1] && match[2]) {
      const level = match[1].length
      const text = match[2].trim().replace(/\*\*/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1')
      const id = 'sec-' + text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/(^-|-$)/g, '')
      items.push({ id, text, level })
    }
  }
  return items
})

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

const displayAuthor = computed(() => article.author || 'Check-in Daily')
const photoCaptionPrefix = computed(() => '')

const readingTimeLabel = computed(() => {
  const m = (article as any).readingTimeMinutes || 3
  switch (locale.value) {
    case 'en': return `${m} min read`
    case 'zh': return `${m} 分钟阅读`
    case 'th': return `อ่าน ${m} นาที`
    case 'vi': return `${m} phút đọc`
    case 'es': return `${m} min de lectura`
    default: return `${m}분 소요`
  }
})

const { data: reactionsData } = await useAsyncData(
  `reactions-${article.id}`,
  () => apiFetch<{ counts: { helpful: number; insightful: number; recommend: number }; userReactions: string[] }>(`/api/reactions/${article.id}`).catch(() => ({
    counts: { helpful: 0, insightful: 0, recommend: 0 },
    userReactions: [] as string[],
  })),
  { default: () => ({ counts: { helpful: 0, insightful: 0, recommend: 0 }, userReactions: [] as string[] }) },
)

const reactionCounts = computed(() => reactionsData.value?.counts || { helpful: 0, insightful: 0, recommend: 0 })
const activeReactions = computed(() => new Set(reactionsData.value?.userReactions || []))

async function handleReaction(type: 'helpful' | 'insightful' | 'recommend') {
  try {
    const res = await $fetch<{ success: boolean; active: boolean; counts: any }>(`/api/reactions/${article.id}`, {
      method: 'POST',
      body: { reactionType: type },
    })
    if (res?.counts && reactionsData.value) {
      reactionsData.value.counts = res.counts
      if (res.active) {
        reactionsData.value.userReactions.push(type)
      } else {
        reactionsData.value.userReactions = reactionsData.value.userReactions.filter((r: string) => r !== type)
      }
    }
  } catch {}
}

function trackEvent(eventType: 'share' | 'bookmark') {
  try {
    $fetch('/api/analytics/track', {
      method: 'POST',
      body: {
        eventType,
        articleId: article.id,
        referrer: typeof window !== 'undefined' ? window.location.href : '',
      },
    }).catch(() => {})
  } catch {}
}

const { origin: siteOrigin } = useSiteDomain()
const currentLangPrefix = computed(() => locale.value === 'ko' ? '' : `/${locale.value}`)
const articleCanonicalUrl = computed(() => `${siteOrigin.value}${currentLangPrefix.value}/news/${category}/article/${article.id}`)

useSeoMeta({
  title: computed(() => `${article.title} | Check-in Daily`),
  ogTitle: computed(() => article.title),
  description: computed(() => article.summary),
  ogDescription: computed(() => article.summary),
  ogImage: computed(() => article.coverImage || `${siteOrigin.value}/images/og-default.png`),
  twitterImage: computed(() => article.coverImage || `${siteOrigin.value}/images/og-default.png`),
  ogType: 'article',
  ogUrl: articleCanonicalUrl,
  articlePublishedTime: article.publishedAt || undefined,
  articleModifiedTime: article.updatedAt || article.publishedAt || undefined,
  articleAuthor: [displayAuthor.value],
  articleSection: categoryDisplayName.value,
  twitterCard: 'summary_large_image',
})

useHead(() => ({
  link: [
    { rel: 'canonical', href: articleCanonicalUrl.value },
    { rel: 'alternate', hreflang: 'ko', href: `${siteOrigin.value}/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'en', href: `${siteOrigin.value}/en/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'zh-Hans', href: `${siteOrigin.value}/zh/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'th', href: `${siteOrigin.value}/th/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'vi', href: `${siteOrigin.value}/vi/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'es', href: `${siteOrigin.value}/es/news/${category}/article/${article.id}` },
    { rel: 'alternate', hreflang: 'x-default', href: `${siteOrigin.value}/news/${category}/article/${article.id}` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'NewsArticle',
            '@id': `${articleCanonicalUrl.value}#article`,
            isPartOf: {
              '@type': 'WebSite',
              name: 'Check-in Daily',
              url: siteOrigin.value,
            },
            headline: article.title,
            description: article.summary,
            image: article.coverImage ? [article.coverImage] : [`${siteOrigin.value}/images/og-default.png`],
            datePublished: article.firstPublishedAt || article.publishedAt,
            dateModified: article.updatedAt || article.publishedAt,
            inLanguage: locale.value === 'zh' ? 'zh-Hans' : locale.value,
            isAccessibleForFree: 'True',
            author: {
              '@type': 'Person',
              name: displayAuthor.value,
            },
            publisher: {
              '@type': 'NewsMediaOrganization',
              name: 'Check-in Daily',
              url: siteOrigin.value,
              logo: {
                '@type': 'ImageObject',
                url: `${siteOrigin.value}/logo.svg`,
              },
              ethicsPolicy: `${siteOrigin.value}/policy`,
              correctionsPolicy: `${siteOrigin.value}/corrections`,
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': articleCanonicalUrl.value,
            },
            speakable: {
              '@type': 'SpeakableSpecification',
              cssSelector: ['.bkp-article-title', '.takeaways-list', '.bkp-article-content-html > p:first-of-type'],
            },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'HOME',
                item: `${siteOrigin.value}${currentLangPrefix.value}/news`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: categoryDisplayName.value.toUpperCase(),
                item: `${siteOrigin.value}${currentLangPrefix.value}/news/${category}`,
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: article.title,
                item: articleCanonicalUrl.value,
              },
            ],
          },
        ],
      }),
    },
  ],
}))

function hasCoverImage(value: string | null | undefined) {
  return Boolean(value && (/^https?:\/\//i.test(value) || value.startsWith('/')))
}

function formatDate(date?: string | null) {
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

const readingProgress = ref(0)
function updateReadingProgress() {
  if (!import.meta.client) return
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
  readingProgress.value = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0
}

onMounted(() => {
  window.addEventListener('scroll', updateReadingProgress, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateReadingProgress)
})

const copySuccess = ref(false)
function copyUrl() {
  if (!import.meta.client) return
  navigator.clipboard.writeText(window.location.href)
  copySuccess.value = true
  setTimeout(() => { copySuccess.value = false }, 2500)
}

const isShareModalOpen = ref(false)

function openShareModal() {
  trackEvent('share')
  if (import.meta.client && navigator.share) {
    navigator.share({
      title: article.title,
      text: article.summary,
      url: window.location.href,
    }).catch(() => {
      isShareModalOpen.value = true
    })
  } else {
    isShareModalOpen.value = true
  }
}

function shareToTwitter() {
  if (!import.meta.client) return
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(window.location.href)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function shareToFacebook() {
  if (!import.meta.client) return
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function shareToLinkedIn() {
  if (!import.meta.client) return
  const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function shareArticle() {
  openShareModal()
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="bkp-page-container bkp-article-page">
    <!-- 읽기 진행률 게이지 바 (Reading Progress Bar) -->
    <div class="reading-progress-track" aria-hidden="true">
      <div class="reading-progress-fill" :style="{ width: `${readingProgress}%` }" />
    </div>

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
              <span>PUBLISHED : {{ formatDate(article.firstPublishedAt || article.publishedAt) }}</span>
              <template v-if="article.updatedAt && article.updatedAt !== (article.firstPublishedAt || article.publishedAt)">
                <span class="bkp-pipe">|</span>
                <span>UPDATED : {{ formatDate(article.updatedAt) }}</span>
              </template>
              <template v-if="article.factCheckedAt">
                <span class="bkp-pipe">|</span>
                <span>FACT-CHECKED : {{ formatDate(article.factCheckedAt) }}</span>
              </template>
              <span class="bkp-pipe">|</span>
              <span>WRITER: <strong>{{ displayAuthor.toUpperCase() }}</strong></span>
              <span class="bkp-pipe">|</span>
              <span class="bkp-readtime">⏱ {{ readingTimeLabel }}</span>
              <span v-if="article.viewCount" class="bkp-pipe">|</span>
              <span v-if="article.viewCount">{{ article.viewCount.toLocaleString('ko-KR') }} VIEWS</span>
            </div>
            <div class="bkp-share-tools">
              <button class="bkp-share-btn font-toggle" type="button" @click="toggleFontSize">
                A<sup>+</sup> {{ fontSize.toUpperCase() }}
              </button>
              <button class="bkp-share-btn" type="button" @click="shareArticle">
                {{ copySuccess ? 'COPIED!' : 'SHARE' }}
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

          <!-- 사실 검증 및 1차 출처 인증 박스 (Fact-Check & Citation Box) -->
          <div v-if="article.sourceName || (article.factChecks && article.factChecks.length)" class="bkp-factcheck-card">
            <div class="bkp-fc-header">
              <span class="bkp-fc-badge">SOURCE RECORD</span>
              <span class="bkp-fc-desk">CHECK-IN DAILY EDITORIAL INTEGRITY DESK</span>
            </div>
            <div class="bkp-fc-body">
              <p v-if="article.sourceName" class="bkp-fc-source">
                <strong>출처:</strong>
                <a v-if="article.sourceUrl" :href="article.sourceUrl" target="_blank" rel="noopener noreferrer nofollow" class="bkp-fc-link">{{ article.sourceName }} ↗</a>
                <span v-else>{{ article.sourceName }}</span>
                <span v-if="article.licenseInfo" class="bkp-fc-lic">({{ article.licenseInfo }})</span>
              </p>
              <div v-if="article.factChecks && article.factChecks.length" class="bkp-fc-claims">
                <div v-for="(fc, idx) in article.factChecks" :key="idx" class="bkp-fc-item">
                  <span class="bkp-fc-check-icon">✓</span>
                  <span class="bkp-fc-claim-text">{{ fc.claim }} — <em class="bkp-fc-verdict">{{ (fc.verification_status || 'UNREVIEWED').toUpperCase() }}</em></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 기사 정정 고지 (Editorial Correction Notice) -->
          <div v-if="article.corrections && article.corrections.length" class="bkp-correction-notice" role="alert">
            <div class="bkp-cn-title">⚠️ 기사 정정 고지 (EDITORIAL CORRECTION)</div>
            <div v-for="(c, idx) in article.corrections" :key="idx" class="bkp-cn-item">
              <p><strong>정정 사유:</strong> {{ c.reason }} (정정 일시: {{ formatDate(c.corrected_at) }})</p>
              <p><del>{{ c.original_statement }}</del> → <strong>{{ c.corrected_statement }}</strong></p>
            </div>
          </div>
        </header>

        <!-- AI Key Takeaways Box -->
        <div v-if="(article as any).keyTakeaways?.length" class="bkp-takeaways-card">
          <div class="takeaways-header">
            <span class="takeaways-badge">KEY TAKEAWAYS</span>
            <span class="takeaways-label">AI 핵심 3줄 요약</span>
          </div>
          <ul class="takeaways-list">
            <li v-for="(point, pIdx) in (article as any).keyTakeaways" :key="pIdx">
              {{ point }}
            </li>
          </ul>
        </div>

        <!-- 기사 인터랙티브 목차 (Table of Contents) -->
        <div v-if="tocItems.length >= 2" class="bkp-toc-card">
          <div class="toc-header">
            <span class="toc-icon">📑</span>
            <span class="toc-title">ARTICLE OUTLINE &amp; KEY SECTIONS</span>
          </div>
          <ol class="toc-list">
            <li v-for="item in tocItems" :key="item.id" :class="`toc-level-${item.level}`">
              <a :href="`#${item.id}`" class="toc-link">{{ item.text }}</a>
            </li>
          </ol>
        </div>

        <!-- 메인 커버 이미지 -->
        <figure v-if="hasCoverImage(article.coverImage)" class="bkp-article-featured-image">
          <img :src="article.coverImage" :alt="article.title" fetchpriority="high">
          <figcaption class="bkp-image-caption">
            <span>{{ `${photoCaptionPrefix} ${article.title}` }}</span>
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
            # {{ locale === 'ko' ? (city.country?.nameKo || city.countryCode) : (city.country?.nameEn || city.countryCode) }} · {{ locale === 'ko' ? city.nameKo : city.nameEn }}
          </NuxtLink>
        </div>

        <AdSlot placement-id="article_top" />

        <!-- 기사 본문 텍스트 (신문사 타이포그래피) -->
        <div class="bkp-article-content-html" :class="`font-${fontSize}`" v-html="html" />

        <!-- 전략적 제휴 트래픽 전환 CTA (TripScanner / GetForTrip) -->
        <ArticleAffiliateCTA :category="category" :title="article.title" variant="card" />

        <!-- 독자 기사 반응 위젯 (Reader Reactions) -->
        <div class="bkp-reactions-box">
          <div class="reactions-title-row">
            <span class="reaction-tag">READER REACTIONS</span>
            <h4 class="reaction-heading">이 기사가 도움이 되셨나요?</h4>
          </div>
          <div class="reactions-buttons">
            <button
              class="reaction-btn"
              :class="{ active: activeReactions.has('helpful') }"
              type="button"
              @click="handleReaction('helpful')"
            >
              <span class="reaction-emoji">👍</span>
              <span class="reaction-text">유익해요</span>
              <span class="reaction-count">{{ reactionCounts.helpful }}</span>
            </button>
            <button
              class="reaction-btn"
              :class="{ active: activeReactions.has('insightful') }"
              type="button"
              @click="handleReaction('insightful')"
            >
              <span class="reaction-emoji">💡</span>
              <span class="reaction-text">심층분석</span>
              <span class="reaction-count">{{ reactionCounts.insightful }}</span>
            </button>
            <button
              class="reaction-btn"
              :class="{ active: activeReactions.has('recommend') }"
              type="button"
              @click="handleReaction('recommend')"
            >
              <span class="reaction-emoji">✈️</span>
              <span class="reaction-text">추천해요</span>
              <span class="reaction-count">{{ reactionCounts.recommend }}</span>
            </button>
          </div>
        </div>

        <!-- 기자 프로필 & 편집국 팩트체크 인증 배지 -->
        <div class="bkp-author-profile-card">
          <div class="author-avatar-col">
            <div class="author-avatar-circle">✍️</div>
          </div>
          <div class="author-info-col">
            <div class="author-meta-row">
              <h4 class="author-name">{{ displayAuthor }}</h4>
              <span class="author-role-badge">공인 에디터</span>
            </div>
            <p class="author-bio">
              체크인데일리 글로벌 뉴스룸 에디터. 국제항공운송협회(IATA), 정부 관광청(TAT 등), 글로벌 호텔 체인의 공식 데이터를 검증 보도합니다.
            </p>
            <div class="author-links">
              <NuxtLink :to="locUrl('/corrections')" class="author-link">오류 제보 및 정정 청구 →</NuxtLink>
              <NuxtLink :to="locUrl('/policy')" class="author-link">편집 윤리 강령 확인 →</NuxtLink>
            </div>
          </div>
        </div>

        <!-- 이전 기사 / 다음 기사 양방향 네비게이션 -->
        <div v-if="(article as any).prevArticle || (article as any).nextArticle" class="bkp-prev-next-nav">
          <NuxtLink
            v-if="(article as any).prevArticle"
            :to="locUrl(`/news/${(article as any).prevArticle.category}/article/${(article as any).prevArticle.id}`)"
            class="pn-card prev"
          >
            <span class="pn-direction">← 이전 기사 (PREV)</span>
            <span class="pn-title">{{ (article as any).prevArticle.title }}</span>
          </NuxtLink>
          <div v-else class="pn-card empty" />

          <NuxtLink
            v-if="(article as any).nextArticle"
            :to="locUrl(`/news/${(article as any).nextArticle.category}/article/${(article as any).nextArticle.id}`)"
            class="pn-card next"
          >
            <span class="pn-direction">다음 기사 (NEXT) →</span>
            <span class="pn-title">{{ (article as any).nextArticle.title }}</span>
          </NuxtLink>
        </div>

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
        <span>{{ t('back') }}</span>
      </button>
      <button class="mbar-btn" type="button" aria-label="글자 크기 변경" @click="toggleFontSize">
        <span class="mbar-font-indicator">A<sup>+</sup></span>
        <span>{{ fontSize === 'normal' ? (locale === 'en' ? 'Normal' : '기본글꼴') : fontSize === 'large' ? (locale === 'en' ? 'Large' : '크게') : (locale === 'en' ? 'Extra' : '아주크게') }}</span>
      </button>
      <button class="mbar-btn" type="button" aria-label="기사 링크 복사" @click="copyUrl">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span>{{ copySuccess ? (locale === 'en' ? 'Copied!' : '복사완료!') : t('share') }}</span>
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

    <!-- 소셜 공유 팝업 모달 -->
    <Teleport to="body">
      <div v-if="isShareModalOpen" class="share-modal-overlay" @click.self="isShareModalOpen = false">
        <div class="share-modal-card">
          <div class="share-modal-header">
            <h3>기사 공유하기 / SHARE STORY</h3>
            <button class="share-close-btn" type="button" aria-label="닫기" @click="isShareModalOpen = false">✕</button>
          </div>
          <p class="share-modal-desc">{{ article.title }}</p>
          <div class="share-channel-grid">
            <button class="share-channel-btn twitter" type="button" @click="shareToTwitter">
              <span class="share-icon">𝕏</span>
              <span>X (트위터)</span>
            </button>
            <button class="share-channel-btn facebook" type="button" @click="shareToFacebook">
              <span class="share-icon">f</span>
              <span>페이스북</span>
            </button>
            <button class="share-channel-btn linkedin" type="button" @click="shareToLinkedIn">
              <span class="share-icon">in</span>
              <span>링크드인</span>
            </button>
            <button class="share-channel-btn copy" type="button" @click="copyUrl">
              <span class="share-icon">🔗</span>
              <span>{{ copySuccess ? '복사 완료!' : '링크 복사' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 인터랙티브 목차 (Table of Contents) */
.bkp-toc-card {
  margin: 24px 0;
  padding: 18px 22px;
  background: #F8FAFC;
  border-left: 4px solid #060D81;
  border-radius: 4px;
}

.toc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  font-weight: 800;
  color: #060D81;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}

.toc-list {
  margin: 0;
  padding-left: 20px;
}

.toc-list li {
  margin-bottom: 6px;
  font-size: 14px;
  line-height: 1.5;
}

.toc-list li.toc-level-3 {
  margin-left: 18px;
  list-style-type: circle;
}

.toc-link {
  color: #1E293B;
  text-decoration: none;
  transition: color 0.15s;
}

.toc-link:hover {
  color: #D9534F;
  text-decoration: underline;
}

/* 소셜 공유 모달 */
.share-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.share-modal-card {
  background: #FFFFFF;
  border-radius: 8px;
  max-width: 440px;
  width: 100%;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.share-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.share-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #0F172A;
  font-family: 'DM Mono', monospace;
}

.share-close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #64748B;
}

.share-modal-desc {
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
  margin: 0 0 20px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  overflow: hidden;
}

.share-channel-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.share-channel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  background: #FFFFFF;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.share-channel-btn:hover {
  background: #F1F5F9;
  border-color: #94A3B8;
  transform: translateY(-1px);
}

.share-channel-btn.twitter:hover {
  background: #0F172A;
  color: #FFFFFF;
}

.share-channel-btn.facebook:hover {
  background: #1877F2;
  color: #FFFFFF;
}

.share-channel-btn.linkedin:hover {
  background: #0A66C2;
  color: #FFFFFF;
}

.share-icon {
  font-size: 15px;
  font-weight: 800;
}
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

.bkp-article-content-html :deep(.article-body-figure) {
  margin: 32px 0;
  text-align: center;
}

.bkp-article-content-html :deep(.article-body-img) {
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  display: block;
}

.bkp-article-content-html :deep(.article-body-caption) {
  margin-top: 8px;
  font-size: 13px;
  color: #6B7280;
  font-style: italic;
  text-align: center;
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
  line-clamp: 2;
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

.reading-progress-track {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.05);
  z-index: 99999;
}

.reading-progress-fill {
  height: 100%;
  background: #176B52;
  transition: width 0.1s linear;
}

.font-toggle {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
}

.bkp-factcheck-card {
  margin-top: 16px;
  background: #F0FDF4;
  border: 1px solid #BBF7D0;
  border-left: 4px solid #16A34A;
  border-radius: 4px;
  padding: 14px 18px;
  font-size: 13px;
  color: #166534;
}

.bkp-fc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.bkp-fc-badge {
  background: #16A34A;
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.5px;
}

.bkp-fc-desk {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #15803D;
  font-family: 'DM Mono', monospace;
}

.bkp-fc-source {
  margin: 0 0 6px;
  color: #1F2937;
  font-size: 13px;
}

.bkp-fc-link {
  color: #166534;
  font-weight: 700;
  text-decoration: underline;
  margin-left: 4px;
}

.bkp-fc-lic {
  font-size: 11px;
  color: #6B7280;
  margin-left: 6px;
}

.bkp-fc-claims {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #DCFCE7;
}

.bkp-fc-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: #374151;
}

.bkp-fc-check-icon {
  color: #16A34A;
  font-weight: 900;
}

.bkp-fc-verdict {
  font-weight: 800;
  color: #15803D;
  font-style: normal;
  font-family: 'DM Mono', monospace;
}

.bkp-correction-notice {
  margin-top: 16px;
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  border-left: 4px solid #D97706;
  border-radius: 4px;
  padding: 14px 18px;
  font-size: 13px;
  color: #92400E;
}

.bkp-cn-title {
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  font-family: 'DM Mono', monospace;
}

.bkp-cn-item p {
  margin: 4px 0;
  font-size: 12px;
}

/* Key Takeaways Card */
.bkp-takeaways-card {
  background: #F0FDF4;
  border: 1.5px solid #86EFAC;
  border-radius: 8px;
  padding: 18px 20px;
  margin: 20px 0;
}
.takeaways-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.takeaways-badge {
  background: #16A34A;
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'DM Mono', monospace;
}
.takeaways-label {
  font-size: 12px;
  font-weight: 700;
  color: #166534;
}
.takeaways-list {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.takeaways-list li {
  font-size: 13.5px;
  color: #14532D;
  line-height: 1.6;
}

/* Reader Reactions Box */
.bkp-reactions-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 20px 24px;
  margin: 28px 0;
  text-align: center;
}
.reactions-title-row {
  margin-bottom: 14px;
}
.reaction-tag {
  font-family: 'DM Mono', monospace;
  font-size: 10.5px;
  font-weight: 800;
  color: #64748B;
  letter-spacing: 0.5px;
}
.reaction-heading {
  font-size: 16px;
  font-weight: 800;
  color: #0F172A;
  margin: 4px 0 0;
}
.reactions-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.reaction-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #FFFFFF;
  border: 1.5px solid #CBD5E1;
  padding: 10px 18px;
  border-radius: 30px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  transition: all 0.15s ease;
}
.reaction-btn:hover {
  border-color: #060D81;
  color: #060D81;
  transform: translateY(-1px);
}
.reaction-btn.active {
  background: #EEF2FF;
  border-color: #060D81;
  color: #060D81;
  box-shadow: 0 2px 6px rgba(6, 13, 129, 0.15);
}
.reaction-emoji {
  font-size: 18px;
}
.reaction-count {
  background: #F1F5F9;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

/* Author Profile Card */
.bkp-author-profile-card {
  display: flex;
  gap: 18px;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 20px;
  margin: 28px 0;
  align-items: flex-start;
}
.author-avatar-circle {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  display: grid;
  place-items: center;
  font-size: 24px;
}
.author-info-col {
  flex: 1;
}
.author-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.author-name {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  margin: 0;
}
.author-role-badge {
  background: #EFF6FF;
  color: #1D4ED8;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.author-fc-verified {
  background: #F0FDF4;
  color: #15803D;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'DM Mono', monospace;
}
.author-bio {
  font-size: 13px;
  color: #4B5563;
  line-height: 1.6;
  margin: 0 0 10px;
}
.author-links {
  display: flex;
  gap: 16px;
}
.author-link {
  font-size: 12px;
  color: #060D81;
  font-weight: 700;
  text-decoration: underline;
}

/* Prev / Next Article Navigation */
.bkp-prev-next-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 28px 0;
}
.pn-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  background: #FFFFFF;
  text-decoration: none;
  transition: all 0.15s ease;
}
.pn-card:hover {
  border-color: #060D81;
  box-shadow: 0 4px 12px rgba(6, 13, 129, 0.08);
}
.pn-card.empty {
  border: 0;
  background: transparent;
}
.pn-direction {
  font-family: 'DM Mono', monospace;
  font-size: 10.5px;
  font-weight: 800;
  color: #060D81;
  margin-bottom: 6px;
}
.pn-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 10. Newspaper Print Stylesheet (@media print) */
@media print {
  .reading-progress-track,
  .bkp-breadcrumb-nav,
  .bkp-share-tools,
  .bkp-mobile-reading-bar,
  .bkp-col-side,
  .affiliate-cta-wrapper,
  .bkp-reactions-box,
  .bkp-prev-next-nav,
  .bkp-header-wrapper,
  .bkp-mobile-bottom-nav,
  .bkp-related-section,
  .ad-slot-container {
    display: none !important;
  }
  .bkp-article-page {
    padding: 0 !important;
    max-width: 100% !important;
  }
  .bkp-highlight-row {
    display: block !important;
  }
  .bkp-col-main {
    width: 100% !important;
    max-width: 100% !important;
  }
  body, .bkp-theme-root {
    background: #FFFFFF !important;
    color: #000000 !important;
    font-size: 11pt !important;
  }
  .bkp-article-headline {
    font-size: 22pt !important;
    color: #000000 !important;
    line-height: 1.2 !important;
  }
  .bkp-article-content-html {
    color: #111111 !important;
    line-height: 1.6 !important;
  }
}
</style>

