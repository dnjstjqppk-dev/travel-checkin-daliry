<script setup lang="ts">
import {
  calculateBodyTextLength,
  extractBodyImages,
  validateArticleForPublish,
  ARTICLE_RULES,
} from '~/utils/article-validator'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const store = useArticlesStore()
const categories = await store.loadCategories(true)
const id = Number(route.params.id)

const apiFetch = useRequestFetch()
let item: any
try {
  item = await apiFetch<any>(`/api/admin/articles/${id}`)
} catch {
  // Fallback to store if single endpoint throws in dev
  await store.load('', true)
  item = store.articles.find((candidate) => candidate.id === id)
}
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
  cityIds: item.cities?.map((city: any) => String(city.id || city)) || [],
  sourceName: (item as any).sourceName || '',
  sourceUrl: (item as any).sourceUrl || '',
  licenseInfo: (item as any).licenseInfo || 'Editorial Fair Citation',
  reviewStatus: (item as any).reviewStatus || 'approved',
})

const saving = ref(false)
const error = ref('')
const saveSuccess = ref(false)

// Real-time validation computed properties
const bodyCharCount = computed(() => calculateBodyTextLength(form.content || ''))
const isTextLengthValid = computed(
  () =>
    bodyCharCount.value >= ARTICLE_RULES.MIN_BODY_CHARS &&
    bodyCharCount.value <= ARTICLE_RULES.MAX_BODY_CHARS
)

const bodyImages = computed(() => extractBodyImages(form.content || '', form.coverImage))
const bodyImageCount = computed(() => bodyImages.value.length)
const isImageCountValid = computed(
  () =>
    bodyImageCount.value >= ARTICLE_RULES.MIN_BODY_IMAGES &&
    bodyImageCount.value <= ARTICLE_RULES.MAX_BODY_IMAGES
)

const canPublish = computed(() => isTextLengthValid.value && isImageCountValid.value)

// Revision history & restore
const { data: revisionsData, refresh: refreshRevisions } = await useAsyncData(
  `article-revisions-${id}`,
  () => $fetch<{ revisions: any[] }>(`/api/admin/articles/${id}/revisions`).catch(() => ({ revisions: [] })),
  { default: () => ({ revisions: [] }) },
)

const restoringId = ref<number | null>(null)
async function restoreRevision(revId: number) {
  if (!confirm('이 버전으로 기사 내용을 복원하시겠습니까? 현재 상태는 새로운 스냅샷으로 자동 보존됩니다.')) return
  restoringId.value = revId
  try {
    const res = await $fetch<{ success: boolean; message: string; restored: any }>(`/api/admin/articles/${id}/restore`, {
      method: 'POST',
      body: { revisionId: revId },
    })
    if (res.success && res.restored) {
      form.title = res.restored.title
      form.summary = res.restored.summary
      form.content = res.restored.content
      alert(res.message)
      await refreshRevisions()
    }
  } catch (err: any) {
    alert(err?.data?.statusMessage || '버전 복원 중 오류가 발생했습니다.')
  } finally {
    restoringId.value = null
  }
}

// Dirty state tracking for navigation protection
const initialSnapshot = JSON.stringify({
  title: form.title,
  subtitle: form.subtitle,
  slug: form.slug,
  summary: form.summary,
  content: form.content,
  category: form.category,
  author: form.author,
  coverImage: form.coverImage,
  status: form.status,
  cityIds: form.cityIds,
})
let savedSnapshot = initialSnapshot

const isDirty = computed(() => {
  if (saving.value) return false
  return (
    JSON.stringify({
      title: form.title,
      subtitle: form.subtitle,
      slug: form.slug,
      summary: form.summary,
      content: form.content,
      category: form.category,
      author: form.author,
      coverImage: form.coverImage,
      status: form.status,
      cityIds: form.cityIds,
    }) !== savedSnapshot
  )
})

onBeforeRouteLeave((to, from, next) => {
  if (isDirty.value) {
    const confirmed = window.confirm('수정 중인 내용이 아직 저장되지 않았습니다. 변경사항을 취소하고 나가시겠습니까?')
    if (!confirmed) {
      next(false)
      return
    }
  }
  next()
})

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('beforeunload', handleBeforeUnload)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
})

