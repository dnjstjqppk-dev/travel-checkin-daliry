<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const store = useArticlesStore()
const categories = await store.loadCategories(true)
const id = Number(route.params.id)

await store.load('', true)
const item = store.articles.find((candidate) => candidate.id === id)
if (!item) throw createError({ statusCode: 404, statusMessage: 'Article not found' })

const form = reactive({
  title: item.title,
  subtitle: (item as any).subtitle || '',
  slug: item.slug,
  summary: item.summary,
  content: item.content,
  category: item.category,
  author: item.author,
  coverImage: item.coverImage,
  status: item.status,
  cityIds: item.cities?.map((city) => city.id) || [],
  sourceName: (item as any).sourceName || '',
  sourceUrl: (item as any).sourceUrl || '',
  licenseInfo: (item as any).licenseInfo || 'Editorial Fair Citation',
  reviewStatus: (item as any).reviewStatus || 'approved',
})

const saving = ref(false)
const error = ref('')
const saveSuccess = ref(false)

const charCount = computed(() => form.content ? form.content.length : 0)
const isLengthValid = computed(() => charCount.value >= 300 && charCount.value <= 1000)

async function submit() {
  saving.value = true
  error.value = ''
  saveSuccess.value = false
  try {
    await store.save({ ...form }, id)
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2500)
  } catch (err: unknown) {
    error.value = '저장하지 못했습니다. 입력 값을 다시 확인해 주세요.'
  } finally {
    saving.value = false
  }
}

async function handleRetract() {
  const reason = window.prompt('기사 철회 사유를 입력하세요 (필수):')
  if (!reason || !reason.trim()) return
  try {
    await $fetch(`/api/admin/articles/${id}/retract`, {
      method: 'POST',
      body: { reason: reason.trim() },
    })
    alert('기사가 성공적으로 철회(비공개)되었습니다.')
    await router.push('/admin/articles')
  } catch {
    alert('철회 처리 중 오류가 발생했습니다.')
  }
}

