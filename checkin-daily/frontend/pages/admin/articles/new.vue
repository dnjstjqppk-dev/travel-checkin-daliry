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

// Mode tab: 'ai' or 'manual'
const activeTab = ref<'ai' | 'manual' | 'batch'>('ai')

// AI Generation state
const aiKeyword = ref('')
const aiContextText = ref('')
const aiCategory = ref(categories[0]?.slug || 'major')
const generating = ref(false)
const publishing = ref(false)
const aiResult = ref<any>(null)
const aiMessage = ref('')
const aiError = ref('')

// Batch Generation state
const batchKeywords = ref('')
const batchCategory = ref(categories[0]?.slug || 'major')
const batchContextText = ref('')
const batchRunning = ref(false)
const batchResult = ref<any>(null)
const batchMessage = ref('')
const batchError = ref('')

async function runBatchGeneration() {
  const lines = batchKeywords.value.split('\n').map(s => s.trim()).filter(s => s.length >= 2)
  if (lines.length === 0) {
    batchError.value = '최소 1개 이상의 키워드를 입력해 주세요.'
    return
  }
  batchRunning.value = true
  batchError.value = ''
  batchMessage.value = ''
  batchResult.value = null
  try {
    const res = await $fetch<any>('/api/admin/generate-batch', {
      method: 'POST',
      body: {
        keywords: lines,
        category: batchCategory.value,
        contextText: batchContextText.value.trim() || undefined,
      },
    })
    batchResult.value = res
    batchMessage.value = res.message
  } catch (err: any) {
    batchError.value = err?.data?.statusMessage || err?.message || '대량 생성에 실패했습니다.'
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
  if (isSubmittedSuccessfully.value || saving.value || publishing.value) return false
  if (activeTab.value === 'ai') {
    return !!aiKeyword.value.trim()
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

// 1. AI 기사 생성 (미리보기)
async function generateAiDraft() {
  if (!aiKeyword.value.trim()) {
    aiError.value = '기사 작성을 위한 키워드를 입력해 주세요.'
    return
  }
  generating.value = true
  aiError.value = ''
  aiMessage.value = ''
  try {
    const res = await $fetch<any>('/api/admin/generate-article', {
      method: 'POST',
      body: {
        keyword: aiKeyword.value.trim(),
        contextText: aiContextText.value.trim() || undefined,
        category: aiCategory.value,
        publishNow: false,
      },
    })
    aiResult.value = res.draft
    aiMessage.value = res.message
  } catch (err: any) {
    aiError.value = err?.data?.statusMessage || err?.message || '기사 생성에 실패했습니다.'
  } finally {
    generating.value = false
  }
}

// 2. AI 기사 즉시 발행 (1클릭 D1 배포)
async function generateAndPublishNow() {
  publishing.value = true
  try {
    await generateAiDraft()
    if (aiResult.value) loadAiResultToForm()
  } finally { publishing.value = false }
}

// 3. AI 결과를 수동 편집 폼으로 가져오기
function loadAiResultToForm() {
  if (!aiResult.value) return
  form.title = aiResult.value.title
  form.slug = aiResult.value.slug
  form.summary = aiResult.value.summary
  form.content = aiResult.value.content
  form.category = aiResult.value.category
  form.author = aiResult.value.author
  form.coverImage = aiResult.value.coverImage
  form.status = 'draft'
  form.cityIds = []
  form.sourceName = aiResult.value.sourceName || ''
  form.sourceUrl = aiResult.value.sourceUrl || ''
  form.licenseInfo = ''
  activeTab.value = 'manual'
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
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'ai' }"
        type="button"
        @click="activeTab = 'ai'"
      >
        ⚡ AI 키워드 원클릭 자동 생성기 (300~1,000자 & 이미지 4~10장 규격 자동화)
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'manual' }"
        type="button"
        @click="activeTab = 'manual'"
      >
        ✍️ 수동 에디터 모드
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'batch' }"
        type="button"
        @click="activeTab = 'batch'"
      >
        🚀 대량 일괄 생성 모드 (Batch Mode)
      </button>
    </div>

    <!-- 1. AI 키워드 자동 생성 탭 -->
    <div v-if="activeTab === 'ai'" class="ai-generator-panel">
      <div class="ai-card">
        <div class="ai-card-header">
          <h2>키워드 기반 원클릭 뉴스 기사 생성 파이프라인</h2>
          <span class="spec-badge">발행 규격: 본문 800~2,000자 · 이미지 4~10장 · 사용권 확인 · 편집 승인</span>
        </div>
        <p class="ai-desc">
          핵심 키워드를 입력하면 메이저 언론사 문체의 300~1,000자 심층 보도 기사, 
          <strong>엄선된 에디토리얼 이미지 4장</strong>, 
          <strong>TripScanner</strong> / <strong>GetForTrip</strong> 문맥 맞춤형 트래픽 유도 CTA, 
          그리고 5개 국어(영어·중국어·태국어·베트남어·스페인어) 번역이 완전 자동으로 완성됩니다.
        </p>

        <div class="ai-input-grid">
          <label class="field full">
            기사 생성 키워드 *
            <input
              v-model="aiKeyword"
              placeholder="예: 방콕 수완나품 공항 입국 패스트트랙, 치앙마이 DTV 비자, 푸켓 럭셔리 풀빌라 특가 등"
              required
              @keydown.enter.prevent="generateAiDraft"
            >
          </label>
          <label class="field">
            분야 카테고리
            <select v-model="aiCategory">
              <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }} ({{ cat.slug }})</option>
            </select>
          </label>
          <label class="field full">
            참고 보도자료 원문 또는 팩트 메모 (선택 사항 - Gemini 심층 취재 모드)
            <textarea
              v-model="aiContextText"
              rows="3"
              placeholder="외신 원문, 항공사/관광청 보도자료 텍스트, 팩트 수치를 입력하면 Gemini 3.5 Flash가 이를 분석하여 고품질 전문 기사로 재작성합니다."
            ></textarea>
          </label>
        </div>

        <div v-if="aiError" class="alert alert-error">{{ aiError }}</div>
        <div v-if="aiMessage" class="alert alert-success">{{ aiMessage }}</div>

        <div class="ai-actions">
          <button
            class="button button-primary action-btn-large"
            type="button"
            :disabled="generating || publishing"
            @click="generateAndPublishNow"
          >
            {{ publishing ? '초안 준비 중...' : '초안 생성 후 편집하기' }}
          </button>
          <button
            class="button action-btn-secondary"
            type="button"
            :disabled="generating || publishing"
            @click="generateAiDraft"
          >
            {{ generating ? '고품질 기사 작성 중...' : '🔍 미리보기 생성' }}
          </button>
        </div>
      </div>

      <!-- AI 생성 결과 미리보기 카드 -->
      <div v-if="aiResult" class="ai-preview-card">
        <div class="preview-header">
          <div class="badges-row">
            <span class="char-count-badge" :class="{ valid: aiResult.charCount >= 300 && aiResult.charCount <= 1000 }">
              ✓ 본문 텍스트: {{ aiResult.charCount }}자 (300~1,000자 규격 충족)
            </span>
            <span class="image-count-badge" :class="{ valid: aiResult.imageCount >= 4 && aiResult.imageCount <= 10 }">
              ✓ 본문 이미지: {{ aiResult.imageCount }}장 (4~10장 규격 충족)
            </span>
            <span class="cta-badge">연동 타겟 CTA: {{ aiResult.ctaTarget }}</span>
          </div>
          <button class="button button-sm" type="button" @click="loadAiResultToForm">
            ✏️ 수동 에디터로 가져와 수정하기
          </button>
        </div>

        <h3 class="preview-title">{{ aiResult.title }}</h3>
        <p class="preview-lead">{{ aiResult.summary }}</p>
        <div class="preview-body">
          <pre class="content-preview">{{ aiResult.content }}</pre>
        </div>
      </div>
    </div>

    <!-- 1-B. 대량 일괄 생성 탭 (Batch Mode) -->
    <div v-else-if="activeTab === 'batch'" class="ai-generator-panel">
      <div class="ai-card">
        <div class="ai-card-header">
          <h2>🚀 대량 일괄 기사 생성 파이프라인 (Batch Mode)</h2>
          <span class="spec-badge">최대 10개 키워드 동시 생성 · 자동 초안 보관</span>
        </div>
        <p class="ai-desc">
          줄바꿈(Enter)으로 구분하여 여러 개의 여행 뉴스 키워드를 입력하면 각 키워드별로 심층 보도 기사 초안과 다국어 번역을 일괄 생성하여 편집국 대기열에 저장합니다.
        </p>

        <div class="ai-input-grid">
          <label class="field full">
            일괄 생성할 키워드 목록 (줄바꿈으로 구분, 1회 최대 10개) *
            <textarea
              v-model="batchKeywords"
              rows="5"
              placeholder="방콕 수완나품 공항 자동출입국심사 확대&#10;일본 엔화 환율 변동의 한국인 여행객 영향&#10;다낭 미케비치 신규 5성급 리조트 오픈"
              required
            ></textarea>
          </label>
          <label class="field">
            기본 분야 카테고리
            <select v-model="batchCategory">
              <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }} ({{ cat.slug }})</option>
            </select>
          </label>
          <label class="field full">
            공통 참고 배경 정보 / 보도자료 메모 (선택 사항)
            <textarea
              v-model="batchContextText"
              rows="3"
              placeholder="일괄 생성 시 공통으로 반영할 팩트 메모나 출처 기준을 입력하세요."
            ></textarea>
          </label>
        </div>

        <div v-if="batchError" class="alert alert-error">{{ batchError }}</div>
        <div v-if="batchMessage" class="alert alert-success">{{ batchMessage }}</div>

        <div class="ai-actions">
          <button
            class="button button-primary action-btn-large"
            type="button"
            :disabled="batchRunning"
            @click="runBatchGeneration"
          >
            {{ batchRunning ? '⏳ 대량 기사 일괄 생성 진행 중...' : '🚀 선택 키워드 일괄 생성 시작' }}
          </button>
        </div>
      </div>

      <div v-if="batchResult?.results?.length" class="ai-preview-card">
        <div class="preview-header">
          <strong>일괄 생성 결과 ({{ batchResult.results.length }}건)</strong>
          <NuxtLink to="/admin/articles" class="button button-sm">기사 목록에서 확인 →</NuxtLink>
        </div>
        <table class="admin-table">
          <thead>
            <tr>
              <th>키워드</th>
              <th>생성된 제목</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in batchResult.results" :key="idx">
              <td><strong>{{ item.keyword }}</strong></td>
              <td>{{ item.title || item.error || '-' }}</td>
              <td>
                <span class="char-count-badge" :class="{ valid: item.success }">
                  {{ item.success ? '✓ 생성 완료' : '✕ 실패' }}
                </span>
              </td>
              <td>
                <NuxtLink v-if="item.articleId" :to="`/admin/articles/${item.articleId}`" class="button button-sm">
                  편집기 열기 ↗
                </NuxtLink>
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
            ⚠️ 발행 불가 (초안 저장 가능)
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
            {{ saving ? '저장 중...' : '💾 임시 저장 (초안)' }}
          </button>
          <button
            class="button button-primary btn-publish"
            type="button"
            :disabled="saving || !canPublish"
            :title="!canPublish ? '발행 조건(800~2,000자, 이미지 4~10장)을 충족해야 발행할 수 있습니다.' : ''"
            @click="submitManual('published')"
          >
            {{ saving ? '저장 중...' : '🚀 공개 발행 (Published)' }}
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
  color: #0d0e1a;
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
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
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
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.char-count-badge.valid, .image-count-badge.valid {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
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

.text-success { color: #10b981; }
.text-warning { color: #f59e0b; }
.text-danger { color: #f87171; }

.publish-ready-badge {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.publish-ready-badge.ready {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid #86EFAC;
}

.publish-ready-badge.not-ready {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
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
  color: #0d0e1a;
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
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #f87171;
}

.alert-success {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #10b981;
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
