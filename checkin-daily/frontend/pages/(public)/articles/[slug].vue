<script setup lang="ts">
const route = useRoute()
const store = useArticlesStore()
const slug = String(route.params.slug)

let article: any = null
try {
  article = await store.loadOne(slug)
} catch {
  throw createError({ statusCode: 404, statusMessage: '기사를 찾을 수 없습니다.' })
}

if (article && article.id && article.category) {
  await navigateTo(`/news/${encodeURIComponent(article.category)}/article/${article.id}`, {
    redirectCode: 301,
    external: false,
  })
} else {
  throw createError({ statusCode: 404, statusMessage: '기사를 찾을 수 없습니다.' })
}
</script>

<template>
  <div class="redirecting-notice">
    <p>기사 페이지로 이동 중입니다...</p>
  </div>
</template>