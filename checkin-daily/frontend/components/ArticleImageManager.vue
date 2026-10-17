<script setup lang="ts">
import { ref, computed } from 'vue'
import { extractBodyImages, ARTICLE_RULES, type ExtractedImage } from '~/utils/article-validator'

const props = defineProps<{
  modelValue: string
  coverImage?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'imageCountChange': [count: number]
}>()

// Active tab for adding images: 'upload' | 'url'
const activeAddTab = ref<'upload' | 'url'>('upload')

// Upload state
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadProgress = ref('')
const uploadError = ref('')
const uploadSuccess = ref('')

// URL Input state
const urlInput = ref('')
const altInput = ref('')
const captionInput = ref('')
const urlError = ref('')

// Extracted body images (automatically computed from markdown)
const bodyImages = computed<ExtractedImage[]>(() => {
  return extractBodyImages(props.modelValue || '', props.coverImage)
})

const imageCount = computed(() => bodyImages.value.length)
const isMinMet = computed(() => imageCount.value >= ARTICLE_RULES.MIN_BODY_IMAGES)
const isMaxExceeded = computed(() => imageCount.value > ARTICLE_RULES.MAX_BODY_IMAGES)
const isCountValid = computed(() => isMinMet.value && !isMaxExceeded.value)

// Emitting image count updates whenever it changes
watch(imageCount, (cnt) => {
  emit('imageCountChange', cnt)
}, { immediate: true })

/**
 * Inserts markdown image token into the article body
 */
function insertImageToBody(url: string, alt: string, caption?: string) {
  if (imageCount.value >= ARTICLE_RULES.MAX_BODY_IMAGES) {
    alert(`본문 이미지는 최대 ${ARTICLE_RULES.MAX_BODY_IMAGES}장까지 등록할 수 있습니다.`)
    return
  }

  const cleanUrl = url.trim()
  const cleanAlt = (alt || '기사 보도 사진').trim()
  const cleanCaption = (caption || '').trim()

  const captionAttr = cleanCaption ? ` "${cleanCaption}"` : ''
  const imageMarkdown = `\n\n![${cleanAlt}](${cleanUrl}${captionAttr})\n`

  const updated = (props.modelValue || '').trimEnd() + imageMarkdown
  emit('update:modelValue', updated)
}

/**
 * Handles multiple image file upload to server (/api/admin/media/upload)
 */
