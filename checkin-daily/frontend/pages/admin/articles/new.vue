<script setup lang="ts">
import {
  calculateBodyTextLength,
  extractBodyImages,
  validateArticleForPublish,
  ARTICLE_RULES,
} from '~/utils/article-validator'

definePageMeta({ layout: 'admin' })

const store = useArticlesStore()
const router = useRouter()
const categories = await store.loadCategories(true)

// Mode tab: 'ai' | 'manual' | 'batch'
const activeTab = ref<'ai' | 'manual' | 'batch'>('ai')

interface GenerationResponse {
  success: boolean
  status: string
  articleId?: number
  title?: string
  charCount?: number
  qualityScore?: number
  translations?: string[]
  reason?: string
  editUrl?: string
  message: string
}

// Single-source AI generation state
const aiTitle = ref('')
const aiSourceUrl = ref('')
const aiContextText = ref('')
const aiSourceName = ref('')
const aiLicenseInfo = ref('')
const aiCategory = ref(categories[0]?.slug || 'major')
const generating = ref(false)
const aiResult = ref<GenerationResponse | null>(null)
const aiError = ref('')

// Batch (URL list) generation state
const batchUrls = ref('')
const batchCategory = ref(categories[0]?.slug || 'major')
const batchLicenseInfo = ref('')
const batchRunning = ref(false)
interface BatchResponse { results: Array<{ url: string; success: boolean; articleId?: number; title?: string; message: string }>; message: string }
const batchResult = ref<BatchResponse | null>(null)
const batchError = ref('')

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { statusMessage?: string; message?: string }; statusMessage?: string; message?: string }
  return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || e?.message || fallback
}

