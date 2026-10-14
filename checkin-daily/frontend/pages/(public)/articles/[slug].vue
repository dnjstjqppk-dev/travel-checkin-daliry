<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

const route = useRoute()
const store = useArticlesStore()
const article = await store.loadOne(String(route.params.slug))
const html = DOMPurify.sanitize(await marked.parse(article.content || ''))
const savedStore = useSavedStore()
const categoryNames: Record<string, string> = { flights: '항공', hotels: '호텔', industry: '업계' }
useSeoMeta({ title: `${article.title} | 체크인데일리`, description: article.summary })

function hasCoverImage(value: string) {
  return /^https:\/\//i.test(value)
}
</script>

<template>
  <article class="page-wrap article-detail">
    <p class="eyebrow">{{ categoryNames[article.category] || article.category }} / CHECK-IN DAILY</p>
    <h1>{{ article.title }}</h1>
    <p class="article-summary">{{ article.summary }}</p>
    <p class="meta">{{ article.author }} · {{ article.publishedAt?.slice(0, 10) }} · 조회 {{ (article.viewCount || 0).toLocaleString('ko-KR') }}</p>
    <button class="save-button" type="button" @click="savedStore.toggle(article.slug)">{{ savedStore.has(article.slug) ? '저장됨' : '+ 스크랩' }}</button>
    <AdSlot placement-id="article_top" />
    <div class="article-art article-cover" :class="`category-art-${article.category}`">
      <img v-if="hasCoverImage(article.coverImage)" :src="article.coverImage" :alt="article.title" fetchpriority="high">
    </div>
    <AdSlot placement-id="article_mid" />
    <div class="article-body" v-html="html" />
    <AdSlot placement-id="article_bottom" />
    <AdSlot placement-id="article_related" />
  </article>
</template>