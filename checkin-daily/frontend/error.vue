<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const is404 = computed(() => props.error.statusCode === 404)
const statusCode = computed(() => props.error.statusCode || 500)
const statusMessage = computed(() => {
  if (is404.value) return '요청하신 페이지를 찾을 수 없습니다'
  return props.error.statusMessage || props.error.message || '시스템 처리 중 일시적인 오류가 발생했습니다'
})

function handleError() {
  clearError({ redirect: '/news' })
}
</script>

<template>
  <div class="error-page-container">
    <div class="error-card">
      <div class="brand-badge">CHECK-IN DAILY // SYSTEM NOTICE</div>
      
      <div class="error-status-code">{{ statusCode }}</div>
      
      <h1 class="error-title">{{ statusMessage }}</h1>
      
      <p class="error-description">
        <template v-if="is404">
          페이지 주소가 잘못 입력되었거나, 변경 또는 삭제되어 현재 이용할 수 없습니다.<br>
          아래 버튼을 눌러 최신 여행 인텔리전스 뉴스 홈으로 이동해 주세요.
        </template>
        <template v-else>
          일시적인 서버 통신 장애가 발생했습니다. 잠시 후 다시 시도해 주시거나 뉴스 홈으로 이동해 주세요.
        </template>
      </p>

      <div class="error-actions">
        <button class="btn-primary" type="button" @click="handleError">
          ← 뉴스 홈으로 돌아가기
        </button>
        <NuxtLink to="/news/major" class="btn-secondary">
          주요 뉴스 보기
        </NuxtLink>
      </div>

      <div class="quick-links">
        <span class="quick-label">빠른 카테고리:</span>
        <NuxtLink to="/news/airline">항공</NuxtLink>
        <span class="dot">•</span>
        <NuxtLink to="/news/hotel">호텔</NuxtLink>
        <span class="dot">•</span>
        <NuxtLink to="/news/destination">여행지</NuxtLink>
        <span class="dot">•</span>
        <NuxtLink to="/news/realtime">실시간 이슈</NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-page-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-primary);
  color: var(--text-base);
  padding: 32px 16px;
  font-family: var(--font-sans);
}

.error-card {
  max-width: 580px;
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 48px 36px;
  text-align: center;
  box-shadow: var(--shadow-card);
}

.brand-badge {
  display: inline-block;
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--accent);
  background: var(--accent-dim);
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid var(--accent);
  margin-bottom: 24px;
}

.error-status-code {
  font-family: var(--font-display);
  font-size: 80px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-primary);
  letter-spacing: -2px;
  margin-bottom: 16px;
}

.error-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 14px 0;
  line-height: 1.4;
}

.error-description {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 32px 0;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.btn-primary {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  font-weight: 700;
  font-size: 14px;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  padding: 12px 24px;
  border-radius: 6px;
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--bg-card);
  border-color: var(--border-strong);
}

.quick-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  padding-top: 20px;
  flex-wrap: wrap;
}

.quick-label {
  font-size: 12px;
  color: var(--text-dim);
}

.quick-links a {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}

.quick-links a:hover {
  color: var(--accent);
}

.dot {
  color: var(--border-strong);
}
</style>

