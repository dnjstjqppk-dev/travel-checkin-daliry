<script setup lang="ts">
import { renderMarkdown } from '~/utils/render-markdown'
import type { Article } from '~/stores/articles'
import { FALLBACK_COVER_IMAGE, categoryCoverImage } from '~/utils/editorial-media'
import { HREFLANG, LOCALES, type LocaleCode } from '~/config/locales'

const route = useRoute()
const store = useArticlesStore()
const { locale, t, locUrl, formatDate, formatNumber, categoryLabel, placeName } = useI18n()
const category = String(route.params.category)

let article: Article
try {
  article = await store.loadById(String(route.params.id), category, locale.value)
} catch {
  throw createError({ statusCode: 404, statusMessage: 'Article not found', fatal: true })
}

const SUPPORTED = LOCALES

function headingId(text: string): string {
  return 'sec-' + text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-|-$)/g, '')
}

const html = computed(() => renderMarkdown(article.content || ''))

const tocItems = computed(() => (article.content || '').split('\n')
  .map(line => /^(#{2,3})\s+(.+)$/.exec(line))
  .filter((match): match is RegExpExecArray => Boolean(match?.[2]))
  .map(match => {
    const text = match[2]!.trim().replace(/\*\*/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1')
    return { id: headingId(text), text, level: match[1]!.length }
  }))

const apiFetch = useRequestFetch()
const { data: relatedData } = await useAsyncData(
  `article-related-${article.id}-${locale.value}`,
  () => apiFetch<Article[]>('/api/articles', { query: { category: article.category, limit: 7, lang: locale.value } }).catch(() => [] as Article[]),
  { default: () => [] as Article[] },
)
const relatedArticles = computed(() => (relatedData.value || []).filter(item => item.id !== article.id).slice(0, 3))

const { data: popularData } = await useAsyncData(
  `article-most-read-${locale.value}`,
  () => apiFetch<Article[]>('/api/articles', { query: { limit: 5, sort: 'views', lang: locale.value } }).catch(() => [] as Article[]),
  { default: () => [] as Article[] },
)

const categoryName = computed(() => categoryLabel(article.category || category))
const displayAuthor = computed(() => article.author || t('newsroom'))
const publishedAt = computed(() => article.firstPublishedAt || article.publishedAt)
const wasUpdated = computed(() => Boolean(article.updatedAt && publishedAt.value
  && new Date(article.updatedAt).getTime() - new Date(publishedAt.value).getTime() > 60_000))
const readingMinutes = computed(() => article.readingTimeMinutes || Math.max(1, Math.round((article.content || '').length / 500)))
const takeaways = computed(() => (article.keyTakeaways || []).filter(Boolean))

// Cover image with category and local fallbacks — never render a broken image.
const coverSrc = ref(article.coverImage && /^(https?:\/\/|\/)/.test(article.coverImage) ? article.coverImage : categoryCoverImage(article.category))
function onCoverError() {
  coverSrc.value = coverSrc.value === FALLBACK_COVER_IMAGE ? '' : FALLBACK_COVER_IMAGE
}

// SEO
const { origin: siteOrigin } = useSiteDomain()
const availableLanguages = computed<LocaleCode[]>(() => (article.availableLanguages?.length ? article.availableLanguages : ['ko'])
  .filter((lang): lang is LocaleCode => (SUPPORTED as readonly string[]).includes(lang)))
const articlePath = (lang: string) => `${lang === 'ko' ? '' : `/${lang}`}/news/${article.category}/article/${article.id}`
const hasLocalizedVersion = computed(() => availableLanguages.value.includes(locale.value))
// Untranslated locale views show the Korean original, so they canonicalise to it.
const canonicalUrl = computed(() => `${siteOrigin.value}${articlePath(hasLocalizedVersion.value ? locale.value : 'ko')}`)
const shareImage = computed(() => (coverSrc.value?.startsWith('/') ? `${siteOrigin.value}${coverSrc.value}` : coverSrc.value) || `${siteOrigin.value}/images/og-default.png`)
const description = computed(() => article.metaDescription || article.summary || '')

useSeoMeta({
  title: () => `${article.title} | Check-in Daily`,
  description,
  ogTitle: () => article.title,
  ogDescription: description,
  ogType: 'article',
  ogUrl: canonicalUrl,
  ogImage: shareImage,
  ogLocale: () => HREFLANG[locale.value],
  twitterCard: 'summary_large_image',
  twitterTitle: () => article.title,
  twitterDescription: description,
  twitterImage: shareImage,
  articlePublishedTime: () => publishedAt.value || undefined,
  articleModifiedTime: () => article.updatedAt || publishedAt.value || undefined,
  articleSection: categoryName,
  articleTag: () => (article.tags || []).map(tag => tag.name),
  robots: () => (hasLocalizedVersion.value ? 'index, follow, max-image-preview:large' : 'noindex, follow'),
})

useHead(() => ({
  link: [
    { rel: 'canonical', href: canonicalUrl.value },
    ...availableLanguages.value.map(lang => ({ rel: 'alternate' as const, hreflang: HREFLANG[lang], href: `${siteOrigin.value}${articlePath(lang)}` })),
    { rel: 'alternate' as const, hreflang: 'x-default', href: `${siteOrigin.value}${articlePath('ko')}` },
  ],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'NewsArticle',
          '@id': `${canonicalUrl.value}#article`,
          mainEntityOfPage: canonicalUrl.value,
          headline: article.title.slice(0, 110),
          description: description.value,
          image: [shareImage.value],
          datePublished: publishedAt.value,
          dateModified: article.updatedAt || publishedAt.value,
          inLanguage: HREFLANG[hasLocalizedVersion.value ? locale.value : 'ko'],
          articleSection: categoryName.value,
          keywords: (article.tags || []).map(tag => tag.name).join(', ') || undefined,
          isAccessibleForFree: true,
          author: { '@type': 'Organization', name: displayAuthor.value, url: siteOrigin.value },
          publisher: {
            '@type': 'NewsMediaOrganization',
            name: 'Check-in Daily',
            url: siteOrigin.value,
            logo: { '@type': 'ImageObject', url: `${siteOrigin.value}/logo.svg` },
            ethicsPolicy: `${siteOrigin.value}/policy`,
            correctionsPolicy: `${siteOrigin.value}/corrections`,
          },
          ...(article.sourceUrl ? { isBasedOn: article.sourceUrl } : {}),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: t('home'), item: `${siteOrigin.value}${locUrl('/news')}` },
            { '@type': 'ListItem', position: 2, name: categoryName.value, item: `${siteOrigin.value}${locUrl(`/news/${article.category}`)}` },
            { '@type': 'ListItem', position: 3, name: article.title, item: canonicalUrl.value },
          ],
        },
      ],
    }),
  }],
}))

