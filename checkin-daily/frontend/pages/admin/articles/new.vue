<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const store = useArticlesStore()
const router = useRouter()
const categories = await store.loadCategories(true)

// Mode tab: 'ai' or 'manual'
const activeTab = ref<'ai' | 'manual'>('ai')

// AI Generation state
const aiKeyword = ref('')
const aiCategory = ref(categories[0]?.slug || 'major')
const generating = ref(false)
const publishing = ref(false)
const aiResult = ref<any>(null)
const aiMessage = ref('')
const aiError = ref('')

// Manual Form state
const form = reactive({
  title: '',
  slug: '',
  summary: '',
  content: '',
  category: categories[0]?.slug || '',
  author: '체크인데일리 편집팀',
  coverImage: '',
  status: 'published' as 'draft' | 'published',
  cityIds: [] as string[],
})
const saving = ref(false)
const manualError = ref('')

function slugify() {
  if (!form.slug) {
    form.slug = form.title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
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
  if (!aiKeyword.value.trim()) {
    aiError.value = '발행할 기사의 키워드를 입력해 주세요.'
    return
  }
  publishing.value = true
  aiError.value = ''
  aiMessage.value = ''
  try {
    const res = await $fetch<any>('/api/admin/generate-article', {
      method: 'POST',
      body: {
        keyword: aiKeyword.value.trim(),
        category: aiCategory.value,
        publishNow: true,
      },
    })
    aiMessage.value = res.message
    setTimeout(() => {
      router.push('/admin/dashboard')
    }, 1500)
  } catch (err: any) {
    aiError.value = err?.data?.statusMessage || err?.message || '즉시 발행에 실패했습니다.'
  } finally {
    publishing.value = false
  }
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
  form.status = 'published'
  form.cityIds = ['bkk']
  activeTab.value = 'manual'
}

// 4. 수동 폼 저장
async function submitManual() {
  saving.value = true
  manualError.value = ''
  try {
    const article = await store.save({ ...form })
    await router.push('/admin/dashboard')
    return article
  } catch {
    manualError.value = '저장하지 못했습니다. 제목과 고유한 슬러그를 확인해 주세요.'
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
        <h1>기사 작성 및 AI 자동 발행 파이프라인</h1>
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
        ⚡ AI 키워드 원클릭 자동 생성기 (300~1,000자 규격 & CTA 탑재)
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'manual' }"
        type="button"
        @click="activeTab = 'manual'"
      >
        ✍️ 수동 에디터 모드
      </button>
    </div>

    <!-- 1. AI 키워드 자동 생성 탭 -->
    <div v-if="activeTab === 'ai'" class="ai-generator-panel">
      <div class="ai-card">
        <div class="ai-card-header">
          <h2>키워드 기반 원클릭 뉴스 기사 생성 파이프라인</h2>
          <span class="spec-badge">상용 분량 제한: 공백포함 300자 ~ 1,000자 엄격 검증</span>
        </div>
        <p class="ai-desc">
          핵심 키워드를 입력하면 메이저 언론사 문체의 기사 본문과 헤드라인, 
          <strong>TripScanner</strong> / <strong>GetForTrip</strong> 문맥 맞춤형 트래픽 유도 CTA, 
          그리고 5개 국어(영어·중국어·태국어·베트남어·스페인어) 번역이 1초 만에 완전 자동 완성됩니다.
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
            {{ publishing ? 'D1 및 다국어 번역 즉시 발행 중...' : '🚀 AI 생성 & 즉시 실서버 발행' }}
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
          <div>
            <span class="char-count-badge" :class="{ valid: aiResult.charCount >= 300 && aiResult.charCount <= 1000 }">
              ✓ 본문 분량: {{ aiResult.charCount }}자 (300~1,000자 규격 충족)
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

    <!-- 2. 수동 에디터 탭 -->
    <form v-else class="editor-form" @submit.prevent="submitManual">
      <label class="field full">제목<input v-model="form.title" required maxlength="180" @blur="slugify"></label>
      <label class="field">슬러그<input v-model="form.slug" required></label>
      <label class="field">
        카테고리
        <select v-model="form.category" required>
          <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }}</option>
        </select>
      </label>
      <label class="field full">요약 (Summary)<input v-model="form.summary" maxlength="500"></label>
      <label class="field">작성자<input v-model="form.author"></label>
      <label class="field">
        발행 상태
        <select v-model="form.status">
          <option value="published">발행 (즉시 공개)</option>
          <option value="draft">초안 (비공개)</option>
        </select>
      </label>
      <div class="field full"><LocationMultiSelect v-model="form.cityIds" /></div>
      <label class="field full">
        본문 (Markdown, 공백포함 300자 ~ 1,000자 권장)
        <span class="live-counter">현재 글자 수: {{ form.content.length }}자</span>
        <textarea v-model="form.content" rows="12" placeholder="# 소제목&#10;&#10;기사 본문을 작성하세요."></textarea>
      </label>
      <p v-if="manualError" class="alert alert-error">{{ manualError }}</p>
      <div class="form-actions">
        <button class="button" type="button" @click="router.push('/admin/dashboard')">취소</button>
        <button class="button button-primary" :disabled="saving">{{ saving ? '저장 중...' : '기사 저장' }}</button>
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
  border: 1px solid #dcdfe1;
  background: #ffffff;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: #176B52;
  color: #ffffff;
  border-color: #176B52;
  box-shadow: 0 4px 12px rgba(23, 107, 82, 0.2);
}

.ai-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 28px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 24px;
}

.ai-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ai-card-header h2 {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
}

.spec-badge {
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid #cbd5e1;
}

.ai-desc {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 20px;
}

.ai-input-grid {
  display: grid;
  grid-template-columns: 2.5fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.ai-actions {
  display: flex;
  gap: 12px;
}

.action-btn-large {
  padding: 14px 28px;
  font-size: 15px;
  font-weight: 800;
}

.action-btn-secondary {
  padding: 14px 24px;
  font-size: 15px;
  font-weight: 700;
}

.alert {
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 16px;
}

.alert-error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.alert-success {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.ai-preview-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #cbd5e1;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.char-count-badge {
  font-size: 12px;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 4px;
  background: #f8fafc;
  color: #64748b;
}

.char-count-badge.valid {
  background: #dcfce7;
  color: #15803d;
}

.cta-badge {
  font-size: 12px;
  font-weight: 700;
  background: #e0f2fe;
  color: #0369a1;
  padding: 4px 8px;
  border-radius: 4px;
  margin-left: 8px;
}

.preview-title {
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 8px;
  color: #0f172a;
}

.preview-lead {
  font-size: 14px;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 16px;
}

.content-preview {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  font-family: inherit;
  border: 1px solid #e2e8f0;
}

.live-counter {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
  margin-left: 8px;
}
</style>