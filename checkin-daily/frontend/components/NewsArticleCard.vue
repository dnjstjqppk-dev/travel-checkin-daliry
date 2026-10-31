<script setup lang="ts">
import type { Article } from '~/stores/articles'

defineProps<{
  article: Article
  rank?: number
}>()
const savedStore = useSavedStore()
const coverFailed = ref(false)

function hasCoverImage(article: Article) {
  return Boolean(article.coverImage && (/^https?:\/\//i.test(article.coverImage) || article.coverImage.startsWith('/')))
}

const { locale, t, locUrl } = useI18n()

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
</script>

<template>
  <article class="ttr-card">
    <NuxtLink :to="locUrl(`/news/${article.category}/article/${article.id}`)" class="ttr-card-link">
      <div class="ttr-card-thumb">
        <span v-if="rank" class="ttr-rank-badge" :class="{ 'top-three': rank <= 3 }">
          {{ locale === 'en' ? `#${rank}` : `${rank}위` }}
        </span>
        <img v-if="hasCoverImage(article) && !coverFailed" :src="article.coverImage" :alt="article.title" loading="lazy" @error="coverFailed = true">
        <div v-else class="ttr-card-placeholder">
          <span>CHECK-IN DAILY</span>
        </div>
        <span class="ttr-card-tag">{{ getCategoryLabel(article.category) }}</span>
      </div>

      <div class="ttr-card-info">
        <div class="ttr-card-meta">
          <span>{{ article.publishedAt?.slice(0, 10) || 'LATEST' }}</span>
          <span v-if="article.viewCount">· {{ article.viewCount.toLocaleString('ko-KR') }} {{ locale === 'en' ? 'views' : '조회' }}</span>
        </div>

        <h3 class="ttr-card-headline">{{ article.title }}</h3>
        <p class="ttr-card-desc">{{ article.summary }}</p>

        <div v-if="article.cities?.length" class="ttr-card-locations">
          <span v-for="city in article.cities" :key="city.id" class="ttr-loc-chip">
            {{ city.countryCode }} · {{ locale === 'en' ? city.nameEn : city.nameKo }}
          </span>
        </div>
      </div>
    </NuxtLink>

    <div class="ttr-card-action">
      <button class="ttr-card-save" type="button" @click="savedStore.toggle(article.slug)">
        {{ savedStore.has(article.slug) ? (locale === 'en' ? '★ SAVED' : '★ 저장됨') : (locale === 'en' ? '☆ SAVE' : '☆ 스크랩') }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.ttr-card {
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s, box-shadow 0.2s;
}

.ttr-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent, #00d4aa);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
}

.ttr-card-link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.ttr-card-thumb {
  height: 175px;
  position: relative;
  overflow: hidden;
  background: var(--bg-input, #11121d);
}

.ttr-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
}

.ttr-card:hover .ttr-card-thumb img {
  transform: scale(1.04);
}

.ttr-card-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #13141f 0%, #1f2338 100%);
  color: var(--text-dim, #7d8696);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}

.ttr-rank-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(13, 14, 26, 0.85);
  backdrop-filter: blur(4px);
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--border, #23253a);
  z-index: 2;
}

.ttr-rank-badge.top-three {
  background: rgba(0, 212, 170, 0.2);
  color: var(--accent, #00d4aa);
  border-color: rgba(0, 212, 170, 0.4);
}

.ttr-card-tag {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(13, 14, 26, 0.85);
  backdrop-filter: blur(4px);
  color: var(--accent, #00d4aa);
  border: 1px solid rgba(0, 212, 170, 0.3);
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  z-index: 2;
}

.ttr-card-info {
  padding: 14px 16px 12px;
}

.ttr-card-meta {
  font-size: 11px;
  color: var(--text-muted, #8e99aa);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ttr-verified-dot {
  color: var(--accent, #00d4aa);
  font-weight: 800;
  font-size: 10px;
  background: rgba(0, 212, 170, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(0, 212, 170, 0.25);
}

.ttr-card-headline {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
  color: var(--text-primary, #f0f4f8);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color 0.15s ease;
}

.ttr-card:hover .ttr-card-headline {
  color: var(--accent, #00d4aa);
}

.ttr-card-desc {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: var(--text-secondary, #d2d9e3);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ttr-card-locations {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ttr-loc-chip {
  background: var(--bg-input, #11121d);
  color: var(--text-muted, #8e99aa);
  border: 1px solid var(--border, #23253a);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}

.ttr-card-action {
  padding: 10px 16px;
  border-top: 1px solid var(--border, #23253a);
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.1);
}

.ttr-card-save {
  background: transparent;
  border: none;
  color: var(--text-muted, #8e99aa);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
  transition: color 0.15s ease;
}

.ttr-card-save:hover {
  color: var(--accent, #00d4aa);
}
</style>