// Reader tools
const fontSize = ref<'normal' | 'large' | 'xlarge'>('normal')
const fontLabel = computed(() => t(`font_${fontSize.value}`))
function cycleFontSize() {
  fontSize.value = fontSize.value === 'normal' ? 'large' : fontSize.value === 'large' ? 'xlarge' : 'normal'
}

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(canonicalUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    copied.value = false
  }
}

function track(eventType: 'share') {
  $fetch('/api/analytics/track', { method: 'POST', body: { eventType, articleId: article.id } }).catch(() => {})
}

const shareTargets = computed(() => {
  const url = encodeURIComponent(canonicalUrl.value)
  const text = encodeURIComponent(article.title)
  return [
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${text}&url=${url}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
  ]
})

async function nativeShare() {
  track('share')
  if (navigator.share) {
    await navigator.share({ title: article.title, text: article.summary, url: canonicalUrl.value }).catch(() => {})
  } else {
    await copyLink()
  }
}

// Reactions
const { data: reactionsData } = await useAsyncData(
  `reactions-${article.id}`,
  () => apiFetch<{ counts: Record<'helpful' | 'insightful' | 'recommend', number>; userReactions: string[] }>(`/api/reactions/${article.id}`)
    .catch(() => ({ counts: { helpful: 0, insightful: 0, recommend: 0 }, userReactions: [] as string[] })),
  { default: () => ({ counts: { helpful: 0, insightful: 0, recommend: 0 }, userReactions: [] as string[] }) },
)
const reactionTypes = ['helpful', 'insightful', 'recommend'] as const
async function react(type: typeof reactionTypes[number]) {
  try {
    const res = await $fetch<{ active: boolean; counts: Record<'helpful' | 'insightful' | 'recommend', number> }>(`/api/reactions/${article.id}`, {
      method: 'POST', body: { reactionType: type },
    })
    if (!reactionsData.value) return
    reactionsData.value.counts = res.counts
    reactionsData.value.userReactions = res.active
      ? [...reactionsData.value.userReactions, type]
      : reactionsData.value.userReactions.filter(item => item !== type)
  } catch {
    // reactions are optional; failure leaves counts unchanged
  }
}

