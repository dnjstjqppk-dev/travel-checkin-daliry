<script setup lang="ts">
import NewsArticleCard from '~/components/NewsArticleCard.vue'
import type { Article } from '~/stores/articles'

const { locUrl } = useI18n()
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
  <div class="ttr-page-container ttr-saved-root">
    <!-- Terminal Breadcrumb -->
    <nav class="ttr-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink :to="locUrl('/news')" class="ttr-bc-link">HOME</NuxtLink>
      <span class="ttr-bc-sep">/</span>
      <span class="ttr-bc-current">SAVED SCRAPBOOK</span>
    </nav>

    <!-- Terminal Header Bar -->
    <div class="ttr-list-header-bar">
      <div class="ttr-list-title-group">
        <span class="ttr-color-bar" />
        <div>
          <div class="ttr-kicker-tag">
            <span class="ping-dot" />
            <span>LOCAL TERMINAL CACHE</span>
          </div>
          <h1 class="ttr-list-page-title">MY SCRAPBOOK (저장된 와이어)</h1>
        </div>
      </div>
      <div class="ttr-list-count">
        <span class="count-badge">SAVED</span> {{ articles.length }} ARTICLES
      </div>
    </div>

    <!-- Terminal Cache Info Banner -->
    <div class="ttr-storage-badge">
      <span class="badge-icon">🔒</span>
      <span class="badge-text">스크랩 기사는 현재 사용 중인 단말기의 브라우저 암호화 로컬 캐시(LocalStorage)에 안전하게 저장됩니다. (별도 계정 로그인 없이 무제한 이용 가능)</span>
    </div>

    <ClientOnly>
      <div v-if="loading" class="ttr-saved-loading">
        <p>로컬 스크랩 아카이브를 로드하는 중입니다...</p>
      </div>
      <div v-else-if="articles.length" class="ttr-card-grid-3">
        <NewsArticleCard v-for="article in articles" :key="article.id" :article="article" />
      </div>
      <div v-else class="ttr-saved-empty">
        <div class="ttr-empty-icon">📂</div>
        <h3>스크랩한 기사가 없습니다</h3>
        <p>기사 카드의 [☆ 저장] 버튼을 누르면 언제든지 오프라인/로컬 캐시에서 즉시 불러올 수 있습니다.</p>
        <NuxtLink :to="locUrl('/news')" class="ttr-btn-explore">실시간 뉴스 터미널 탐색 →</NuxtLink>
      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.ttr-saved-root {
  max-width: 1360px;
  margin: 0 auto;
  padding: 24px 20px 80px;
}

.ttr-breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  margin-bottom: 18px;
  color: var(--text-muted, #8b949e);
  letter-spacing: 0.8px;
}

.ttr-bc-link {
  color: var(--text-muted, #8b949e);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s;
}

.ttr-bc-link:hover {
  color: #00d4aa;
}

.ttr-bc-sep {
  color: #383b52;
}

.ttr-bc-current {
  color: #00d4aa;
  font-weight: 700;
}

.ttr-list-header-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 1px solid var(--border, #23253a);
  padding-bottom: 18px;
  margin-bottom: 24px;
}

.ttr-list-title-group {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.ttr-color-bar {
  width: 4px;
  height: 48px;
  background: #00d4aa;
  border-radius: 2px;
  flex-shrink: 0;
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.4);
}

.ttr-kicker-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  color: #00d4aa;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.ping-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d4aa;
  box-shadow: 0 0 8px #00d4aa;
}

.ttr-list-page-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: #e6edf3;
  letter-spacing: -0.6px;
}

.ttr-list-count {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
  font-family: 'DM Mono', monospace;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  padding: 2px 6px;
  border-radius: 3px;
  color: #00d4aa;
  font-size: 10px;
  font-weight: 700;
}

.ttr-storage-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--text-muted, #8b949e);
  margin-bottom: 28px;
  line-height: 1.5;
}

.badge-icon {
  font-size: 16px;
}

.ttr-card-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
}

.ttr-saved-loading {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted, #8b949e);
  font-size: 14px;
}

.ttr-saved-empty {
  padding: 80px 24px;
  text-align: center;
  background: var(--bg-surface, #13141f);
  border: 1px dashed var(--border, #23253a);
  border-radius: 8px;
  max-width: 580px;
  margin: 40px auto;
}

.ttr-empty-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.ttr-saved-empty h3 {
  font-size: 18px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 10px;
}

.ttr-saved-empty p {
  font-size: 13.5px;
  color: var(--text-muted, #8b949e);
  line-height: 1.6;
  margin: 0 0 24px;
}

.ttr-btn-explore {
  display: inline-block;
  background: var(--bg-card, #181927);
  border: 1px solid #00d4aa;
  color: #00d4aa;
  padding: 12px 28px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  text-decoration: none;
  letter-spacing: 0.5px;
  transition: all 0.2s;
}

.ttr-btn-explore:hover {
  background: #00d4aa;
  color: #0d0e1a;
  box-shadow: 0 0 16px rgba(0, 212, 170, 0.3);
}

@media (max-width: 1024px) {
  .ttr-card-grid-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .ttr-saved-root {
    padding: 16px 12px 48px;
  }
  .ttr-list-header-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .ttr-list-page-title {
    font-size: 20px;
  }
  .ttr-card-grid-3 {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}
</style>

