<script setup lang="ts">
const route = useRoute()
const router = useRouter()

export interface DesignOption {
  id: string
  name: string
  tagline: string
  badge: string
  color: string
}

const designs: DesignOption[] = [
  {
    id: '1',
    name: '안 1. 모던 인텔리전스',
    tagline: 'Skift 벤치마크 · 3줄 팩트 브리핑 & 속보 티커',
    badge: '인텔리전스',
    color: '#d97706',
  },
  {
    id: '2',
    name: '안 2. 에디토리얼 매거진',
    tagline: 'NYT/Monocle 벤치마크 · 세리프 & 시네마틱 화보',
    badge: '클래식 매거진',
    color: '#183b32',
  },
  {
    id: '3',
    name: '안 3. 비주얼 벤토 덱',
    tagline: 'Lonely Planet 벤치마크 · 벤토 그리드 & 가로 필터',
    badge: '비주얼 벤토',
    color: '#0284c7',
  },
]

const currentDesign = useState<string>('current-design-concept', () => '1')

onMounted(() => {
  const queryDesign = typeof route.query.design === 'string' ? route.query.design : ''
  if (['1', '2', '3'].includes(queryDesign)) {
    currentDesign.value = queryDesign
  } else {
    const saved = localStorage.getItem('checkin-design-concept')
    if (saved && ['1', '2', '3'].includes(saved)) {
      currentDesign.value = saved
    }
  }
  applyDesign(currentDesign.value)
})

watch(() => route.query.design, (newDesign) => {
  if (typeof newDesign === 'string' && ['1', '2', '3'].includes(newDesign)) {
    currentDesign.value = newDesign
    applyDesign(newDesign)
  }
})

function applyDesign(id: string) {
  if (!import.meta.client) return
  document.documentElement.dataset.design = id
  localStorage.setItem('checkin-design-concept', id)
}

function selectDesign(id: string) {
  currentDesign.value = id
  applyDesign(id)
  router.replace({
    query: {
      ...route.query,
      design: id,
    },
  })
}
</script>

<template>
  <aside class="design-switcher-bar" aria-label="UXUI 디자인 시안 실시간 선택기">
    <div class="page-wrap switcher-inner">
      <div class="switcher-brand">
        <span class="switcher-dot" />
        <strong>UX/UI 시안 비교</strong>
        <span class="switcher-hint">원하는 시안을 클릭하면 실시간 반영됩니다</span>
      </div>
      <div class="switcher-tabs">
        <button
          v-for="d in designs"
          :key="d.id"
          type="button"
          class="switcher-btn"
          :class="{ active: currentDesign === d.id }"
          @click="selectDesign(d.id)"
        >
          <span class="btn-num">0{{ d.id }}</span>
          <span class="btn-text">
            <strong>{{ d.name.replace(/^안 \d\.\s*/, '') }}</strong>
            <small>{{ d.badge }}</small>
          </span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.design-switcher-bar {
  background: #0f172a;
  color: #f8fafc;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  padding: 8px 0;
  font-size: 12px;
  position: sticky;
  top: 0;
  z-index: 999;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
}

.switcher-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.switcher-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.switcher-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.switcher-hint {
  color: #94a3b8;
  font-size: 11px;
}

.switcher-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.switcher-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.switcher-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.3);
}

.switcher-btn.active {
  background: #ffffff;
  color: #0f172a;
  border-color: #ffffff;
  box-shadow: 0 2px 8px rgba(255, 255, 255, 0.2);
}

.btn-num {
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  font-size: 11px;
  opacity: 0.7;
}

.switcher-btn.active .btn-num {
  color: #d97706;
}

.btn-text {
  display: flex;
  flex-direction: column;
  text-align: left;
  line-height: 1.2;
}

.btn-text strong {
  font-size: 12px;
  font-weight: 600;
}

.btn-text small {
  font-size: 10px;
  opacity: 0.75;
}

@media (max-width: 768px) {
  .switcher-hint { display: none; }
  .switcher-tabs { width: 100%; justify-content: stretch; }
  .switcher-btn { flex: 1; justify-content: center; padding: 6px 8px; }
  .btn-text small { display: none; }
}
</style>

