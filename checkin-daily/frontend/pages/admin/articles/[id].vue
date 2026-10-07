<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const store = useArticlesStore()
const config = useRuntimeConfig()
const categories = await store.loadCategories(true)
const id = Number(route.params.id)
const apiBase = import.meta.server ? config.apiInternalBase : config.public.apiBase
const article = await $fetch<Article[]>(`${apiBase}/api/admin/articles`)
const item = article.find((candidate) => candidate.id === id)
if (!item) throw createError({ statusCode: 404, statusMessage: 'Article not found' })
const form = reactive({ title: item.title, slug: item.slug, summary: item.summary, content: item.content, category: item.category, author: item.author, coverImage: item.coverImage, status: item.status, cityIds: item.cities?.map((city) => city.id) || [] })
const saving = ref(false)
const error = ref('')

async function submit() {
  saving.value = true
  error.value = ''
  try { await store.save({ ...form }, id); await router.push('/admin/dashboard') }
  catch { error.value = '저장하지 못했습니다. 고유한 슬러그인지 확인해 주세요.' }
  finally { saving.value = false }
}
</script>

<template>
  <section class="admin-wrap"><div class="admin-top"><div><p class="eyebrow">EDITOR ROOM / EDIT STORY</p><h1>기사 수정</h1></div><NuxtLink class="button" to="/admin/dashboard">목록으로</NuxtLink></div>
    <form class="editor-form" @submit.prevent="submit">
      <label class="field full">제목<input v-model="form.title" required maxlength="180"></label><label class="field">슬러그<input v-model="form.slug" required></label>
      <label class="field">카테고리<select v-model="form.category" required><option v-for="category in categories" :key="category.id" :value="category.slug">{{ category.name }}</option></select></label>
      <label class="field full">요약<input v-model="form.summary" maxlength="500"></label><label class="field">작성자<input v-model="form.author"></label>
      <label class="field">발행 상태<select v-model="form.status"><option value="draft">초안</option><option value="published">발행</option></select></label>
      <div class="field full"><LocationMultiSelect v-model="form.cityIds" :initial-country-codes="[...new Set(item.cities?.map((city) => city.countryCode) || [])]" /></div>
      <label class="field full">본문 (Markdown)<textarea v-model="form.content"></textarea></label><p v-if="error" class="empty-state">{{ error }}</p>
      <div class="form-actions"><button class="button" type="button" @click="router.push('/admin/dashboard')">취소</button><button class="button button-primary" :disabled="saving">{{ saving ? '저장 중...' : '변경 사항 저장' }}</button></div>
    </form>
  </section>
</template>