async function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  const remainingSlots = ARTICLE_RULES.MAX_BODY_IMAGES - imageCount.value
  if (remainingSlots <= 0) {
    uploadError.value = `본문 이미지가 이미 최대치(${ARTICLE_RULES.MAX_BODY_IMAGES}장)입니다.`
    return
  }

  const filesToUpload = Array.from(files).slice(0, remainingSlots)
  if (files.length > remainingSlots) {
    alert(`최대 ${ARTICLE_RULES.MAX_BODY_IMAGES}장 제한으로 인해 앞선 ${remainingSlots}장의 이미지만 업로드됩니다.`)
  }

  uploading.value = true
  uploadError.value = ''
  uploadSuccess.value = ''
  uploadProgress.value = `파일 변환 및 업로드 준비 중 (총 ${filesToUpload.length}개)...`

  try {
    const payloadFiles = await Promise.all(
      filesToUpload.map(async (file) => {
        return new Promise<{ filename: string; mimeType: string; base64Data: string }>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve({
              filename: file.name,
              mimeType: file.type,
              base64Data: result,
            })
          }
          reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`))
          reader.readAsDataURL(file)
        })
      })
    )

    uploadProgress.value = `Cloudflare D1 영구 저장소에 업로드 및 검증 중...`

    const res = await $fetch<{
      success: boolean
      assets: Array<{ id: string; url: string; filename: string; altText: string; caption: string }>
    }>('/api/admin/media/upload', {
      method: 'POST',
      body: { files: payloadFiles },
    })

    if (res?.assets?.length) {
      // Append uploaded images to markdown
      let newMarkdown = props.modelValue || ''
      for (const asset of res.assets) {
        const altText = asset.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
        newMarkdown = newMarkdown.trimEnd() + `\n\n![${altText}](${asset.url} "보도 사진: 체크인데일리 아카이브")\n`
      }
      emit('update:modelValue', newMarkdown)
      uploadSuccess.value = `✓ ${res.assets.length}장의 이미지가 영구 미디어 저장소에 성공적으로 업로드 및 본문에 자동 삽입되었습니다.`
    }
  } catch (err: any) {
    uploadError.value = err?.data?.statusMessage || err?.message || '이미지 업로드에 실패했습니다.'
  } finally {
    uploading.value = false
    uploadProgress.value = ''
    if (fileInput.value) fileInput.value.value = ''
  }
}

/**
 * Handles adding an external image URL
 */
function addUrlImage() {
  urlError.value = ''
  const url = urlInput.value.trim()
  if (!url) {
    urlError.value = '이미지 URL을 입력해 주세요.'
    return
  }

  if (!/^(https?:\/\/|\/api\/media\/|\/images\/)/i.test(url)) {
    urlError.value = '올바른 HTTPS 프로토콜 또는 시스템 이미지 경로여야 합니다.'
    return
  }

  insertImageToBody(url, altInput.value, captionInput.value)

  urlInput.value = ''
  altInput.value = ''
  captionInput.value = ''
}

/**
 * Removes a specific image from markdown
 */
function removeImage(imageToRemove: ExtractedImage) {
  if (!confirm(`이 이미지를 본문에서 제거하시겠습니까?\n(${imageToRemove.alt || imageToRemove.url})`)) return

  let content = props.modelValue || ''
  // Regex to remove this specific image markdown
  const escapedUrl = imageToRemove.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const mdRegex = new RegExp(`!\\[[^\\]]*\\]\\(\\s*${escapedUrl}(?:\\s+["'][^"']*["'])?\\s*\\)`, 'g')
  content = content.replace(mdRegex, '')

  // Also remove HTML img tag if any
  const htmlRegex = new RegExp(`<img\\b[^>]*src=["']${escapedUrl}["'][^>]*>`, 'gi')
  content = content.replace(htmlRegex, '')

  // Clean double blank lines
  content = content.replace(/\n{3,}/g, '\n\n')
  emit('update:modelValue', content)
}

/**
 * Reorders images in markdown: move image up or down
 */
function moveImage(index: number, direction: 'up' | 'down') {
  const images = [...bodyImages.value]
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= images.length) return

  const itemA = images[index]
  const itemB = images[targetIndex]

  // Swap occurrences in markdown
  let content = props.modelValue || ''
  const tagA = `![${itemA.alt || ''}](${itemA.url}${itemA.caption ? ` "${itemA.caption}"` : ''})`
  const tagB = `![${itemB.alt || ''}](${itemB.url}${itemB.caption ? ` "${itemB.caption}"` : ''})`

  // Use a temporary placeholder to avoid collision
  const placeholder = `___IMG_SWAP_PLACEHOLDER_${Date.now()}___`
  content = content.replace(tagA, placeholder)
  content = content.replace(tagB, tagA)
  content = content.replace(placeholder, tagB)

  emit('update:modelValue', content)
}
</script>

<template>
  <div class="image-manager-box">
    <!-- 헤더 및 실시간 카운터 배너 -->
    <div class="im-header">
      <div class="im-title-wrap">
        <h4>📸 본문 이미지 관리 (필수 발행 규격: 4장 ~ 10장)</h4>
        <span class="im-subtext">대표 커버 이미지를 제외한 본문 내 삽입 이미지만 집계됩니다.</span>
      </div>
      <div class="im-counter-badge" :class="{ 'is-valid': isCountValid, 'is-short': !isMinMet, 'is-exceeded': isMaxExceeded }">
        <span class="im-count-num">{{ imageCount }}</span> / {{ ARTICLE_RULES.MIN_BODY_IMAGES }}~{{ ARTICLE_RULES.MAX_BODY_IMAGES }}장
        <span v-if="!isMinMet" class="im-status-tag">({{ ARTICLE_RULES.MIN_BODY_IMAGES - imageCount }}장 부족)</span>
        <span v-else-if="isMaxExceeded" class="im-status-tag">({{ imageCount - ARTICLE_RULES.MAX_BODY_IMAGES }}장 초과)</span>
        <span v-else class="im-status-tag">✓ 발행 가능</span>
      </div>
    </div>

    <!-- 이미지 추가 탭: 업로드 vs URL -->
    <div class="im-tabs">
      <button
        type="button"
        class="im-tab-btn"
        :class="{ active: activeAddTab === 'upload' }"
        @click="activeAddTab = 'upload'"
      >
        📁 이미지 파일 업로드 (다중 선택 가능)
      </button>
      <button
        type="button"
        class="im-tab-btn"
        :class="{ active: activeAddTab === 'url' }"
        @click="activeAddTab = 'url'"
      >
        🔗 외부 이미지 URL 입력
      </button>
    </div>

    <!-- 1. 파일 업로드 탭 -->
    <div v-if="activeAddTab === 'upload'" class="im-tab-content">
      <div class="im-dropzone" :class="{ disabled: imageCount >= ARTICLE_RULES.MAX_BODY_IMAGES }">
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          :disabled="uploading || imageCount >= ARTICLE_RULES.MAX_BODY_IMAGES"
          @change="handleFileUpload"
        >
        <div class="im-dropzone-prompt">
          <span class="im-drop-icon">📤</span>
          <p class="im-drop-text">
            <strong>컴퓨터에서 이미지 파일을 선택하거나 여기로 드래그하세요.</strong><br>
            <small>JPEG, PNG, WebP, GIF, AVIF 지원 (장당 최대 5MB, 영구 D1 스토리지 저장)</small>
          </p>
        </div>
      </div>
      <div v-if="uploadProgress" class="im-progress">{{ uploadProgress }}</div>
      <div v-if="uploadSuccess" class="im-alert-success">{{ uploadSuccess }}</div>
      <div v-if="uploadError" class="im-alert-error">{{ uploadError }}</div>
    </div>

    <!-- 2. URL 입력 탭 -->
    <div v-else class="im-tab-content">
      <div class="im-url-grid">
        <label class="im-field full">
          이미지 HTTPS URL *
          <input
            v-model="urlInput"
            type="url"
            placeholder="https://images.unsplash.com/... 또는 https://..."
            :disabled="imageCount >= ARTICLE_RULES.MAX_BODY_IMAGES"
          >
        </label>
        <label class="im-field">
          대체 텍스트 (ALT / 시각 장애인 및 검색엔진용)
          <input
            v-model="altInput"
            placeholder="예: 보잉 787 기내 비즈니스석 전경"
            :disabled="imageCount >= ARTICLE_RULES.MAX_BODY_IMAGES"
          >
        </label>
        <label class="im-field">
          이미지 캡션 (출처 및 설명)
          <input
            v-model="captionInput"
            placeholder="예: 제공: 태국관광청 공식 미디어 센터"
            :disabled="imageCount >= ARTICLE_RULES.MAX_BODY_IMAGES"
          >
        </label>
      </div>
      <div v-if="urlError" class="im-alert-error">{{ urlError }}</div>
      <button
        type="button"
        class="im-btn-add"
        :disabled="imageCount >= ARTICLE_RULES.MAX_BODY_IMAGES"
        @click="addUrlImage"
      >
        ＋ 본문에 이미지 삽입
      </button>
    </div>

    <!-- 현재 본문에 포함된 이미지 목록 -->
    <div class="im-gallery-panel">
      <div class="im-gallery-header">
        <h5>본문에 삽입된 이미지 목록 ({{ bodyImages.length }}장)</h5>
        <span class="im-gallery-hint">순서 변경(▲/▼) 및 삭제(🗑️)가 가능하며 본문 마크다운과 실시간 동기화됩니다.</span>
      </div>

      <div v-if="bodyImages.length === 0" class="im-empty-gallery">
        본문에 등록된 이미지가 없습니다. 위 탭에서 최소 4장 이상의 이미지를 추가해 주세요.
      </div>

      <div v-else class="im-gallery-grid">
        <div
          v-for="(img, idx) in bodyImages"
          :key="img.url"
          class="im-gallery-card"
        >
          <div class="im-card-thumb">
            <img :src="img.url" :alt="img.alt || '뉴스 이미지'" loading="lazy">
            <span class="im-card-num">#{{ idx + 1 }}</span>
          </div>
          <div class="im-card-meta">
            <p class="im-card-alt" :title="img.alt">
              <strong>ALT:</strong> {{ img.alt || '(대체 텍스트 없음)' }}
            </p>
            <p v-if="img.caption" class="im-card-caption" :title="img.caption">
              <strong>캡션:</strong> {{ img.caption }}
            </p>
            <p class="im-card-url" :title="img.url">
              {{ img.url }}
            </p>
          </div>
          <div class="im-card-actions">
            <button
              type="button"
              class="im-btn-tool"
              title="위로 이동"
              :disabled="idx === 0"
              @click="moveImage(idx, 'up')"
            >
              ▲
            </button>
            <button
              type="button"
              class="im-btn-tool"
              title="아래로 이동"
              :disabled="idx === bodyImages.length - 1"
              @click="moveImage(idx, 'down')"
            >
              ▼
            </button>
            <button
              type="button"
              class="im-btn-tool im-btn-delete"
              title="본문에서 제거"
              @click="removeImage(img)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-manager-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 20px;
  margin-top: 16px;
  margin-bottom: 24px;
}