async function runBatchGeneration() {
  const lines = batchUrls.value.split('\n').map(s => s.trim()).filter(s => /^https:\/\//i.test(s))
  if (lines.length === 0) {
    batchError.value = '한 줄에 하나씩 HTTPS 원문 URL을 입력해 주세요.'
    return
  }
  batchRunning.value = true
  batchError.value = ''
  batchResult.value = null
  try {
    batchResult.value = await $fetch<BatchResponse>('/api/admin/generate-batch', {
      method: 'POST',
      body: { urls: lines.slice(0, 10), category: batchCategory.value, licenseInfo: batchLicenseInfo.value.trim() || undefined },
    })
  } catch (err) {
    batchError.value = errorMessage(err, '대량 생성에 실패했습니다.')
  } finally {
    batchRunning.value = false
  }
}

// Manual Form state
const form = reactive({
  title: '',
  slug: '',
  summary: '',
  content: '',
  category: categories[0]?.slug || '',
  author: '체크인데일리 편집팀',
  coverImage: '',
  sourceName: '',
  sourceUrl: '',
  licenseInfo: '',
  status: 'draft' as 'draft' | 'published',
  cityIds: [] as string[],
})
const saving = ref(false)
const manualError = ref('')
const isSubmittedSuccessfully = ref(false)

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

const canPublish = computed(() => isTextLengthValid.value && isImageCountValid.value && !!form.licenseInfo.trim())

// Dirty state tracking for navigation protection
const isDirty = computed(() => {
  if (isSubmittedSuccessfully.value || saving.value || generating.value) return false
  if (activeTab.value === 'ai') {
    return !!(aiContextText.value.trim() || aiSourceUrl.value.trim())
  }
  return !!(form.title.trim() || form.content.trim() || form.summary.trim())
})

onBeforeRouteLeave((to, from, next) => {
  if (isDirty.value) {
    const confirmed = window.confirm('작성 중인 기사 내용이 저장되지 않았습니다. 페이지를 벗어나시겠습니까?')
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

function slugify() {
  if (!form.slug) {
    form.slug = form.title
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
  }
}

// AI 기사 생성 → 검수 대기 초안으로 저장
async function generateAiDraft() {
  if (!aiTitle.value.trim() && !aiSourceUrl.value.trim() && !aiContextText.value.trim()) {
    aiError.value = '원문 URL, 원문 텍스트 또는 원문 제목 중 하나 이상을 입력해 주세요.'
    return
  }
  generating.value = true
  aiError.value = ''
  aiResult.value = null
  try {
    aiResult.value = await $fetch<GenerationResponse>('/api/admin/generate-article', {
      method: 'POST',
      body: {
        title: aiTitle.value.trim() || undefined,
        sourceUrl: aiSourceUrl.value.trim() || undefined,
        contextText: aiContextText.value.trim() || undefined,
        sourceName: aiSourceName.value.trim() || undefined,
        licenseInfo: aiLicenseInfo.value.trim() || undefined,
        category: aiCategory.value,
      },
    })
    isSubmittedSuccessfully.value = true
  } catch (err) {
    aiError.value = errorMessage(err, '기사 생성에 실패했습니다.')
  } finally {
    generating.value = false
  }
}

// 4. 수동 폼 저장 (Draft or Publish)
async function submitManual(targetStatus?: 'draft' | 'published') {
  if (targetStatus) {
    form.status = targetStatus
  }

  manualError.value = ''

  // 공개 발행 시 유효성 검사 필수 적용 (초안은 검증 통과 여부와 무관하게 저장 가능)
  if (form.status === 'published') {
    const validation = validateArticleForPublish({
      content: form.content,
      coverImage: form.coverImage,
    })
    if (!validation.valid) {
      manualError.value = `[발행 불가] ${validation.errors.join(' / ')}`
      return
    }
  }

  saving.value = true
  try {
    const article = await store.save({ ...form })
    isSubmittedSuccessfully.value = true
    await router.push('/admin/dashboard')
    return article
  } catch (err: any) {
    manualError.value =
      err?.data?.message ||
      err?.data?.statusMessage ||
      '저장하지 못했습니다. 제목, 고유한 슬러그 및 필수 조건을 확인해 주세요.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-top">
      <div>
        <p class="eyebrow">EDITORIAL NEWSROOM / STORY CREATOR</p>
        <h1>기사 작성 및 편집 검토</h1>
      </div>
      <NuxtLink class="button" to="/admin/dashboard">대시보드로 복귀</NuxtLink>
    </div>

    <!-- 탭 선택기 -->
    <div class="pipeline-tabs">
      <button class="tab-btn" :class="{ active: activeTab === 'ai' }" type="button" @click="activeTab = 'ai'">
        AI 기사 생성 (원문 기반)
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'manual' }" type="button" @click="activeTab = 'manual'">
        수동 에디터
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'batch' }" type="button" @click="activeTab = 'batch'">
        URL 일괄 생성
      </button>
    </div>

    <!-- 1. 원문 기반 AI 생성 -->
    <div v-if="activeTab === 'ai'" class="ai-generator-panel">
      <div class="ai-card">
        <div class="ai-card-header">
          <h2>원문 기반 AI 기사 생성</h2>
          <span class="spec-badge">본문 {{ ARTICLE_RULES.MIN_BODY_CHARS }}~{{ ARTICLE_RULES.MAX_BODY_CHARS }}자 · 소제목 3개 · 5개 국어 번역 · 검수 대기열 저장</span>
        </div>
        <p class="ai-desc">
          원문 URL 또는 보도자료 텍스트를 입력하면 Gemini가 원문에 있는 사실만으로 기사를 재구성합니다.
          중복 기사·짧은 원문·AI 거부 응답·규격 미달 결과는 자동 차단되며, 통과한 기사는 <strong>검수 대기 초안</strong>으로 저장됩니다.
        </p>

        <div class="ai-input-grid">
          <label class="field full">
            원문 URL
            <input v-model="aiSourceUrl" type="url" placeholder="https://www.example-tourism.org/press/2026-visa-update">
          </label>
          <label class="field full">
            원문 텍스트 / 보도자료 (URL을 읽을 수 없는 경우 필수, 160자 이상)
            <textarea v-model="aiContextText" rows="6" placeholder="보도자료 원문 또는 확인된 사실 메모를 붙여넣으세요."></textarea>
          </label>
          <label class="field">
            원문 제목 (선택)
            <input v-model="aiTitle" placeholder="원문 헤드라인">
          </label>
          <label class="field">
            출처명 (선택)
            <input v-model="aiSourceName" placeholder="예: 일본정부관광국(JNTO)">
          </label>
          <label class="field">
            사용권 정보
            <input v-model="aiLicenseInfo" placeholder="예: Official Press Release">
          </label>
          <label class="field">
            카테고리
            <select v-model="aiCategory">
              <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }} ({{ cat.slug }})</option>
            </select>
          </label>
        </div>

        <div v-if="aiError" class="alert alert-error">{{ aiError }}</div>

        <div class="ai-actions">
          <button class="button button-primary action-btn-large" type="button" :disabled="generating" @click="generateAiDraft">
            {{ generating ? 'AI 기사 작성 중… (최대 1~2분)' : 'AI 기사 생성 후 초안 저장' }}
          </button>
        </div>
      </div>

      <div v-if="aiResult" class="ai-preview-card">
        <div class="preview-header">
          <div class="badges-row">
            <span class="char-count-badge valid">본문 {{ aiResult.charCount }}자</span>
            <span class="image-count-badge valid">품질점수 {{ aiResult.qualityScore }}</span>
            <span class="cta-badge">번역: {{ aiResult.translations?.length ? aiResult.translations.join(', ').toUpperCase() : '없음' }}</span>
          </div>
          <NuxtLink v-if="aiResult.editUrl" class="button button-sm" :to="aiResult.editUrl">편집기에서 검토하기 →</NuxtLink>
        </div>
        <h3 class="preview-title">{{ aiResult.title }}</h3>
        <p class="preview-lead">{{ aiResult.message }}</p>
        <p v-if="aiResult.reason" class="preview-lead">{{ aiResult.reason }}</p>
      </div>
    </div>

    <!-- 1-B. URL 일괄 생성 -->
    <div v-else-if="activeTab === 'batch'" class="ai-generator-panel">
      <div class="ai-card">
        <div class="ai-card-header">
          <h2>원문 URL 일괄 생성</h2>
          <span class="spec-badge">1회 최대 10건 · 건별 품질 게이트 · 검수 대기열 저장</span>
        </div>
        <p class="ai-desc">한 줄에 하나씩 원문 기사 URL을 입력하면 각 원문을 읽어 기사 초안을 생성합니다.</p>

        <div class="ai-input-grid">
          <label class="field full">
            원문 URL 목록 *
            <textarea v-model="batchUrls" rows="6" placeholder="https://...&#10;https://..." required></textarea>
          </label>
          <label class="field">
            기본 카테고리
            <select v-model="batchCategory">
              <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }} ({{ cat.slug }})</option>
            </select>
          </label>
          <label class="field">
            사용권 정보
            <input v-model="batchLicenseInfo" placeholder="예: Official Press Release">
          </label>
        </div>

        <div v-if="batchError" class="alert alert-error">{{ batchError }}</div>
        <div v-if="batchResult" class="alert alert-success">{{ batchResult.message }}</div>

        <div class="ai-actions">
          <button class="button button-primary action-btn-large" type="button" :disabled="batchRunning" @click="runBatchGeneration">
            {{ batchRunning ? '일괄 생성 진행 중…' : '일괄 생성 시작' }}
          </button>
        </div>
      </div>

      <div v-if="batchResult?.results?.length" class="ai-preview-card">
        <div class="preview-header">
          <strong>일괄 생성 결과 ({{ batchResult.results.length }}건)</strong>
          <NuxtLink to="/admin/review" class="button button-sm">검수 대기열 →</NuxtLink>
        </div>
        <table class="admin-table">
          <thead>
            <tr><th>원문</th><th>결과</th><th>상태</th><th>관리</th></tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in batchResult.results" :key="idx">
              <td>{{ item.url }}</td>
              <td>{{ item.title || item.message }}</td>
              <td>
                <span class="char-count-badge" :class="{ valid: item.success }">{{ item.success ? '초안 저장' : '차단/실패' }}</span>
              </td>
              <td>
                <NuxtLink v-if="item.articleId" :to="`/admin/articles/${item.articleId}`" class="button button-sm">편집 ↗</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 2. 수동 에디터 탭 -->
    <form v-else class="editor-form" @submit.prevent="submitManual()">
      <!-- 실시간 발행 규격 검증 바 -->
      <div class="editorial-status-banner">
        <div class="status-col">
          <span class="status-label">본문 글자 수 (순수 텍스트 기준)</span>
          <div class="status-val-wrap">
            <strong :class="isTextLengthValid ? 'text-success' : 'text-danger'">
              {{ bodyCharCount }} / {{ ARTICLE_RULES.MIN_BODY_CHARS }}~{{ ARTICLE_RULES.MAX_BODY_CHARS }}자
            </strong>
            <span v-if="bodyCharCount < ARTICLE_RULES.MIN_BODY_CHARS" class="diff-tag text-warning">
              ({{ ARTICLE_RULES.MIN_BODY_CHARS - bodyCharCount }}자 부족)
            </span>
            <span v-else-if="bodyCharCount > ARTICLE_RULES.MAX_BODY_CHARS" class="diff-tag text-danger">
              ({{ bodyCharCount - ARTICLE_RULES.MAX_BODY_CHARS }}자 초과)
            </span>
            <span v-else class="diff-tag text-success">
              ✓ 적합
            </span>
          </div>
          <small class="status-hint">서식 기호, 이미지 문법, 링크 URL, HTML 태그는 글자 수에서 자동 제외됩니다.</small>
        </div>

        <div class="status-col">
          <span class="status-label">본문 이미지 수 (대표 이미지 제외)</span>
          <div class="status-val-wrap">
            <strong :class="isImageCountValid ? 'text-success' : 'text-danger'">
              {{ bodyImageCount }} / {{ ARTICLE_RULES.MIN_BODY_IMAGES }}~{{ ARTICLE_RULES.MAX_BODY_IMAGES }}장
            </strong>
            <span v-if="bodyImageCount < ARTICLE_RULES.MIN_BODY_IMAGES" class="diff-tag text-warning">
              ({{ ARTICLE_RULES.MIN_BODY_IMAGES - bodyImageCount }}장 부족)
            </span>
            <span v-else-if="bodyImageCount > ARTICLE_RULES.MAX_BODY_IMAGES" class="diff-tag text-danger">
              ({{ bodyImageCount - ARTICLE_RULES.MAX_BODY_IMAGES }}장 초과)
            </span>
            <span v-else class="diff-tag text-success">
              ✓ 적합
            </span>
          </div>
          <small class="status-hint">대표 이미지를 제외한 본문 내 고유한 이미지 기준입니다.</small>
        </div>

        <div class="status-col status-action-summary">
          <span class="status-label">발행 가부 상태</span>
          <div v-if="canPublish" class="publish-ready-badge ready">
            ✓ 즉시 공개 발행 가능
          </div>
          <div v-else class="publish-ready-badge not-ready">
            ⚠발행 불가 (초안 저장 가능)
          </div>
        </div>
      </div>

      <div class="form-grid">
        <label class="field full">
          기사 제목 (헤드라인) *
          <input v-model="form.title" required maxlength="180" @blur="slugify">
        </label>
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
        <label class="field full">
          요약 (Lead Summary)
          <input v-model="form.summary" maxlength="500">
        </label>
        <label class="field">
          작성자 바이라인
          <input v-model="form.author">
        </label>
        <label class="field">출처 이름<input v-model="form.sourceName" maxlength="120"></label>
        <label class="field">원문 URL<input v-model="form.sourceUrl" type="url" placeholder="https://..."></label>
        <label class="field">본문·이미지 사용권 근거<input v-model="form.licenseInfo" maxlength="120" placeholder="권리자, 허가 범위, 계약·동의 기록 위치"></label>
        <label class="field">
          대표 커버 이미지 URL (헤더 및 카드용)
          <input v-model="form.coverImage" placeholder="https://... 또는 /api/media/...">
        </label>
      </div>

      <div class="field full">
        <LocationMultiSelect v-model="form.cityIds" />
      </div>

      <label class="field full">
        기사 본문 (Markdown 지원, 800자 ~ 2,000자 필수)
        <textarea
          v-model="form.content"
          rows="14"
          placeholder="# 소제목&#10;&#10;기사 본문을 작성하세요. 이미지는 아래 이미지 관리기에서 업로드하거나 URL로 추가할 수 있습니다."
        />
      </label>

      <!-- 본문 이미지 관리 도구 컴포넌트 -->
      <ArticleImageManager
        v-model="form.content"
        :cover-image="form.coverImage"
      />

      <div v-if="manualError" class="alert alert-error">{{ manualError }}</div>

      <div class="form-actions-bar">
        <button class="button" type="button" @click="router.push('/admin/dashboard')">취소</button>
        <div class="right-buttons">
          <button
            class="button btn-draft"
            type="button"
            :disabled="saving"
            @click="submitManual('draft')"
          >
            {{ saving ? '저장 중...' : '임시 저장 (초안)' }}
          </button>
          <button
            class="button button-primary btn-publish"
            type="button"
            :disabled="saving || !canPublish"
            :title="!canPublish ? '발행 조건(800~2,000자, 이미지 4~10장)을 충족해야 발행할 수 있습니다.' : ''"
            @click="submitManual('published')"
          >
            {{ saving ? '저장 중...' : '공개 발행 (Published)' }}
          </button>
        </div>
      </div>
    </form>
  </section>
