<script setup lang="ts">
const store = useArticlesStore()
const router = useRouter()
const categories = await store.loadCategories(true)
const form = reactive({ title: '', slug: '', summary: '', content: '', category: categories[0]?.slug || '', author: '체크인데일리 편집팀', coverImage: '', status: 'draft' as 'draft' | 'published', cityIds: [] as string[] })
const saving = ref(false)
const error = ref('')

function slugify() {
  if (!form.slug) form.slug = form.title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const article = await store.save({ ...form })
    await router.push('/admin/dashboard')
    return article
  } catch {
    error.value = '저장하지 못했습니다. 제목과 고유한 슬러그를 확인해 주세요.'
  } finally { saving.value = false }
}
</script>

<template>
  <section class="admin-wrap"><div class="admin-top"><div><p class="eyebrow">EDITOR ROOM / NEW STORY</p><h1>새 기사 작성</h1></div><NuxtLink class="button" to="/admin/dashboard">목록으로</NuxtLink></div>
    <form class="editor-form" @submit.prevent="submit">
      <label class="field full">제목<input v-model="form.title" required maxlength="180" @blur="slugify"></label>
      <label class="field">슬러그<input v-model="form.slug" required></label>
      <label class="field">카테고리<select v-model="form.category" required><option v-for="category in categories" :key="category.id" :value="category.slug">{{ category.name }}</option></select></label>
      <label class="field full">요약<input v-model="form.summary" maxlength="500"></label>
      <label class="field">작성자<input v-model="form.author"></label>
      <label class="field">발행 상태<select v-model="form.status"><option value="draft">초안</option><option value="published">발행</option></select></label>
      <div class="field full"><LocationMultiSelect v-model="form.cityIds" /></div>
      <label class="field full">본문 (Markdown)<textarea v-model="form.content" placeholder="# 소제목&#10;&#10;Markdown으로 기사를 작성하세요."></textarea></label>
      <p v-if="error" class="empty-state">{{ error }}</p>
      <div class="form-actions"><button class="button" type="button" @click="router.push('/admin/dashboard')">취소</button><button class="button button-primary" :disabled="saving">{{ saving ? '저장 중...' : '기사 저장' }}</button></div>
    </form>
  </section>
</template>