<script setup lang="ts">
const store = useArticlesStore()
const categories = ref(await store.loadCategories(true))
const form = reactive({ name: '', slug: '' })
const error = ref('')
const saving = ref(false)
const editingId = ref<number | null>(null)

function makeSlug() {
  if (!form.slug) form.slug = form.name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

async function addCategory() {
  saving.value = true
  error.value = ''
  try {
    const category = await store.saveCategory({ ...form }, editingId.value ?? undefined)
    if (editingId.value) {
      categories.value = categories.value.map((item) => item.id === category.id ? category : item)
    } else {
      categories.value.push(category)
    }
    form.name = ''
    form.slug = ''
    editingId.value = null
  } catch {
    error.value = '추가하지 못했습니다. 슬러그가 기존 카테고리와 겹치는지 확인해 주세요.'
  } finally { saving.value = false }
}

function editCategory(category: { id: number; name: string; slug: string }) {
  editingId.value = category.id
  form.name = category.name
  form.slug = category.slug
}

function cancelEdit() {
  editingId.value = null
  form.name = ''
  form.slug = ''
}

async function deleteCategory(id: number) {
  error.value = ''
  try {
    await store.removeCategory(id)
    categories.value = categories.value.filter((category) => category.id !== id)
  } catch {
    error.value = '기사에서 사용 중인 카테고리는 삭제할 수 없습니다.'
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-top"><div><p class="eyebrow">EDITOR ROOM / TAXONOMY</p><h1>카테고리 관리</h1></div><NuxtLink class="button" to="/admin/dashboard">기사 목록</NuxtLink></div>
    <form class="editor-form" @submit.prevent="makeSlug(); addCategory()">
      <label class="field">이름<input v-model="form.name" required maxlength="60"></label>
      <label class="field">슬러그<input v-model="form.slug" required maxlength="60"></label>
      <div class="form-actions"><button v-if="editingId" class="button" type="button" @click="cancelEdit">취소</button><button class="button button-primary" :disabled="saving">{{ editingId ? '변경 사항 저장' : '카테고리 추가' }}</button></div>
    </form>
    <p v-if="error" class="empty-state">{{ error }}</p>
    <table class="admin-table"><thead><tr><th>NAME</th><th>SLUG</th><th>ACTION</th></tr></thead><tbody>
      <tr v-for="category in categories" :key="category.id"><td>{{ category.name }}</td><td>{{ category.slug }}</td><td><button class="button" @click="editCategory(category)">수정</button><button class="button button-danger" @click="deleteCategory(category.id)">삭제</button></td></tr>
    </tbody></table>
  </section>
</template>