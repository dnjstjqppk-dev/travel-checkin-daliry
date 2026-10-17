<script setup lang="ts">
import type { Article } from '~/stores/articles'

const { locUrl } = useI18n()
const store = useArticlesStore()

const articles = computed(() => {
  return (store.articles || []).slice(0, 5)
})

const currentIndex = ref(0)
let timer: any = null

onMounted(() => {
  timer = setInterval(() => {
    if (articles.value.length > 0) {
      currentIndex.value = (currentIndex.value + 1) % articles.value.length
    }
  }, 4500)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const currentArticle = computed(() => articles.value[currentIndex.value] || null)
</script>

<template>
  <div v-if="articles.length > 0" class="breaking-ticker-bar">
    <div class="ticker-inner">
      <div class="ticker-label">
        <span class="live-dot" />
        <span class="label-text">BREAKING NEWS</span>
      </div>

      <div class="ticker-content">
        <Transition name="ticker-fade" mode="out-in">
          <NuxtLink
            v-if="currentArticle"
            :key="currentArticle.id"
            :to="locUrl(`/news/${currentArticle.category}/article/${currentArticle.id}`)"
            class="ticker-headline"
          >
            <span class="ticker-cat">[{{ currentArticle.category.toUpperCase() }}]</span>
            <span class="ticker-title">{{ currentArticle.title }}</span>
          </NuxtLink>
        </Transition>
      </div>

      <div class="ticker-counter">
        {{ currentIndex + 1 }} / {{ articles.length }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.breaking-ticker-bar {
  background: #0f172a;
  color: #f8fafc;
  padding: 8px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  border-bottom: 2px solid #176B52;
}

.ticker-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.ticker-label {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #dc2626;
  color: #ffffff;
  font-size: 11px;
  font-weight: 900;
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.live-dot {
  width: 6px;
  height: 6px;
  background-color: #ffffff;
  border-radius: 50%;
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.8); }
}

.ticker-content {
  flex: 1;
  overflow: hidden;
  height: 22px;
  display: flex;
  align-items: center;
}

.ticker-headline {
  color: #f1f5f9;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.ticker-headline:hover .ticker-title {
  text-decoration: underline;
  color: #6ee7b7;
}

.ticker-cat {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
}

.ticker-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticker-counter {
  font-size: 11px;
  color: #64748b;
  font-weight: 700;
  white-space: nowrap;
}

.ticker-fade-enter-active,
.ticker-fade-leave-active {
  transition: all 0.35s ease;
}

.ticker-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.ticker-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

