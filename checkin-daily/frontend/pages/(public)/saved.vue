<script setup lang="ts">
import NewsArticleCard from '~/components/NewsArticleCard.vue'
import type { Article } from '~/stores/articles'

const store = useArticlesStore()
const savedStore = useSavedStore()
const requestFetch = useRequestFetch()

const articles = ref<Article[]>([])
const loading = ref(true)

onMounted(async () => {
  savedStore.load()
  if (savedStore.ids.length === 0 && savedStore.slugs.length === 0) {
    articles.value = []
    loading.value = false
    return
  }

  try {
    const idsQuery = savedStore.ids.join(',')
    if (idsQuery) {
      const res = await requestFetch<any>('/api/articles', { query: { ids: idsQuery, limit: 50 } })
      articles.value = Array.isArray(res) ? res : (res?.data || [])
    } else {
      // Fallback for legacy slug bookmarks
      await store.load({ limit: 50 })
      articles.value = store.articles.filter((a) => savedStore.has(a.slug))
    }
  } catch {
    articles.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="bkp-page-container bkp-saved-root">
    <nav class="bkp-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink to="/news" class="bkp-bc-link">HOME</NuxtLink>
      <span class="bkp-bc-sep">›</span>
      <span class="bkp-bc-current">SAVED SCRAPBOOK</span>
    </nav>

    <div class="bkp-list-header-bar">
      <div class="bkp-list-title-group">
        <span class="bkp-color-bar default" />
        <h1 class="bkp-list-page-title">MY SCRAPBOOK (나의 스크랩북)</h1>
      </div>
      <div class="bkp-list-count">
        총 {{ articles.length }}개의 저장된 기사
      </div>
    </div>

    <!-- 브라우저 로컬 저장소 안내 뱃지 -->
    <div class="bkp-storage-badge">
      <span class="badge-icon">ℹ️</span>
      <span class="badge-text">스크랩 기사는 현재 사용 중인 기기의 브라우저 로컬 저장소(LocalStorage)에 안전하게 보관됩니다. (별도 회원가입 없이 즉시 이용 가능)</span>
    </div>

    <ClientOnly>
      <div v-if="loading" class="bkp-saved-loading">
        <p>저장된 기사를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="articles.length" class="bkp-card-grid-3">
        <NewsArticleCard v-for="article in articles" :key="article.id" :article="article" />
      </div>
      <div v-else class="bkp-saved-empty">
        <div class="bkp-empty-icon">📌</div>
        <h3>스크랩한 기사가 없습니다</h3>
        <p>관심 있는 기사의 [☆ 스크랩] 버튼을 누르면 언제든지 이곳에서 다시 읽으실 수 있습니다.</p>
        <NuxtLink to="/news" class="bkp-btn-explore">최신 뉴스 둘러보기 →</NuxtLink>
      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.bkp-saved-root {
  padding: 20px 0 60px;
}

.bkp-breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  margin-bottom: 16px;
  color: #6B7280;
}

.bkp-bc-link {
  color: #6B7280;
  text-decoration: none;
  font-weight: 700;
}

.bkp-bc-sep {
  color: #9CA3AF;
}

.bkp-bc-current {
  color: #060D81;
  font-weight: 700;
}

.bkp-list-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #060D81;
  padding-bottom: 12px;
  margin-bottom: 24px;
}

.bkp-list-title-group {
  display: flex;
  align-items: center;
}

.bkp-color-bar.default {
  width: 5px;
  height: 22px;
  background: #D0021B;
  margin-right: 12px;
  display: inline-block;
}

.bkp-list-page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.5px;
}

.bkp-list-count {
  font-size: 12px;
  color: #6B7280;
  font-family: 'DM Mono', monospace;
}

.bkp-card-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.bkp-saved-empty {
  padding: 80px 20px;
  text-align: center;
  background: #F9FAFB;
  border: 1px dashed #D1D5DB;
  border-radius: 6px;
  max-width: 560px;
  margin: 40px auto;
}

.bkp-empty-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.bkp-saved-empty h3 {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 8px;
}

.bkp-saved-empty p {
  font-size: 14px;
  color: #6B7280;
  line-height: 1.6;
  margin: 0 0 24px;
}

.bkp-btn-explore {
  display: inline-block;
  background: #060D81;
  color: #FFFFFF;
  padding: 10px 24px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  letter-spacing: 0.5px;
}

@media (max-width: 900px) {
  .bkp-card-grid-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .bkp-saved-root {
    padding: 12px 0 40px;
  }
  .bkp-list-header-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .bkp-list-page-title {
    font-size: 20px;
  }
  .bkp-card-grid-3 {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>