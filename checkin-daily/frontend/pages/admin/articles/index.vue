<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const store = useArticlesStore()
const filterStatus = ref('all')
const searchQuery = ref('')
const deletingId = ref<number | null>(null)
const retractingId = ref<number | null>(null)

await useAsyncData('admin-all-articles', () => store.load('', true))

const filteredArticles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return store.articles.filter((a) => {
    if (filterStatus.value !== 'all') {
      if (filterStatus.value === 'published' && a.status !== 'published') return false
      if (filterStatus.value === 'draft' && a.status !== 'draft') return false
      if (filterStatus.value === 'review' && a.reviewStatus !== 'needs_review' && a.reviewStatus !== 'candidate') return false
      if (filterStatus.value === 'retracted' && a.reviewStatus !== 'retracted') return false
    }
    if (q) {
      return a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    }
    return true
  })
})

function formatDate(val: string | null | undefined) {
  if (!val) return '-'
  return new Date(val).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function removeArticle(id: number) {
  if (!window.confirm('기사를 영구 삭제하시겠습니까? (복구 불가)')) return
  deletingId.value = id
  try {
    await store.remove(id)
  } finally {
    deletingId.value = null
  }
}

async function retractArticle(id: number) {
  const reason = window.prompt('기사 철회 사유를 입력하세요 (필수):')
  if (!reason || !reason.trim()) return
  retractingId.value = id
  try {
    await $fetch(`/api/admin/articles/${id}/retract`, {
      method: 'POST',
      body: { reason: reason.trim() },
    })
    await store.load('', true)
  } catch (err) {
    alert('기사 철회 처리 중 오류가 발생했습니다.')
  } finally {
    retractingId.value = null
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">EDITORIAL WORKSPACE / ARTICLES</p>
        <h1>기사 목록 및 통합 관리</h1>
        <p class="admin-heading-copy">등록된 모든 기사의 상태, 사실 검증 이력, 발행 및 철회를 제어합니다.</p>
      </div>
      <NuxtLink class="button button-primary" to="/admin/articles/new">
        ＋ 새 기사 작성 / AI 생성
      </NuxtLink>
    </div>

    <!-- 툴바 및 필터 -->
    <div class="admin-content-panel">
      <div class="admin-list-toolbar">
        <div class="filter-tabs">
          <button type="button" :class="{ active: filterStatus === 'all' }" @click="filterStatus = 'all'">전체 ({{ store.articles.length }})</button>
          <button type="button" :class="{ active: filterStatus === 'published' }" @click="filterStatus = 'published'">발행됨</button>
          <button type="button" :class="{ active: filterStatus === 'draft' }" @click="filterStatus = 'draft'">초안</button>
          <button type="button" :class="{ active: filterStatus === 'review' }" @click="filterStatus = 'review'">검토 대기</button>
          <button type="button" :class="{ active: filterStatus === 'retracted' }" @click="filterStatus = 'retracted'">철회됨</button>
        </div>
        <div class="search-box">
          <input v-model="searchQuery" type="search" placeholder="기사 검색 (제목, 요약, 카테고리)">
        </div>
      </div>

      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr>
              <th>기사 정보</th>
              <th>카테고리</th>
              <th>발행 상태</th>
              <th>검토 상태</th>
              <th>조회수</th>
              <th>게시/수정 일시</th>
              <th>관리 작업</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="article in filteredArticles" :key="article.id">
              <td class="article-info-cell">
                <NuxtLink :to="`/admin/articles/${article.id}`" class="article-title-link">
                  {{ article.title }}
                </NuxtLink>
                <div class="article-submeta">
                  <span class="text-slug">/{{ article.slug }}</span>
                  <span v-if="article.author" class="text-author">· {{ article.author }}</span>
                </div>
              </td>
              <td><span class="tag-cat">{{ article.category }}</span></td>
              <td>
                <span class="badge" :class="article.status === 'published' ? 'badge-success' : 'badge-default'">
                  {{ article.status === 'published' ? '발행' : '초안' }}
                </span>
              </td>
              <td>
                <span class="badge" :class="{
                  'badge-success': article.reviewStatus === 'approved',
                  'badge-warning': article.reviewStatus === 'needs_review' || article.reviewStatus === 'candidate',
                  'badge-danger': article.reviewStatus === 'retracted' || article.reviewStatus === 'rejected'
                }">
                  {{ article.reviewStatus || 'approved' }}
                </span>
              </td>
              <td><strong>{{ article.viewCount?.toLocaleString() || 0 }}</strong></td>
              <td class="text-mono">
                <div>게시: {{ formatDate(article.firstPublishedAt || article.publishedAt) }}</div>
                <div v-if="article.updatedAt" class="text-subdate">수정: {{ formatDate(article.updatedAt) }}</div>
              </td>
              <td class="action-cell">
                <NuxtLink :to="`/admin/articles/${article.id}`" class="btn-action edit">편집</NuxtLink>
                <a :href="`/news/${article.category}/article/${article.id}`" target="_blank" class="btn-action view">보기 ↗</a>
                <button
                  v-if="article.status === 'published'"
                  type="button"
                  class="btn-action retract"
                  :disabled="retractingId === article.id"
                  @click="retractArticle(article.id)"
                >
                  {{ retractingId === article.id ? '철회 중...' : '철회' }}
                </button>
                <button
                  type="button"
                  class="btn-action delete"
                  :disabled="deletingId === article.id"
                  @click="removeArticle(article.id)"
                >
                  {{ deletingId === article.id ? '삭제 중...' : '삭제' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.filter-tabs {
  display: flex;
  gap: 8px;
}
.filter-tabs button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--admin-border);
  background: var(--admin-card);
  border-radius: 4px;
  cursor: pointer;
}
.filter-tabs button.active {
  background: var(--accent);
  color: #0d0e1a;
  border-color: var(--accent);
}
.search-box input {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--admin-border);
  border-radius: 4px;
  width: 240px;

  background: var(--admin-input);
  color: var(--admin-text);}
.article-info-cell {
  max-width: 320px;
}
.article-title-link {
  font-weight: 700;
  color: var(--admin-heading);
  text-decoration: none;
}
.article-title-link:hover {
  color: var(--accent);
  text-decoration: underline;
}
.article-submeta {
  font-size: 11px;
  color: var(--admin-muted);
  margin-top: 3px;
  font-family: 'DM Mono', monospace;
}
.action-cell {
  white-space: nowrap;
}
.btn-action {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 3px;
  text-decoration: none;
  margin-right: 4px;
  border: 1px solid transparent;
  cursor: pointer;
}
.btn-action.edit {
  color: var(--accent);
  border-color: var(--admin-border);
  background: var(--accent-dim);
}
.btn-action.view {
  color: #10b981;
  border-color: #A7F3D0;
  background: rgba(16, 185, 129, 0.15);
}
.btn-action.retract {
  color: #f59e0b;
  border-color: #FDE68A;
  background: rgba(245, 158, 11, 0.15);
}
.btn-action.delete {
  color: #f87171;
  border-color: #FECACA;
  background: rgba(239, 68, 68, 0.15);
}
.badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.badge-success { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.badge-warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.badge-danger { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.badge-default { background: var(--admin-surface); color: var(--admin-text); }
.text-mono {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
}
.text-subdate {
  color: var(--admin-muted);
  font-size: 10px;
}
.tag-cat {
  font-size: 11px;
  background: var(--admin-surface);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
</style>

