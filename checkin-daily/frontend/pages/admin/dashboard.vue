<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const store = useArticlesStore()
const filters = ref<'all' | 'published' | 'draft'>('all')
const search = ref('')
const { error: loadError } = await useAsyncData('admin-articles', () => store.load('', true))
const deleting = ref<number | null>(null)
const filterTabs = computed(() => [
  { id: 'all' as const, label: '전체', count: store.articles.length },
  { id: 'published' as const, label: '발행됨', count: publishedCount.value },
  { id: 'draft' as const, label: '초안', count: draftCount.value },
])

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
}

const publishedCount = computed(() => store.articles.filter((article) => article.status === 'published').length)
const draftCount = computed(() => store.articles.filter((article) => article.status === 'draft').length)
const filteredArticles = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return [...store.articles]
    .filter((article) => filters.value === 'all' || article.status === filters.value)
    .filter((article) => !query || [article.title, article.summary, article.category].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((left, right) => new Date(right.updatedAt ?? right.createdAt).getTime() - new Date(left.updatedAt ?? left.createdAt).getTime())
})

async function removeArticle(id: number) {
  if (!window.confirm('이 기사를 삭제할까요? 삭제한 콘텐츠는 복구할 수 없습니다.')) return
  deleting.value = id
  try {
    await store.remove(id)
  } catch {
    store.error = '기사를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">CONTENT OVERVIEW</p>
        <h1>뉴스룸 현황 <span aria-hidden="true">✦</span></h1>
        <p class="admin-heading-copy">오늘의 뉴스룸 콘텐츠와 발행 현황을 확인하세요.</p>
      </div>
      <NuxtLink class="button button-primary admin-create-button" to="/admin/articles/new"><span aria-hidden="true">＋</span> 새 기사 작성</NuxtLink>
    </div>

    <p v-if="loadError || store.error" class="admin-alert" role="alert">{{ store.error || '기사 목록을 불러오지 못했습니다.' }}</p>

    <div class="admin-stats" aria-label="콘텐츠 요약">
      <article class="admin-stat-card">
        <span class="admin-stat-label">전체 콘텐츠</span>
        <strong>{{ store.articles.length }}</strong>
        <span class="admin-stat-note">뉴스룸에 등록된 기사</span>
      </article>
      <article class="admin-stat-card">
        <span class="admin-stat-label">발행됨</span>
        <strong>{{ publishedCount }}</strong>
        <span class="admin-stat-note"><span class="admin-online-dot" aria-hidden="true"></span> 독자에게 공개 중</span>
      </article>
      <article class="admin-stat-card">
        <span class="admin-stat-label">초안</span>
        <strong>{{ draftCount }}</strong>
        <span class="admin-stat-note">검토 또는 작성 중</span>
      </article>
    </div>

    <section class="admin-content-panel">
      <div class="admin-panel-heading">
        <div>
          <h2>콘텐츠 목록</h2>
          <p>기사의 발행 상태와 내용을 관리합니다.</p>
        </div>
        <label class="admin-search">
          <span aria-hidden="true">⌕</span>
          <input v-model="search" type="search" placeholder="기사 제목 검색" aria-label="기사 제목 검색">
        </label>
      </div>

      <div class="admin-list-toolbar">
        <div class="admin-filter-tabs" role="group" aria-label="발행 상태 필터">
          <button v-for="tab in filterTabs" :key="tab.id" type="button" :class="{ active: filters === tab.id }" @click="filters = tab.id">{{ tab.label }} <span>{{ tab.count }}</span></button>
        </div>
        <span class="admin-result-count">{{ filteredArticles.length }}개 기사</span>
      </div>

      <div v-if="filteredArticles.length" class="admin-table-scroll">
        <table class="admin-table admin-articles-table">
          <thead><tr><th>기사</th><th>카테고리</th><th>지역</th><th>상태</th><th>최종 수정</th><th>관리</th></tr></thead>
          <tbody>
            <tr v-for="article in filteredArticles" :key="article.id">
              <td class="admin-article-cell">
                <NuxtLink :to="`/admin/articles/${article.id}`" class="admin-article-title">{{ article.title }}</NuxtLink>
                <span class="admin-article-slug">/{{ article.slug }}</span>
              </td>
              <td><span class="admin-category-pill">{{ article.category }}</span></td>
              <td class="admin-location-cell">{{ article.cities?.map((city) => city.nameKo).join(', ') || '전체 지역' }}</td>
              <td><span class="admin-status" :class="article.status">{{ article.status === 'published' ? '발행됨' : '초안' }}</span></td>
              <td class="admin-date-cell">{{ formatDate(article.updatedAt ?? article.createdAt) }}</td>
              <td class="admin-row-actions">
                <NuxtLink :to="`/admin/articles/${article.id}`" :aria-label="`${article.title} 수정`">수정</NuxtLink>
                <button type="button" :disabled="deleting === article.id" :aria-label="`${article.title} 삭제`" @click="removeArticle(article.id)">{{ deleting === article.id ? '삭제 중' : '삭제' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="admin-empty-state">
        <span class="admin-empty-icon" aria-hidden="true">✎</span>
        <strong>{{ search ? '검색 결과가 없습니다' : filters === 'all' ? '아직 등록된 기사가 없습니다' : filters === 'draft' ? '저장된 초안이 없습니다' : '발행된 기사가 없습니다' }}</strong>
        <p>{{ search ? '다른 제목이나 키워드로 검색해 보세요.' : '첫 기사를 작성해 뉴스룸을 채워보세요.' }}</p>
        <NuxtLink v-if="!search && filters === 'all'" class="button button-primary" to="/admin/articles/new">첫 기사 작성</NuxtLink>
      </div>
    </section>
  </section>
</template>