</template>

<style scoped>
.pipeline-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.tab-btn {
  padding: 12px 20px;
  border-radius: 8px;
  border: 1px solid var(--admin-border);
  background: var(--admin-card);
  font-size: 14px;
  font-weight: 700;
  color: var(--admin-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
  box-shadow: 0 4px 12px rgba(23, 107, 82, 0.2);
}

.ai-card {
  background: var(--admin-card);
  border-radius: 12px;
  padding: 28px;
  border: 1px solid var(--admin-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 24px;
}

.ai-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.spec-badge {
  background: var(--amber-dim);
  color: var(--amber);
  font-size: 12px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid #FCD34D;
}

.badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.char-count-badge, .image-count-badge {
  font-size: 12px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 4px;
  background: var(--red-dim);
  color: var(--red);
}

.char-count-badge.valid, .image-count-badge.valid {
  background: var(--accent-dim);
  color: var(--accent);
}

.editorial-status-banner {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 8px;
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 1fr 1fr 200px;
  gap: 20px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

@media (max-width: 900px) {
  .editorial-status-banner {
    grid-template-columns: 1fr;
  }
}

.status-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--admin-muted);
}

.status-val-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-val-wrap strong {
  font-size: 16px;
}

.diff-tag {
  font-size: 12px;
  font-weight: 700;
}

.status-hint {
  font-size: 11px;
  color: var(--admin-muted);
}

.text-success { color: var(--accent); }
.text-warning { color: var(--amber); }
.text-danger { color: var(--red); }

.publish-ready-badge {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.publish-ready-badge.ready {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid #86EFAC;
}

.publish-ready-badge.not-ready {
  background: var(--amber-dim);
  color: var(--amber);
  border: 1px solid #FCD34D;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--admin-text);
}

.field.full {
  grid-column: 1 / -1;
}

.field input, .field select, .field textarea {
  color: var(--admin-text);
  background: var(--admin-input);
  padding: 10px 14px;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  font-size: 14px;
}

.form-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--admin-border);
  margin-top: 24px;
}

