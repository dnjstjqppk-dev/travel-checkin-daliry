<script setup lang="ts">
import type { AdPlacement } from '~/stores/articles'

definePageMeta({ layout: 'admin' })

const store = useArticlesStore()
const placements = ref(await store.loadAdPlacements(true))
const selectedId = ref(placements.value[0]?.id ?? '')
const scriptSnippet = ref('')
const format = ref('auto')
const isActive = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

const placementGroups = computed(() => [
  { id: 'main', title: '메인 페이지', description: '홈 화면에서 주요 뉴스와 갤러리 사이에 노출됩니다.', ids: ['main_top', 'main_mid', 'main_bottom'] },
  { id: 'list', title: '뉴스 목록 페이지', description: '뉴스 카드 그리드의 일정 위치에 자연스럽게 삽입됩니다.', ids: ['list_inline_1', 'list_inline_2', 'list_inline_3'] },
  { id: 'article', title: '기사 상세 페이지', description: '기사 제목 아래, 본문 다음, 추천 기사 위에 노출됩니다.', ids: ['article_top', 'article_mid', 'article_bottom', 'article_related'] },
  { id: 'sidebar', title: '공통 사이드 영역', description: '데스크톱 보조 콘텐츠 영역입니다.', ids: ['sidebar_rect'] },
].map((group) => ({
  ...group,
  placements: group.ids.map((id) => placements.value.find((placement) => placement.id === id)).filter((placement): placement is AdPlacement => Boolean(placement)),
})))

const selectedPlacement = computed(() => placements.value.find((placement) => placement.id === selectedId.value))
const snippetStatus = computed(() => {
  if (!scriptSnippet.value.trim()) return ''
  const parsed = readAdsenseSnippet(scriptSnippet.value)
  if (!parsed.clientId || !parsed.slotId) return '광고 코드에서 게시자 ID와 광고 슬롯 ID를 모두 찾지 못했습니다.'
  return `확인됨 · ${parsed.clientId} / 슬롯 ${parsed.slotId}`
})

function readAdsenseSnippet(value: string) {
  const clientId = value.match(/data-ad-client\s*=\s*["'](ca-pub-\d+)["']/i)?.[1]
    ?? value.match(/[?&]client=(ca-pub-\d+)/i)?.[1]
    ?? ''
  const slotId = value.match(/data-ad-slot\s*=\s*["'](\d+)["']/i)?.[1] ?? ''
  return { clientId, slotId }
}

function choosePlacement(placement: AdPlacement) {
  selectedId.value = placement.id
  scriptSnippet.value = ''
  format.value = placement.format || 'auto'
  isActive.value = placement.isActive
  error.value = ''
  success.value = ''
}

async function save() {
  if (!selectedPlacement.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const pastedSnippet = scriptSnippet.value.trim()
    const parsed = pastedSnippet ? readAdsenseSnippet(pastedSnippet) : null
    if (pastedSnippet && (!parsed?.clientId || !parsed.slotId)) {
      error.value = 'Google AdSense 광고 단위 코드를 붙여넣어 주세요. 게시자 ID(ca-pub-)와 data-ad-slot 값이 필요합니다.'
      return
    }
    const next: AdPlacement = {
      ...selectedPlacement.value,
      adClientId: parsed?.clientId || selectedPlacement.value.adClientId,
      adSlotId: parsed?.slotId || selectedPlacement.value.adSlotId,
      format: format.value,
      isActive: isActive.value,
    }
    const updated = await store.saveAdPlacement(next, selectedPlacement.value.id)
    placements.value = placements.value.map((placement) => placement.id === updated.id ? updated : placement)
    scriptSnippet.value = ''
    isActive.value = updated.isActive
    success.value = updated.isActive ? '광고 위치 설정을 저장했습니다.' : '이 광고 위치를 비활성화했습니다.'
  } catch {
    error.value = '설정을 저장하지 못했습니다. Google AdSense 코드와 연결 상태를 확인해 주세요.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">MONETIZATION / AD INVENTORY</p>
        <h1>광고 위치 관리</h1>
        <p class="admin-heading-copy">각 광고가 독자 화면의 어느 위치에 노출되는지 확인하고 설정합니다.</p>
      </div>
    </div>

    <div class="ads-admin-layout">
      <div class="ads-placement-groups">
        <section v-for="group in placementGroups" :key="group.id" class="ads-placement-group">
          <div class="ads-placement-heading">
            <h2>{{ group.title }}</h2>
            <p>{{ group.description }}</p>
          </div>
          <button
            v-for="placement in group.placements"
            :key="placement.id"
            type="button"
            class="ads-placement-card"
            :class="{ selected: selectedId === placement.id }"
            @click="choosePlacement(placement)"
          >
            <span class="ads-placement-card-top">
              <strong>{{ placement.name }}</strong>
              <span class="ads-placement-state" :class="{ active: placement.isActive }">{{ placement.isActive ? '노출 중' : '미설정' }}</span>
            </span>
            <span class="ads-placement-meta"><code>{{ placement.id }}</code><span>페이지 위치 확인 · 설정 ↗</span></span>
          </button>
        </section>
      </div>

      <section v-if="selectedPlacement" class="ads-editor-card">
        <p class="admin-overline">SELECTED AD UNIT</p>
        <h2>{{ selectedPlacement.name }}</h2>
        <p class="ads-selected-location">고정 위치 <code>{{ selectedPlacement.id }}</code></p>

        <form class="ads-editor-form" @submit.prevent="save">
          <label class="field">
            Google AdSense 광고 단위 코드
            <textarea
              v-model="scriptSnippet"
              class="ads-code-input"
              rows="7"
              spellcheck="false"
              placeholder='<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-..." data-ad-slot="1234567890" data-ad-format="auto"></ins>'
            />
          </label>
          <p class="ads-editor-hint">AdSense에서 이 위치용 디스플레이 광고 단위의 코드를 복사해 붙여넣으세요. 입력한 코드는 실행하지 않고 게시자 ID와 슬롯 ID만 안전하게 추출합니다.</p>
          <p v-if="snippetStatus" class="ads-snippet-status" :class="{ invalid: snippetStatus.startsWith('광고 코드') }">{{ snippetStatus }}</p>

          <label class="field">광고 형식
            <select v-model="format">
              <option value="auto">반응형 자동</option>
              <option value="rectangle">사각형</option>
              <option value="horizontal">가로형</option>
              <option value="vertical">세로형</option>
            </select>
          </label>
          <label class="ads-active-toggle">
            <input v-model="isActive" type="checkbox">
            <span><strong>이 위치에 광고 노출</strong><small>꺼두면 사용자 화면에 광고 영역도 표시되지 않습니다.</small></span>
          </label>

          <p v-if="error" class="ads-feedback error" role="alert">{{ error }}</p>
          <p v-if="success" class="ads-feedback success" role="status">{{ success }}</p>
          <div class="form-actions">
            <button class="button button-primary" type="submit" :disabled="saving">{{ saving ? '저장 중...' : '광고 위치 저장' }}</button>
          </div>
        </form>

        <div class="ads-slot-preview">
          <span class="ads-slot-preview-label">PAGE PLACEMENT</span>
          <strong>{{ selectedPlacement.name }}</strong>
          <span>{{ selectedPlacement.isActive ? 'Google AdSense 광고 단위가 사용자 페이지에 로드됩니다.' : '설정 전에는 독자 화면에 표시되지 않습니다.' }}</span>
        </div>
      </section>
    </div>
  </section>
</template>
