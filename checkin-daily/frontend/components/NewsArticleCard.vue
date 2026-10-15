<script setup lang="ts">
import type { Article } from '~/stores/articles'

defineProps<{
  article: Article
  rank?: number
}>()
const savedStore = useSavedStore()

function hasCoverImage(article: Article) {
  return Boolean(article.coverImage && /^https:\/\//i.test(article.coverImage))
}

const { locale, t } = useI18n()

function getCategoryLabel(cat: string) {
  const map: Record<string, string> = {
    major: t('major'),
    airline: t('airline'),
    hotel: t('hotel'),
    destination: t('destination'),
    realtime: t('realtime'),
    region: t('region'),
  }
  return map[cat] || t(cat) || cat
}

function locUrl(path: string) {
  if (locale.value === 'en') {
    return path.startsWith('/en') ? path : `/en${path.startsWith('/') ? '' : '/'}${path}`
  }
  return path.replace(/^\/en/, '') || '/news'
}
</script>

<template>
  <article class="news-card bkp-news-card">
    <NuxtLink :to="locUrl(`/news/${article.category}/article/${article.id}`)" class="bkp-card-link">
      <div class="bkp-card-thumb" :class="`category-art-${article.category}`">
        <span v-if="rank" class="bkp-card-rank-badge" :class="{ 'top-three': rank <= 3 }">{{ locale === 'en' ? `#${rank}` : `${rank}위` }}</span>
        <img v-if="hasCoverImage(article)" :src="article.coverImage" :alt="article.title" loading="lazy">
        <div v-else class="bkp-card-placeholder" />
        <span class="bkp-card-tag">{{ getCategoryLabel(article.category) }}</span>
      </div>
      <div class="bkp-card-info">
        <div class="bkp-card-meta">
          <span>{{ article.publishedAt?.slice(0, 10) || 'LATEST' }}</span>
          <span v-if="article.viewCount">· {{ article.viewCount.toLocaleString('ko-KR') }} {{ locale === 'en' ? 'views' : '조회' }}</span>
        </div>
        <h3 class="bkp-card-headline">{{ article.title }}</h3>
        <p class="bkp-card-desc">{{ article.summary }}</p>
        <div v-if="article.cities?.length" class="bkp-card-locations">
          <span v-for="city in article.cities" :key="city.id" class="bkp-loc-chip">
            {{ city.countryCode }} · {{ locale === 'en' ? city.nameEn : city.nameKo }}
          </span>
        </div>
      </div>
    </NuxtLink>
    <div class="bkp-card-action">
      <button class="bkp-card-save" type="button" @click="savedStore.toggle(article.slug)">
        {{ savedStore.has(article.slug) ? (locale === 'en' ? '★ SAVED' : '★ 저장됨') : (locale === 'en' ? '☆ SAVE' : '☆ 스크랩') }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.bkp-news-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
}

.bkp-news-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(6, 13, 129, 0.09);
  border-color: #CBD5E1;
}

.bkp-card-link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.bkp-card-thumb {
  height: 180px;
  position: relative;
  overflow: hidden;
  background: #060D81;
}

.bkp-card-rank-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(15, 23, 42, 0.88);
  color: #FFFFFF;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  z-index: 2;
  letter-spacing: 0.5px;
}

.bkp-card-rank-badge.top-three {
  background: #D0021B;
  color: #FFFFFF;
  box-shadow: 0 2px 8px rgba(208, 2, 27, 0.4);
}

.bkp-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.bkp-news-card:hover .bkp-card-thumb img {
  transform: scale(1.04);
}

.bkp-card-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #060D81 0%, #1E3A8A 100%);
}

.bkp-card-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  background: #060D81;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 2px;
  letter-spacing: 0.5px;
}

.bkp-card-info {
  padding: 14px 16px 8px;
}

.bkp-card-meta {
  font-size: 11px;
  color: #6B7280;
  margin-bottom: 6px;
  font-family: 'DM Mono', monospace;
}

.bkp-card-headline {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.45;
  color: #111827;
  margin: 0 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bkp-news-card:hover .bkp-card-headline {
  color: #060D81;
}

.bkp-card-desc {
  font-size: 13px;
  color: #4B5563;
  line-height: 1.6;
  margin: 0 0 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bkp-card-locations {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 8px;
}

.bkp-loc-chip {
  font-size: 10px;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  color: #060D81;
  padding: 2px 6px;
  border-radius: 2px;
}

.bkp-card-action {
  padding: 0 16px 14px;
  display: flex;
  justify-content: flex-end;
}

.bkp-card-save {
  background: transparent;
  border: 0;
  color: #060D81;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 0;
}

.bkp-card-save:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .bkp-news-card {
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .bkp-card-link {
    display: flex;
    flex-direction: row-reverse;
    gap: 12px;
    padding: 12px 14px 6px;
    align-items: stretch;
  }
  .bkp-card-thumb {
    width: 106px;
    height: 78px;
    min-width: 106px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .bkp-card-tag {
    font-size: 9px;
    padding: 2px 5px;
    top: 5px;
    left: 5px;
  }
  .bkp-card-info {
    padding: 0;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .bkp-card-meta {
    font-size: 10px;
    margin-bottom: 2px;
  }
  .bkp-card-headline {
    font-size: 14px;
    line-height: 1.35;
    margin-bottom: 3px;
  }
  .bkp-card-desc {
    font-size: 12px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 4px;
    color: #6B7280;
  }
  .bkp-card-locations {
    display: none;
  }
  .bkp-card-action {
    padding: 0 14px 8px;
  }
}
</style>