.im-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #E2E8F0;
}

.im-title-wrap h4 {
  font-size: 15px;
  font-weight: 800;
  color: #0F172A;
  margin: 0 0 4px;
}

.im-subtext {
  font-size: 12px;
  color: #64748B;
}

.im-counter-badge {
  font-size: 14px;
  font-weight: 800;
  padding: 6px 14px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.im-counter-badge.is-valid {
  background: #DCFCE7;
  color: #166534;
  border: 1px solid #86EFAC;
}

.im-counter-badge.is-short {
  background: #FEF3C7;
  color: #92400E;
  border: 1px solid #FCD34D;
}

.im-counter-badge.is-exceeded {
  background: #FEE2E2;
  color: #991B1B;
  border: 1px solid #FCA5A5;
}

.im-count-num {
  font-size: 16px;
}

.im-status-tag {
  font-size: 12px;
  font-weight: 700;
}

.im-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.im-tab-btn {
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid #CBD5E1;
  background: #FFFFFF;
  color: #475569;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.im-tab-btn.active {
  background: #060D81;
  color: #FFFFFF;
  border-color: #060D81;
}

.im-tab-content {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
}

.im-dropzone {
  position: relative;
  border: 2px dashed #CBD5E1;
  border-radius: 6px;
  padding: 24px;
  text-align: center;
  background: #F8FAFC;
  cursor: pointer;
  transition: border-color 0.2s;
}

.im-dropzone:hover:not(.disabled) {
  border-color: #060D81;
}

.im-dropzone.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.im-dropzone input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.im-dropzone.disabled input {
  cursor: not-allowed;
}

.im-drop-icon {
  font-size: 28px;
  display: block;
  margin-bottom: 8px;
}

.im-drop-text {
  margin: 0;
  font-size: 13px;
  color: #334155;
}

.im-drop-text small {
  color: #64748B;
}

.im-url-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.im-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}

