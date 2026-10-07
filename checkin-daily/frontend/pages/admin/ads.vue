<script setup lang="ts">
import type { AdPlacement } from '~/stores/articles'

const store = useArticlesStore()
const placements = ref(await store.loadAdPlacements(true))
const form = reactive<AdPlacement>({
  id: '',
  name: '',
  adClientId: '',
  adSlotId: '',
  format: 'auto',
  isActive: false,
})
const editingId = ref('')
const saving = ref(false)
const error = ref('')

function editPlacement(placement: AdPlacement) {
  editingId.value = placement.id
  Object.assign(form, placement)
}

function resetForm() {
  editingId.value = ''
  Object.assign(form, { id: '', name: '', adClientId: '', adSlotId: '', format: 'auto', isActive: false })
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const placement = await store.saveAdPlacement({ ...form }, editingId.value || undefined)
    const index = placements.value.findIndex((item) => item.id === placement.id)
    if (index < 0) placements.value.push(placement)
    else placements.value[index] = placement
    resetForm()
  } catch {
    error.value = '저장하지 못했습니다. 활성 광고에는 올바른 AdSense 클라이언트 ID와 슬롯 ID가 필요합니다.'
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  error.value = ''
  try {
    await store.removeAdPlacement(id)
    placements.value = placements.value.filter((item) => item.id !== id)
    if (editingId.value === id) resetForm()
  } catch {
    error.value = '광고 슬롯을 삭제하지 못했습니다.'
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-top"><div><p class="eyebrow">EDITOR ROOM / MONETIZATION</p><h1>광고 슬롯 관리</h1></div><NuxtLink class="button" to="/admin/dashboard">기사 목록</NuxtLink></div>
    <p class="picker-hint">AdSense 설정을 저장하면 해당 슬롯이 활성화됩니다. 스크립트는 AdSlot 컴포넌트에서 안전한 Google 제공 URL로 로드합니다.</p>
    <form class="editor-form" @submit.prevent="save">
      <label class="field">슬롯 키<input v-model="form.id" required maxlength="50" :disabled="Boolean(editingId)" placeholder="main_top"></label>
      <label class="field">관리자 표시 이름<input v-model="form.name" required maxlength="100"></label>
      <label class="field">클라이언트 ID<input v-model="form.adClientId" maxlength="100" placeholder="ca-pub-0000000000000000"></label>
      <label class="field">광고 슬롯 ID<input v-model="form.adSlotId" maxlength="100" inputmode="numeric"></label>
      <label class="field">광고 형식<select v-model="form.format"><option value="auto">반응형 자동</option><option value="rectangle">사각형</option><option value="horizontal">가로형</option><option value="vertical">세로형</option></select></label>
      <label class="toggle-field"><input v-model="form.isActive" type="checkbox"> 슬롯 활성화</label>
      <p v-if="error" class="form-error full-field">{{ error }}</p>
      <div class="form-actions"><button v-if="editingId" class="button" type="button" @click="resetForm">취소</button><button class="button button-primary" :disabled="saving">{{ saving ? '저장 중...' : editingId ? '변경 저장' : '슬롯 등록' }}</button></div>
    </form>
    <table class="admin-table ads-table"><thead><tr><th>이름</th><th>슬롯 키</th><th>광고 단위</th><th>상태</th><th>관리</th></tr></thead><tbody>
      <tr v-for="placement in placements" :key="placement.id">
        <td>{{ placement.name }}</td><td>{{ placement.id }}</td><td>{{ placement.adClientId || '미설정' }} / {{ placement.adSlotId || '미설정' }}</td>
        <td><span class="status" :class="{ draft: !placement.isActive }">{{ placement.isActive ? 'ON' : 'OFF' }}</span></td>
        <td><button class="button" type="button" @click="editPlacement(placement)">수정</button><button class="button button-danger" type="button" @click="remove(placement.id)">삭제</button></td>
      </tr>
    </tbody></table>
  </section>
</template>