async function submit(targetStatus?: 'draft' | 'published') {
  if (targetStatus) {
    form.status = targetStatus
  }

  saving.value = true
  error.value = ''
  saveSuccess.value = false

  // 공개 발행 시 유효성 검사 필수 적용 (초안은 검증 통과 여부와 무관하게 저장 가능)
  if (form.status === 'published') {
    const validation = validateArticleForPublish({
      content: form.content,
      coverImage: form.coverImage,
    })
    if (!validation.valid) {
      error.value = `[발행 불가] ${validation.errors.join(' / ')}`
      saving.value = false
      return
    }
  }

  try {
    await store.save({ ...form }, id)
    savedSnapshot = JSON.stringify({
      title: form.title,
      subtitle: form.subtitle,
      slug: form.slug,
      summary: form.summary,
      content: form.content,
      category: form.category,
      author: form.author,
      coverImage: form.coverImage,
      status: form.status,
      cityIds: form.cityIds,
    })
    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
    }, 2500)
  } catch (err: any) {
    error.value =
      err?.data?.message ||
      err?.data?.statusMessage ||
      '저장하지 못했습니다. 입력 값과 발행 조건을 다시 확인해 주세요.'
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
        <h1>기사 편집 및 발행 관리 워크벤치</h1>
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
        <span class="val font-bold" :class="form.status === 'published' ? 'text-success' : 'text-muted'">
          {{ form.status === 'published' ? '공개 중 (Published)' : '초안 (Draft)' }}
        </span>
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
        <span class="val" :class="isTextLengthValid ? 'text-success' : 'text-danger'">
          {{ bodyCharCount }} / {{ ARTICLE_RULES.MIN_BODY_CHARS }}~{{ ARTICLE_RULES.MAX_BODY_CHARS }}자
          <small v-if="bodyCharCount < ARTICLE_RULES.MIN_BODY_CHARS">({{ ARTICLE_RULES.MIN_BODY_CHARS - bodyCharCount }}자 부족)</small>
          <small v-else-if="bodyCharCount > ARTICLE_RULES.MAX_BODY_CHARS">({{ bodyCharCount - ARTICLE_RULES.MAX_BODY_CHARS }}자 초과)</small>
        </span>
      </div>
      <div class="status-item">
        <span class="label">본문 이미지 수:</span>
        <span class="val" :class="isImageCountValid ? 'text-success' : 'text-danger'">
          {{ bodyImageCount }} / {{ ARTICLE_RULES.MIN_BODY_IMAGES }}~{{ ARTICLE_RULES.MAX_BODY_IMAGES }}장
          <small v-if="bodyImageCount < ARTICLE_RULES.MIN_BODY_IMAGES">({{ ARTICLE_RULES.MIN_BODY_IMAGES - bodyImageCount }}장 부족)</small>
          <small v-else-if="bodyImageCount > ARTICLE_RULES.MAX_BODY_IMAGES">({{ bodyImageCount - ARTICLE_RULES.MAX_BODY_IMAGES }}장 초과)</small>
        </span>
      </div>
      <div class="status-item">
        <span class="label">발행 적합도:</span>
        <span class="val font-bold" :class="canPublish ? 'text-success' : 'text-warning'">
          {{ canPublish ? '✓ 발행 가능' : '⚠️ 규격 미달 (초안 가능)' }}
        </span>
      </div>
    </div>

    <form class="editor-form" @submit.prevent="submit()">
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
          대표 커버 이미지 URL (헤더 및 카드용)
          <input v-model="form.coverImage" placeholder="https://... 또는 /api/media/...">
        </label>
        <label class="field">
          발행 상태 선택
          <select v-model="form.status">
            <option value="draft">초안 (Draft - 규격 무관 저장)</option>
            <option value="published">공개 발행 (Published - 규격 검증 필수)</option>
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
            :initial-country-codes="Array.from(new Set((item.cities || []).map((city: any) => String(city.countryCode || '')).filter(Boolean)))"
          />
        </div>
      </div>

      <label class="field full">
        기사 본문 (Markdown 지원, 800~2,000자 필수)
        <textarea v-model="form.content" rows="14" placeholder="# 소제목&#10;&#10;기사 본문을 작성하세요."></textarea>
      </label>

      <!-- 본문 이미지 관리 도구 컴포넌트 -->
      <ArticleImageManager
        v-model="form.content"
        :cover-image="form.coverImage"
      />

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
          <button
            class="button btn-draft"
            type="button"
            :disabled="saving"
            @click="submit('draft')"
          >
            {{ saving ? '저장 중...' : '💾 초안으로 저장' }}
          </button>
          <button
            class="button button-primary btn-publish"
            type="button"
            :disabled="saving || (form.status === 'published' && !canPublish)"
            :title="form.status === 'published' && !canPublish ? '발행 조건(800~2,000자, 이미지 4~10장)을 충족해야 합니다.' : ''"
            @click="submit('published')"
          >
            {{ saving ? '저장 중...' : '🚀 발행 상태로 저장' }}
          </button>
        </div>
      </div>
    </form>

    <!-- 기사 버전 히스토리 & 원클릭 복원 패널 -->
    <section class="revisions-panel">
      <div class="revisions-header">
        <div>
          <h3>기사 버전 스냅샷 및 변경 이력</h3>
          <p class="revisions-sub">기사를 저장할 때마다 이전 상태가 자동으로 영구 보존되며 언제든지 원클릭으로 복원할 수 있습니다.</p>
        </div>
        <button type="button" class="btn-refresh-rev" @click="() => refreshRevisions()">이력 새로고침 ↻</button>
      </div>

      <div v-if="!revisionsData?.revisions?.length" class="empty-revisions">
        <p>저장된 이전 버전 히스토리가 없습니다. (현재 버전이 최초 버전입니다)</p>
      </div>
      <div v-else class="revisions-list">
        <div v-for="rev in revisionsData.revisions" :key="rev.id" class="revision-item">
          <div class="rev-left">
            <span class="rev-badge">Rev #{{ rev.revision_num }}</span>
            <div class="rev-info">
              <strong class="rev-title">{{ rev.title }}</strong>
              <span class="rev-meta">{{ rev.editor_note || '편집국 수정' }} · {{ new Date(rev.created_at).toLocaleString('ko-KR') }}</span>
            </div>
          </div>
          <button
            type="button"
            class="btn-restore"
            :disabled="restoringId === rev.id"
            @click="restoreRevision(rev.id)"
          >
            {{ restoringId === rev.id ? '복원 처리 중...' : '↺ 이 버전으로 복원' }}
          </button>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.top-actions {
  display: flex;
  gap: 10px;
}
.alert-success {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  padding: 12px 16px;
  border-radius: 4px;
  font-weight: 700;
  margin-bottom: 20px;
}
.alert-error {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-weight: 700;
}
.editorial-status-banner {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
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
  color: var(--admin-muted);
  margin-bottom: 4px;
}
.status-item .val {
  font-size: 14px;
  font-weight: 700;
  color: var(--admin-heading);
}
.status-item .val small {
  font-size: 11px;
  font-weight: 600;
  margin-left: 4px;
}
.text-mono {
  font-family: monospace;
}
.text-success { color: #10b981; }
.text-warning { color: #f59e0b; }
.text-danger { color: #f87171; }
.text-muted { color: var(--admin-muted); }
.font-bold { font-weight: 800; }

.editor-form {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 24px;
}
.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.form-row-box {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
}
.form-row-box h3 {
  font-size: 14px;
  font-weight: 800;
  color: var(--admin-heading);
  margin: 0 0 12px;
}
.field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--admin-text);
}
.field.full {
  flex: 100%;
}
.field input, .field select, .field textarea {
  background: var(--admin-input);
  padding: 10px 12px;
  border: 1px solid var(--admin-border);
  border-radius: 4px;
  font-size: 14px;
  color: var(--admin-heading);
}
.field textarea {
  font-family: monospace;
  line-height: 1.5;
}
.form-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20px;
  border-top: 1px solid var(--admin-border);
  margin-top: 20px;
}
.right-actions {
  display: flex;
  gap: 10px;
}
.btn-retract {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid #FCA5A5;
}
.btn-retract:hover {
  background: rgba(239, 68, 68, 0.15);
}
.btn-draft {
  background: var(--admin-surface);
  color: var(--admin-text);
  border: 1px solid var(--admin-border);
  font-weight: 700;
}
.btn-publish:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.revisions-panel {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 24px;
  margin-top: 24px;
}
.revisions-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--admin-border);
  padding-bottom: 12px;
}
.revisions-header h3 {
  font-size: 16px;
  font-weight: 800;
  color: var(--admin-heading);
  margin: 0 0 4px;
}
.revisions-sub {
  font-size: 12px;
  color: var(--admin-muted);
  margin: 0;
}
.btn-refresh-rev {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.empty-revisions {
  text-align: center;
  padding: 24px;
  color: var(--admin-muted);
  font-size: 13px;
  background: var(--admin-surface);
  border-radius: 4px;
}
.revisions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.revision-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
}
.rev-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rev-badge {
  background: var(--accent);
  color: #0d0e1a;
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
}
.rev-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rev-title {
  font-size: 13.5px;
  color: var(--admin-heading);
}
.rev-meta {
  font-size: 11px;
  color: var(--admin-muted);
}
.btn-restore {
  background: var(--accent-dim);
  border: 1px solid #C7D2FE;
  color: var(--accent);
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-restore:hover:not(:disabled) {
  background: #4338CA;
  border-color: #4338CA;
  color: #FFFFFF;
}
</style>