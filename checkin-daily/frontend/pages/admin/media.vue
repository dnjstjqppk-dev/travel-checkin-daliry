<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface MediaAsset {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  altText: string
  caption: string
  uploadedBy: string
  createdAt: string
  url: string
}

const { data: mediaData, refresh } = await useAsyncData<{ assets: MediaAsset[] }>('admin-media-assets', () =>
  ($fetch as any)('/api/admin/media')
)

const assets = computed(() => mediaData.value?.assets || [])

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadMsg = ref('')
import { compressImageToWebP } from '~/utils/image-compressor'

const uploadErr = ref('')
const copiedId = ref<string | null>(null)

async function handleUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  uploading.value = true
  uploadMsg.value = ''
  uploadErr.value = ''

  try {
    const payloadFiles = await Promise.all(
      Array.from(files).map(async (file) => {
        if (file.type.startsWith('image/')) {
          const compressed = await compressImageToWebP(file, file.name)
          return {
            filename: compressed.filename,
            mimeType: compressed.mimeType,
            base64Data: compressed.base64Data,
          }
        }
        return new Promise<{ filename: string; mimeType: string; base64Data: string }>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              filename: file.name,
              mimeType: file.type,
              base64Data: reader.result as string,
            })
          }
          reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'))
          reader.readAsDataURL(file)
        })
      })
    )

    await $fetch('/api/admin/media/upload', {
      method: 'POST',
      body: { files: payloadFiles },
    })

    uploadMsg.value = `✓ ${payloadFiles.length}개의 미디어가 성공적으로 WebP 압축 및 업로드되었습니다.`
    await refresh()
  } catch (err: any) {
    uploadErr.value = err?.data?.statusMessage || err?.message || '업로드 중 오류가 발생했습니다.'
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function deleteAsset(id: string) {
  if (!confirm('이 미디어 자산을 영구 삭제하시겠습니까? (기사 본문 링크에 영향이 있을 수 있습니다)')) return
  try {
    await $fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
    await refresh()
  } catch {
    alert('미디어 삭제 중 오류가 발생했습니다.')
  }
}

function copyMarkdown(asset: MediaAsset) {
  const alt = asset.altText || asset.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
  const caption = asset.caption ? ` "${asset.caption}"` : ''
  const md = `![${alt}](${asset.url}${caption})`
  navigator.clipboard.writeText(md)
  copiedId.value = asset.id
  setTimeout(() => {
    copiedId.value = null
  }, 2000)
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const mediaStandards = [
  {
    type: 'Unsplash Editorial License',
    allowed: '허용 (보도 참고용)',
    rule: '반드시 이미지 하단에 [자료 사진: Unsplash 에디토리얼 라이선스 / 기사 보도 참고용] 캡션을 명시해야 합니다.',
    status: 'VERIFIED',
  },
  {
    type: '공식 보도자료 배포 사진 (TAT, AOT, 항공사)',
    allowed: '허용 (출처 명시)',
    rule: '보도자료에 첨부된 공식 홍보 이미지는 배포 주체(예: 태국관광청 제공)를 필수 표기합니다.',
    status: 'VERIFIED',
  },
  {
    type: '자체 취재 / 제휴사 공식 제공 이미지',
    allowed: '허용 (영구 저장)',
    rule: 'D1 미디어 저장소에 영구 보관되며 빠른 CDN 캐싱으로 고품질 서빙됩니다.',
    status: 'VERIFIED',
  },
  {
    type: '타 언론사 취재 사진 무단 전재',
    allowed: '절대 불가 (금지)',
    rule: '타사 워터마크가 있는 사진, 인스타그램/블로그 무단 캡처 사진은 저작권 침해로 자동 발행이 차단됩니다.',
    status: 'STRICTLY_BLOCKED',
  },
]
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">COPYRIGHT & ASSET MANAGEMENT / MEDIA</p>
        <h1>미디어 자산 보관소 및 이미지 저작권 관리</h1>
        <p class="admin-heading-copy">Cloudflare D1 영구 스토리지에 저장된 이미지 자산을 관리하고 기사용 마크다운 태그를 복사합니다.</p>
      </div>
    </div>

    <!-- 미디어 파일 업로드 패널 -->
    <div class="upload-panel">
      <h2>📤 신규 미디어 업로드</h2>
      <p class="upload-desc">
        JPEG, PNG, WebP, GIF, AVIF 형식의 이미지 파일을 업로드할 수 있습니다 (장당 최대 5MB).
      </p>
      <div class="upload-box">
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          :disabled="uploading"
          @change="handleUpload"
        >
        <div class="upload-box-content">
          <span class="upload-icon">📁</span>
          <span>{{ uploading ? '업로드 및 시그니처 검증 중...' : '클릭하여 이미지 파일 선택 (다중 파일 지원)' }}</span>
        </div>
      </div>
      <div v-if="uploadMsg" class="alert-success">{{ uploadMsg }}</div>
      <div v-if="uploadErr" class="alert-error">{{ uploadErr }}</div>
    </div>

    <!-- 미디어 자산 목록 그리드 -->
    <div class="assets-panel">
      <div class="panel-header">
        <h2>보관된 미디어 자산 ({{ assets.length }}개)</h2>
        <button class="button button-sm" type="button" @click="refresh()">새로고침</button>
      </div>

      <div v-if="assets.length === 0" class="empty-state">
        등록된 미디어 자산이 없습니다. 상단에서 이미지를 업로드해 보세요.
      </div>

      <div v-else class="assets-grid">
        <div v-for="asset in assets" :key="asset.id" class="asset-card">
          <div class="thumb-wrap">
            <img :src="asset.url" :alt="asset.altText || asset.filename" loading="lazy">
            <span class="size-badge">{{ formatBytes(asset.sizeBytes) }}</span>
          </div>
          <div class="asset-details">
            <p class="asset-name" :title="asset.filename">{{ asset.filename }}</p>
            <p class="asset-mime">{{ asset.mimeType }} · {{ asset.createdAt.slice(0, 10) }}</p>
            <div class="asset-actions">
              <button
                type="button"
                class="button button-sm btn-copy"
                @click="copyMarkdown(asset)"
              >
                {{ copiedId === asset.id ? '✓ 복사됨!' : '📋 MD 태그 복사' }}
              </button>
              <button
                type="button"
                class="button button-sm btn-del"
                @click="deleteAsset(asset.id)"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 이미지 사용 허가 표준 테이블 -->
    <div class="media-standards-panel">
      <h2>뉴스룸 이미지 사용 허가 표준 (Image Licensing Standards)</h2>
      <table class="admin-table">
        <thead>
          <tr>
            <th>미디어 자산 유형</th>
            <th>보도 사용 가능 여부</th>
            <th>필수 표기 및 준수 규칙</th>
            <th>가드레일 상태</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in mediaStandards" :key="item.type">
            <td><strong>{{ item.type }}</strong></td>
            <td>{{ item.allowed }}</td>
            <td><small>{{ item.rule }}</small></td>
            <td>
              <span class="badge" :class="item.status === 'VERIFIED' ? 'badge-success' : 'badge-danger'">
                {{ item.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 편집국 가이드라인 -->
    <div class="media-guidelines-box">
      <h3>💡 편집국 이미지 가이드라인</h3>
      <ul>
        <li>모든 기사는 발행 시 대표 커버 이미지를 제외하고 **최소 4장, 최대 10장의 본문 이미지**가 필수적으로 포함되어야 합니다.</li>
        <li>이미지 파일의 ALT 속성(대체 텍스트)과 캡션을 구체적으로 작성하여 시각 장애인 접근성과 SEO 순위를 극대화하십시오.</li>
        <li>영구 업로드된 이미지는 `/api/media/:id` 경로로 CDN에 영구 캐싱되며 안정적으로 고속 서빙됩니다.</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.upload-panel {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
}

.upload-panel h2 {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 6px;
}

.upload-desc {
  font-size: 13px;
  color: #64748B;
  margin: 0 0 16px;
}

.upload-box {
  position: relative;
  border: 2px dashed #CBD5E1;
  border-radius: 8px;
  padding: 28px;
  text-align: center;
  background: #F8FAFC;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-box:hover {
  border-color: #060D81;
  background: #F1F5F9;
}

.upload-box input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.upload-box-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
}

.upload-icon {
  font-size: 32px;
}

.alert-success {
  margin-top: 12px;
  padding: 10px 14px;
  background: #DCFCE7;
  color: #166534;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
}

.alert-error {
  margin-top: 12px;
  padding: 10px 14px;
  background: #FEE2E2;
  color: #991B1B;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
}

.assets-panel {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-header h2 {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  margin: 0;
}

.empty-state {
  padding: 36px;
  text-align: center;
  color: #94A3B8;
  font-size: 14px;
}

.assets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.asset-card {
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  overflow: hidden;
  background: #F8FAFC;
  display: flex;
  flex-direction: column;
}

.thumb-wrap {
  position: relative;
  height: 140px;
  background: #E2E8F0;
}

.thumb-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.size-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.75);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.asset-details {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.asset-name {
  font-size: 13px;
  font-weight: 700;
  color: #1E293B;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-mime {
  font-size: 11px;
  color: #64748B;
  margin: 0;
}

.asset-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.btn-copy {
  flex: 1;
  background: #060D81;
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  padding: 6px 8px;
}

.btn-del {
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  padding: 6px 8px;
}

.media-standards-panel {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 24px;
  margin-bottom: 24px;
}

.media-standards-panel h2 {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 16px;
}

.media-guidelines-box {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 20px 24px;
}

.media-guidelines-box h3 {
  font-size: 15px;
  font-weight: 800;
  margin: 0 0 10px;
  color: #111827;
}

.media-guidelines-box ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #4B5563;
  line-height: 1.8;
}

.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}

.badge-success { background: #DCFCE7; color: #16A34A; }
.badge-danger { background: #FEE2E2; color: #DC2626; }
</style>
