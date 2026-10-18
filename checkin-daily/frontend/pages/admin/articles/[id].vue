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
  cityIds: item.cities?.map((city) => city.id) || [],
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
            :initial-country-codes="[...new Set(item.cities?.map((city) => city.countryCode) || [])]"
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
  font-weight: 700;
}
.editorial-status-banner {
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
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
  margin-bottom: 4px;
}
.status-item .val {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}
.status-item .val small {
  font-size: 11px;
  font-weight: 600;
  margin-left: 4px;
}
.text-mono {
  font-family: monospace;
}
.text-success { color: #16A34A; }
.text-warning { color: #D97706; }
.text-danger { color: #DC2626; }
.text-muted { color: #64748B; }
.font-bold { font-weight: 800; }

.editor-form {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 24px;
}
.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.form-row-box {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
}
.form-row-box h3 {
  font-size: 14px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 12px;
}
.field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #374151;
}
.field.full {
  flex: 100%;
}
.field input, .field select, .field textarea {
  padding: 10px 12px;
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  font-size: 14px;
  color: #111827;
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
  border-top: 1px solid #E5E7EB;
  margin-top: 20px;
}
.right-actions {
  display: flex;
  gap: 10px;
}
.btn-retract {
  background: #FEF2F2;
  color: #DC2626;
  border: 1px solid #FCA5A5;
}
.btn-retract:hover {
  background: #FEE2E2;
}
.btn-draft {
  background: #F1F5F9;
  color: #334155;
  border: 1px solid #CBD5E1;
  font-weight: 700;
}
.btn-publish:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>