// Reading progress and body-image fallbacks
const progress = ref(0)
const bodyRef = ref<HTMLElement | null>(null)
function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight
  progress.value = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  bodyRef.value?.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', () => {
      if (img.dataset.fallback) { img.closest('figure')?.remove(); return }
      img.dataset.fallback = '1'
      img.src = FALLBACK_COVER_IMAGE
    }, { once: false })
  })
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))

const factStatusLabel = (status?: string) => t(`status_${(status || 'unverified').toLowerCase()}`)
</script>

<template>
  <div class="article-page">
    <div class="progress" aria-hidden="true"><span :style="{ width: `${progress}%` }" /></div>

    <nav class="crumbs" :aria-label="t('breadcrumb')">
      <NuxtLink :to="locUrl('/news')">{{ t('home') }}</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink :to="locUrl(`/news/${article.category}`)">{{ categoryName }}</NuxtLink>
    </nav>

    <div class="layout">
      <article class="story">
        <header class="story-header">
          <p class="kicker">
            <span v-if="article.isBreaking" class="breaking">{{ t('breaking') }}</span>
            <NuxtLink :to="locUrl(`/news/${article.category}`)">{{ categoryName }}</NuxtLink>
          </p>
          <h1 class="headline">{{ article.title }}</h1>
          <p v-if="article.summary" class="standfirst">{{ article.summary }}</p>

          <div class="byline">
            <div class="byline-meta">
              <strong>{{ displayAuthor }}</strong>
              <span v-if="publishedAt">{{ t('published_label') }} <time :datetime="publishedAt">{{ formatDate(publishedAt, true) }}</time></span>
              <span v-if="wasUpdated">{{ t('updated_label') }} <time :datetime="article.updatedAt">{{ formatDate(article.updatedAt, true) }}</time></span>
              <span>{{ t('reading_time', { n: readingMinutes }) }}</span>
              <span v-if="article.viewCount">{{ t('views_count', { n: formatNumber(article.viewCount) }) }}</span>
            </div>
            <div class="tools">
              <button type="button" class="tool" :aria-label="t('font_size')" @click="cycleFontSize">가<sup>+</sup> {{ fontLabel }}</button>
              <button type="button" class="tool" @click="copyLink">{{ copied ? t('copied') : t('copy_link') }}</button>
              <button type="button" class="tool" @click="nativeShare">{{ t('share') }}</button>
            </div>
          </div>
        </header>

        <figure v-if="coverSrc" class="cover">
          <img :src="coverSrc" :alt="article.title" fetchpriority="high" decoding="async" @error="onCoverError">
          <figcaption v-if="article.isAiGenerated">{{ t('file_photo') }}</figcaption>
        </figure>

        <section v-if="takeaways.length" class="takeaways" :aria-label="t('key_takeaways')">
          <h2>{{ t('key_takeaways') }}</h2>
          <ul>
            <li v-for="(point, index) in takeaways" :key="index">{{ point }}</li>
          </ul>
        </section>

        <nav v-if="tocItems.length >= 3" class="toc" :aria-label="t('table_of_contents')">
          <h2>{{ t('table_of_contents') }}</h2>
          <ol>
            <li v-for="item in tocItems" :key="item.id" :class="`level-${item.level}`"><a :href="`#${item.id}`">{{ item.text }}</a></li>
          </ol>
        </nav>

        <AdSlot placement-id="article_top" />

        <!-- eslint-disable-next-line vue/no-v-html -- sanitized with DOMPurify -->
        <div ref="bodyRef" class="body" :class="`size-${fontSize}`" v-html="html" />

        <div v-if="article.corrections?.length" class="corrections" role="note">
          <h2>{{ t('correction_notice') }}</h2>
          <div v-for="(item, index) in article.corrections" :key="index" class="correction">
            <p><strong>{{ t('correction_reason') }}:</strong> {{ item.reason }} · <time :datetime="item.corrected_at">{{ formatDate(item.corrected_at) }}</time></p>
            <p><del>{{ item.original_statement }}</del> → <strong>{{ item.corrected_statement }}</strong></p>
          </div>
        </div>

        <section class="provenance" :aria-label="t('source_label')">
          <p v-if="article.sourceName || article.sourceUrl" class="source">
            <span class="label">{{ t('source_label') }}</span>
            <a v-if="article.sourceUrl" :href="article.sourceUrl" target="_blank" rel="noopener noreferrer nofollow">
              {{ article.sourceName || article.sourceUrl }} ↗
            </a>
            <span v-else>{{ article.sourceName }}</span>
          </p>
          <div v-if="article.factChecks?.length" class="claims">
            <span class="label">{{ t('claims_label') }}</span>
            <ul>
              <li v-for="(fc, index) in article.factChecks" :key="index">
                {{ fc.claim }} <em :class="`status-${(fc.verification_status || 'unverified').toLowerCase()}`">{{ factStatusLabel(fc.verification_status) }}</em>
              </li>
            </ul>
          </div>
          <p v-if="article.isAiGenerated" class="disclosure">{{ t('ai_disclosure') }}</p>
          <p class="policy-links">
            <NuxtLink :to="locUrl('/corrections')">{{ t('request_correction') }}</NuxtLink>
            <NuxtLink :to="locUrl('/policy')">{{ t('editorial_policy') }}</NuxtLink>
          </p>
        </section>

        <div v-if="article.tags?.length" class="tags" :aria-label="t('tags_label')">
          <NuxtLink v-for="tag in article.tags" :key="tag.slug" :to="{ path: locUrl('/news'), query: { q: tag.name } }" class="tag">#{{ tag.name }}</NuxtLink>
        </div>
        <div v-else-if="article.cities?.length" class="tags">
          <NuxtLink v-for="city in article.cities" :key="city.id" :to="locUrl(`/news/region/${city.countryCode}/${city.id}`)" class="tag">
            #{{ placeName(city) }}
          </NuxtLink>
        </div>

        <div class="share-row">
          <span class="label">{{ t('share') }}</span>
          <a v-for="target in shareTargets" :key="target.name" :href="target.href" target="_blank" rel="noopener noreferrer"
            class="tool" :aria-label="t('share_on', { name: target.name })" @click="track('share')">{{ target.name }}</a>
          <button type="button" class="tool" @click="copyLink">{{ copied ? t('copied') : t('copy_link') }}</button>
        </div>

        <ArticleAffiliateCTA :category="article.category" :title="article.title" variant="card" />

        <section class="reactions">
          <h2>{{ t('was_helpful') }}</h2>
          <div class="reaction-row">
            <button v-for="type in reactionTypes" :key="type" type="button" class="tool"
              :aria-pressed="reactionsData.userReactions.includes(type)" @click="react(type)">
              {{ t(`reaction_${type}`) }} <span class="count">{{ formatNumber(reactionsData.counts[type]) }}</span>
            </button>
          </div>
        </section>

        <ArticleComments :article-id="article.id" />

        <nav v-if="article.prevArticle || article.nextArticle" class="prev-next">
          <NuxtLink v-if="article.prevArticle" :to="locUrl(`/news/${article.prevArticle.category}/article/${article.prevArticle.id}`)" class="pn">
            <span class="label">← {{ t('prev_article') }}</span>
            <span>{{ article.prevArticle.title }}</span>
          </NuxtLink>
          <span v-else />
          <NuxtLink v-if="article.nextArticle" :to="locUrl(`/news/${article.nextArticle.category}/article/${article.nextArticle.id}`)" class="pn next">
            <span class="label">{{ t('next_article') }} →</span>
            <span>{{ article.nextArticle.title }}</span>
          </NuxtLink>
        </nav>

        <AdSlot placement-id="article_bottom" />

        <section v-if="relatedArticles.length" class="related">
          <div class="section-head">
            <h2>{{ t('related_stories') }}</h2>
            <NuxtLink :to="locUrl(`/news/${article.category}`)">{{ t('more') }} →</NuxtLink>
          </div>
          <div class="related-grid">
            <NewsArticleCard v-for="item in relatedArticles" :key="item.id" :article="item" />
          </div>
        </section>
      </article>

      <aside class="rail">
        <div class="rail-sticky">
          <section v-if="popularData.length" class="most-read">
            <h2>{{ t('most_read') }}</h2>
            <ol>
              <li v-for="(item, index) in popularData" :key="item.id">
                <span class="rank">{{ index + 1 }}</span>
                <NuxtLink :to="locUrl(`/news/${item.category}/article/${item.id}`)">{{ item.title }}</NuxtLink>
              </li>
            </ol>
          </section>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.article-page { width: min(1200px, 100%); margin: 0 auto; padding: 20px 20px 96px; color: var(--text-base); }
