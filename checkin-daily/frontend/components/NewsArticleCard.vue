<script setup lang="ts">
import type { Article } from '~/stores/articles'
import { FALLBACK_COVER_IMAGE, categoryCoverImage } from '~/utils/editorial-media'

const props = withDefaults(defineProps<{
  article: Article
  rank?: number
  /** Search term to highlight in title and summary. */
  highlight?: string
  variant?: 'default' | 'compact'
}>(), { rank: undefined, highlight: '', variant: 'default' })

const { t, locUrl, formatDate, formatNumber, categoryLabel } = useI18n()

const initialCover = props.article.coverImage && /^(https?:\/\/|\/)/.test(props.article.coverImage)
  ? props.article.coverImage
  : categoryCoverImage(props.article.category)
const coverSrc = ref(initialCover)
function onCoverError() {
  coverSrc.value = coverSrc.value === FALLBACK_COVER_IMAGE ? '' : FALLBACK_COVER_IMAGE
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Escapes text first, then wraps case-insensitive matches in <mark>. */
function highlightText(value: string): string {
  const safe = escapeHtml(value || '')
  const term = props.highlight.trim()
  if (!term) return safe
  const pattern = new RegExp(`(${escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return safe.replace(pattern, '<mark>$1</mark>')
}

const href = computed(() => locUrl(`/news/${props.article.category}/article/${props.article.id}`))
</script>

<template>
  <article class="card" :class="`card-${variant}`">
    <NuxtLink :to="href" class="card-link">
      <div v-if="variant === 'default'" class="thumb">
        <img v-if="coverSrc" :src="coverSrc" :alt="article.title" loading="lazy" decoding="async" @error="onCoverError">
        <span v-if="rank" class="rank" :class="{ top: rank <= 3 }">{{ rank }}</span>
      </div>
      <div class="info">
        <p class="meta">
          <span class="cat">{{ categoryLabel(article.category) }}</span>
          <time v-if="article.publishedAt" :datetime="article.publishedAt">{{ formatDate(article.publishedAt) }}</time>
          <span v-if="article.viewCount" class="views">{{ t('views_count', { n: formatNumber(article.viewCount) }) }}</span>
        </p>
        <!-- eslint-disable-next-line vue/no-v-html -- escaped before highlighting -->
        <h3 class="title" v-html="highlightText(article.title)" />
        <!-- eslint-disable-next-line vue/no-v-html -- escaped before highlighting -->
        <p v-if="variant === 'default' && article.summary" class="summary" v-html="highlightText(article.summary)" />
      </div>
    </NuxtLink>
  </article>
</template>

<style scoped>
.card { min-width: 0; }
.card-link { display: grid; gap: 12px; color: inherit; }
.thumb { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-radius: 6px; background: var(--bg-surface); }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
.card-link:hover .thumb img { transform: scale(1.03); }
.rank { position: absolute; top: 8px; left: 8px; min-width: 28px; height: 28px; display: grid; place-items: center; padding: 0 6px; border-radius: 6px; background: rgba(15, 23, 42, 0.78); color: #fff; font-weight: 800; font-size: 14px; }
.rank.top { background: var(--accent); }
.info { display: grid; gap: 6px; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 0; font-size: 12.5px; color: var(--text-muted); }
.cat { font-weight: 800; color: var(--accent); }
.title { margin: 0; font-family: var(--font-sans); font-size: 17.5px; line-height: 1.42; font-weight: 750; color: var(--text-primary); word-break: keep-all; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.card-link:hover .title { color: var(--accent); }
.summary { margin: 0; font-size: 14.5px; line-height: 1.6; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-compact .title { font-size: 15.5px; -webkit-line-clamp: 2; line-clamp: 2; }
:deep(mark) { background: #fef08a; color: inherit; padding: 0 1px; border-radius: 2px; }
</style>
