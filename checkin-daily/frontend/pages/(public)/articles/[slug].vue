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
</script>

<template>
  <article class="page-wrap article-detail">
    <p class="eyebrow">{{ categoryNames[article.category] || article.category }} / CHECK-IN DAILY</p>
    <h1>{{ article.title }}</h1>
    <p class="article-summary">{{ article.summary }}</p>
    <p class="meta">{{ article.author }} · {{ article.publishedAt?.slice(0, 10) }}</p>
    <button class="save-button" type="button" @click="savedStore.toggle(article.slug)">{{ savedStore.has(article.slug) ? '저장됨' : '+ 스크랩' }}</button>
    <div class="article-art" style="height: 270px; margin-top: 30px" aria-hidden="true" />
    <div class="article-body" v-html="html" />
  </article>
</template>