.progress { position: fixed; inset: 0 0 auto; height: 3px; z-index: 200; pointer-events: none; }
.progress span { display: block; height: 100%; background: var(--accent); transition: width 0.1s linear; }

.crumbs { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
.crumbs a:hover { color: var(--accent); }

.layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 56px; align-items: start; }
.story { min-width: 0; max-width: 720px; }

.kicker { display: flex; gap: 10px; align-items: center; margin: 0 0 14px; font-size: 13px; font-weight: 700; color: var(--accent); }
.breaking { padding: 2px 8px; border-radius: 4px; background: var(--red); color: #fff; font-size: 12px; }
.headline { margin: 0; font-family: var(--font-display); font-size: clamp(28px, 4.2vw, 42px); line-height: 1.22; font-weight: 700; color: var(--text-primary); letter-spacing: -0.015em; word-break: keep-all; overflow-wrap: anywhere; }
.standfirst { margin: 18px 0 0; font-size: 19px; line-height: 1.65; color: var(--text-secondary); word-break: keep-all; }

.byline { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px; margin-top: 24px; padding: 14px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.byline-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13.5px; color: var(--text-muted); }
.byline-meta strong { color: var(--text-primary); }
.tools, .share-row, .reaction-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.tool { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-card); color: var(--text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
.tool:hover, .tool[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
.tool .count { font-variant-numeric: tabular-nums; color: var(--text-muted); }

.cover { margin: 28px 0 0; }
.cover img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px; background: var(--bg-surface); }
.cover figcaption, .body :deep(figcaption) { margin-top: 8px; font-size: 13px; color: var(--text-muted); }

.takeaways { margin: 32px 0 0; padding: 20px 24px; border-left: 3px solid var(--accent); background: var(--accent-dim); border-radius: 0 6px 6px 0; }
.takeaways h2, .toc h2 { margin: 0 0 12px; font-family: var(--font-sans); font-size: 14px; font-weight: 800; letter-spacing: 0.02em; color: var(--text-primary); }
.takeaways ul { margin: 0; padding-left: 20px; display: grid; gap: 8px; }
.takeaways li { font-size: 16px; line-height: 1.6; }

.toc { margin: 24px 0 0; padding: 16px 20px; border: 1px solid var(--border); border-radius: 6px; }
.toc ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 15px; }
.toc .level-3 { margin-left: 14px; }
.toc a:hover { color: var(--accent); }

.body { margin-top: 32px; max-width: 68ch; font-size: 18px; line-height: 1.85; color: var(--text-base); word-break: keep-all; overflow-wrap: anywhere; }
.body.size-large { font-size: 20px; }
.body.size-xlarge { font-size: 22px; }
.body :deep(p) { margin: 0 0 1.25em; }
.body :deep(h2) { margin: 2em 0 0.7em; font-family: var(--font-display); font-size: 1.35em; line-height: 1.35; color: var(--text-primary); scroll-margin-top: 90px; }
.body :deep(h3) { margin: 1.6em 0 0.6em; font-size: 1.12em; color: var(--text-primary); scroll-margin-top: 90px; }
.body :deep(a) { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.body :deep(blockquote) { margin: 1.5em 0; padding: 4px 0 4px 18px; border-left: 3px solid var(--border-strong); color: var(--text-secondary); }
.body :deep(ul), .body :deep(ol) { padding-left: 1.4em; margin: 0 0 1.25em; }
.body :deep(li) { margin-bottom: 0.4em; }
.body :deep(.body-figure) { margin: 2em 0; }
.body :deep(.body-figure img) { display: block; width: 100%; height: auto; border-radius: 6px; background: var(--bg-surface); }
.body :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 0.9em; }
.body :deep(th), .body :deep(td) { padding: 8px 10px; border: 1px solid var(--border); }

.corrections { margin: 32px 0 0; padding: 16px 20px; border: 1px solid var(--amber); background: var(--amber-dim); border-radius: 6px; }
.corrections h2 { margin: 0 0 8px; font-size: 15px; font-family: var(--font-sans); }
.correction p { margin: 4px 0; font-size: 14.5px; line-height: 1.6; }

.provenance { margin: 36px 0 0; padding: 18px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); display: grid; gap: 12px; font-size: 14.5px; line-height: 1.6; }
.provenance .label, .share-row .label { display: inline-block; margin-right: 8px; font-size: 12.5px; font-weight: 800; color: var(--text-muted); }
.provenance a { color: var(--accent); }
.claims ul { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 4px; }
.claims em { margin-left: 6px; font-style: normal; font-size: 12px; font-weight: 700; color: var(--text-muted); }
.claims em.status-verified { color: var(--accent); }
.claims em.status-disputed { color: var(--red); }
.disclosure { margin: 0; padding: 10px 14px; border-radius: 6px; background: var(--bg-surface); color: var(--text-secondary); font-size: 13.5px; }
.policy-links { display: flex; gap: 16px; margin: 0; font-size: 13px; }
.policy-links a { color: var(--text-muted); text-decoration: underline; text-underline-offset: 3px; }

.tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.tag { padding: 6px 12px; border-radius: 999px; background: var(--bg-surface); font-size: 13.5px; color: var(--text-secondary); }
.tag:hover { color: var(--accent); }
.share-row { margin-top: 24px; }

.reactions { margin-top: 40px; }
.reactions h2, .related h2, .most-read h2 { margin: 0 0 14px; font-family: var(--font-sans); font-size: 17px; font-weight: 800; color: var(--text-primary); }

.prev-next { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 40px; }
.pn { display: grid; gap: 6px; padding: 16px; border: 1px solid var(--border); border-radius: 6px; font-size: 15px; line-height: 1.45; color: var(--text-primary); }
.pn.next { text-align: right; }
.pn .label { font-size: 12.5px; font-weight: 700; color: var(--text-muted); }
.pn:hover { border-color: var(--accent); }

.related { margin-top: 48px; }
.section-head { display: flex; justify-content: space-between; align-items: baseline; }
.section-head a { font-size: 13.5px; color: var(--accent); font-weight: 700; }
.related-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }

.rail-sticky { position: sticky; top: 96px; display: grid; gap: 28px; }
.most-read ol { list-style: none; margin: 0; padding: 0; display: grid; }
.most-read li { display: grid; grid-template-columns: 28px 1fr; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 15px; line-height: 1.45; font-weight: 600; }
.most-read .rank { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--accent); }
.most-read a:hover { color: var(--accent); }

@media (max-width: 1024px) {
  .layout { grid-template-columns: 1fr; gap: 40px; }
  .story { max-width: none; }
  .rail-sticky { position: static; }
}
@media (max-width: 640px) {
  .article-page { padding: 14px 16px 72px; }
  .standfirst { font-size: 17px; }
  .body { font-size: 17px; }
  .body.size-large { font-size: 19px; }
  .body.size-xlarge { font-size: 21px; }
  .related-grid, .prev-next { grid-template-columns: 1fr; }
  .pn.next { text-align: left; }
}
</style>