.im-field.full {
  grid-column: 1 / -1;
}

.im-field input {
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid #CBD5E1;
  border-radius: 4px;
}

.im-btn-add {
  padding: 8px 16px;
  background: #060D81;
  color: #FFFFFF;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.im-btn-add:disabled {
  background: #94A3B8;
  cursor: not-allowed;
}

.im-progress {
  margin-top: 10px;
  padding: 8px 12px;
  background: #EFF6FF;
  color: #1D4ED8;
  font-size: 12px;
  border-radius: 4px;
  font-weight: 700;
}

.im-alert-success {
  margin-top: 10px;
  padding: 8px 12px;
  background: #DCFCE7;
  color: #166534;
  font-size: 12px;
  border-radius: 4px;
  font-weight: 700;
}

.im-alert-error {
  margin-top: 10px;
  padding: 8px 12px;
  background: #FEE2E2;
  color: #991B1B;
  font-size: 12px;
  border-radius: 4px;
  font-weight: 700;
}

.im-gallery-panel {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  padding: 16px;
}

.im-gallery-header {
  margin-bottom: 12px;
}

.im-gallery-header h5 {
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 800;
  color: #1E293B;
}

.im-gallery-hint {
  font-size: 11px;
  color: #64748B;
}

.im-empty-gallery {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: #94A3B8;
  border: 1px dashed #E2E8F0;
  border-radius: 4px;
}

.im-gallery-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.im-gallery-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
}

.im-card-thumb {
  position: relative;
  width: 90px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: #CBD5E1;
}

.im-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.im-card-num {
  position: absolute;
  top: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 4px;
  border-radius: 2px;
}

.im-card-meta {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}

.im-card-alt, .im-card-caption, .im-card-url {
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.im-card-alt {
  color: #1E293B;
}

.im-card-caption {
  color: #475569;
}

.im-card-url {
  color: #94A3B8;
  font-family: monospace;
  font-size: 11px;
}

.im-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.im-btn-tool {
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  color: #334155;
  transition: all 0.15s;
}

.im-btn-tool:hover:not(:disabled) {
  background: #F1F5F9;
  border-color: #94A3B8;
}

.im-btn-tool:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.im-btn-delete:hover:not(:disabled) {
  background: #FEE2E2;
  border-color: #F87171;
  color: #DC2626;
}
</style>