function formatDate(val: string | null | undefined) {
  if (!val) return '-'
  return new Date(val).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-top">
      <div>
        <p class="eyebrow">EDITORIAL ROOM / ARTICLE WORKBENCH #{{ id }}</p>
        <h1>기사 편집 및 사실 검증 워크벤치</h1>
      </div>
      <div class="top-actions">
        <a :href="`/news/${item.category}/article/${id}`" target="_blank" class="button">공개 화면 보기 ↗</a>
        <NuxtLink class="button" to="/admin/articles">목록으로</NuxtLink>
      </div>
    </div>

    <div v-if="saveSuccess" class="alert-success">✓ 기사 수정 사항이 안전하게 저장되었습니다.</div>
    <div v-if="error" class="alert-error">{{ error }}</div>

    <!-- 메타데이터 상태 배너 -->
    <div class="editorial-status-banner">
      <div class="status-item">
        <span class="label">발행 상태:</span>
        <span class="val">{{ form.status === 'published' ? '공개 중' : '초안' }}</span>
      </div>
      <div class="status-item">
        <span class="label">검토 상태:</span>
        <span class="val">{{ form.reviewStatus }}</span>
      </div>
      <div class="status-item">
        <span class="label">최초 게시:</span>
        <!-- @ts-expect-error firstPublishedAt -->
        <span class="val text-mono">{{ formatDate(item.firstPublishedAt || item.publishedAt) }}</span>
      </div>
      <div class="status-item">
        <span class="label">최종 수정:</span>
        <span class="val text-mono">{{ formatDate(item.updatedAt) }}</span>
      </div>
      <div class="status-item">
        <span class="label">본문 글자 수:</span>
        <span class="val" :class="isLengthValid ? 'text-success' : 'text-warning'">
          {{ charCount }}자 ({{ isLengthValid ? '300~1,000자 규격 적합' : '규격 주의' }})
        </span>
      </div>
    </div>

    <form class="editor-form" @submit.prevent="submit">
      <div class="form-row">
        <label class="field full">
          기사 제목 (헤드라인) *
          <input v-model="form.title" required maxlength="180">
        </label>
      </div>

      <div class="form-row">
        <label class="field">
          슬러그 (URL 경로 식별자) *
          <input v-model="form.slug" required>
        </label>
        <label class="field">
          카테고리 *
          <select v-model="form.category" required>
            <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }}</option>
          </select>
        </label>
      </div>

      <div class="form-row">
        <label class="field full">
          리드 요약문 (Summary) *
          <input v-model="form.summary" maxlength="500">
        </label>
      </div>

      <div class="form-row">
        <label class="field">
          작성자 / 편집국 바이라인
          <input v-model="form.author">
        </label>
        <label class="field">
          발행 상태
          <select v-model="form.status">
            <option value="draft">초안 (Draft)</option>
            <option value="published">공개 발행 (Published)</option>
          </select>
        </label>
      </div>

      <div class="form-row-box">
        <h3>1차 공식 출처 및 저작권 정보</h3>
        <div class="form-row">
          <label class="field">
            공식 출처명
            <input v-model="form.sourceName" placeholder="예: 태국관광청(TAT) 공식 발표">
          </label>
          <label class="field">
            원문 URL (링크 증빙)
            <input v-model="form.sourceUrl" placeholder="https://www.tatnews.org/...">
          </label>
          <label class="field">
            이용 허가 / 라이선스
            <input v-model="form.licenseInfo" placeholder="Editorial Fair Citation">
          </label>
        </div>
      </div>

      <div class="form-row">
        <div class="field full">
          <LocationMultiSelect
            v-model="form.cityIds"
            :initial-country-codes="[...new Set(item.cities?.map((city) => city.countryCode) || [])]"
          />
        </div>
      </div>

      <label class="field full">
        기사 본문 (Markdown 지원, 300~1,000자 권장)
        <textarea v-model="form.content" rows="14"></textarea>
      </label>

      <div class="form-actions-bar">
        <div class="left-actions">
          <button
            v-if="form.status === 'published'"
            type="button"
            class="button btn-retract"
            @click="handleRetract"
          >
            기사 철회 (Retract)
          </button>
        </div>
        <div class="right-actions">
          <button class="button" type="button" @click="router.push('/admin/articles')">취소</button>
          <button class="button button-primary" :disabled="saving">
            {{ saving ? '저장 중...' : '변경 사항 저장' }}
          </button>
        </div>
      </div>
    </form>
  </section>
</template>

<style scoped>
.top-actions {
  display: flex;
  gap: 10px;
}
.alert-success {
  background: #DCFCE7;
  color: #166534;
  padding: 12px 16px;
  border-radius: 4px;
  font-weight: 700;
  margin-bottom: 20px;
}
.alert-error {
  background: #FEE2E2;
  color: #DC2626;
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 20px;
}
.editorial-status-banner {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 16px 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 24px;
}
.status-item {
  display: flex;
  flex-direction: column;
}
.status-item .label {
  font-size: 11px;
  font-weight: 700;
  color: #6B7280;
  font-family: 'DM Mono', monospace;
  margin-bottom: 2px;
}
.status-item .val {
  font-size: 13px;
  font-weight: 800;
  color: #111827;
}
.text-mono {
  font-family: 'DM Mono', monospace;
}
.text-success { color: #16A34A; }
.text-warning { color: #D97706; }

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.form-row .field {
  flex: 1;
}
.form-row .field.full {
  flex: 1 1 100%;
}
.form-row-box {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 16px 20px;
  margin-bottom: 16px;
}
.form-row-box h3 {
  font-size: 13px;
  font-weight: 800;
  margin: 0 0 12px;
  color: #374151;
  font-family: 'DM Mono', monospace;
}
.form-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid #E5E7EB;
}
.btn-retract {
  background: #FFFBEB;
  border: 1px solid #FCD34D;
  color: #D97706;
  font-weight: 800;
}
.right-actions {
  display: flex;
  gap: 10px;
}
</style>