.right-buttons {
  display: flex;
  gap: 12px;
}

.btn-draft {
  background: var(--admin-surface);
  color: var(--admin-text);
  border: 1px solid var(--admin-border);
  font-weight: 700;
}

.btn-draft:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-publish {
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 800;
}

.btn-publish:disabled {
  background: var(--admin-muted);
  cursor: not-allowed;
  opacity: 0.6;
}

.ai-desc {
  color: var(--admin-muted);
  font-size: 13.5px;
  line-height: 1.7;
  margin: 0 0 20px;
}

.ai-input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.ai-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.alert {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 16px;
}

.alert-error {
  background: var(--red-dim);
  border: 1px solid var(--red-dim);
  color: var(--red);
}

.alert-success {
  background: var(--accent-dim);
  border: 1px solid var(--accent-dim);
  color: var(--accent);
}

.ai-preview-card {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 12px;
  padding: 24px;
  margin-top: 20px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--admin-border);
}

.preview-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 800;
  color: var(--admin-heading);
}

.preview-lead {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--admin-muted);
  line-height: 1.6;
}

.content-preview {
  margin: 0;
  padding: 16px;
  background: var(--admin-input);
  border: 1px solid var(--admin-border);
  border-radius: 8px;
  color: var(--admin-text);
  font-family: 'DM Mono', monospace;
  font-size: 12.5px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 460px;
  overflow-y: auto;
}
</style>
