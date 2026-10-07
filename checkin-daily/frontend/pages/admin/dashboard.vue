<script setup lang="ts">
const store = useArticlesStore()
await useAsyncData('admin-articles', () => store.load('', true))
const deleting = ref<number | null>(null)

async function removeArticle(id: number) {
  if (!window.confirm('이 기사를 삭제할까요?')) return
  deleting.value = id
  try { await store.remove(id) } finally { deleting.value = null }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-top"><div><p class="eyebrow">EDITOR ROOM / CMS</p><h1>기사 관리</h1></div><div class="admin-shortcuts"><NuxtLink class="button" to="/admin/categories">카테고리 관리</NuxtLink><NuxtLink class="button" to="/admin/locations">국가·도시 관리</NuxtLink><NuxtLink class="button" to="/admin/ads">광고 관리</NuxtLink><NuxtLink class="button button-primary" to="/admin/articles/new">+ 새 기사 작성</NuxtLink></div></div>
    <p v-if="store.error" class="empty-state">{{ store.error }}</p>
    <p v-else-if="!store.articles.length" class="empty-state">등록된 기사가 없습니다.</p>
    <table v-else class="admin-table"><thead><tr><th>ARTICLE</th><th>CATEGORY</th><th>LOCATIONS</th><th>STATUS</th><th>DATE</th><th>ACTIONS</th></tr></thead><tbody>
      <tr v-for="article in store.articles" :key="article.id"><td>{{ article.title }}</td><td>{{ article.category }}</td><td>{{ article.cities?.map((city) => `${city.countryCode}/${city.id}`).join(', ') || '-' }}</td><td><span class="status" :class="{ draft: article.status === 'draft' }">{{ article.status === 'published' ? '발행' : '초안' }}</span></td><td>{{ article.publishedAt?.slice(0, 10) || '-' }}</td><td><NuxtLink :to="`/admin/articles/${article.id}`">수정</NuxtLink><button class="button button-danger" :disabled="deleting === article.id" @click="removeArticle(article.id)">삭제</button></td></tr>
    </tbody></table>
  </section>
</template>