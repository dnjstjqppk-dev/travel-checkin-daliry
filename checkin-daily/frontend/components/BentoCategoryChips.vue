<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const chips = [
  { id: '', label: '🌏 전체 보기', emoji: '🌏' },
  { id: 'major', label: '⚡ 헤드라인', emoji: '⚡' },
  { id: 'airline', label: '✈️ 항공 & 마일리지', emoji: '✈️' },
  { id: 'hotel', label: '🏨 호텔 & 스테이', emoji: '🏨' },
  { id: 'destination', label: '📍 여행지 탐색', emoji: '📍' },
  { id: 'realtime', label: '🔥 실시간 랭킹', emoji: '🔥' },
]

const currentCategory = computed(() => {
  if (route.params.category) return String(route.params.category)
  if (route.path.includes('/news/major')) return 'major'
  if (route.path.includes('/news/airline')) return 'airline'
  if (route.path.includes('/news/hotel')) return 'hotel'
  if (route.path.includes('/news/destination')) return 'destination'
  if (route.path.includes('/news/realtime')) return 'realtime'
  return ''
})

function selectCategory(id: string) {
  if (!id) {
    router.push('/news')
  } else {
    router.push(`/news/${id}`)
  }
}
</script>

<template>
  <div class="bento-chips-bar" aria-label="빠른 여행 카테고리 탐색">
    <div class="chips-scroll">
      <button
        v-for="c in chips"
        :key="c.id"
        type="button"
        class="chip-pill"
        :class="{ active: currentCategory === c.id }"
        @click="selectCategory(c.id)"
      >
        <span>{{ c.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.bento-chips-bar {
  margin: 18px 0 24px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.bento-chips-bar::-webkit-scrollbar {
  display: none;
}

.chips-scroll {
  display: flex;
  gap: 8px;
  padding: 4px 2px;
}

.chip-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #334155;
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.chip-pill:hover {
  border-color: #0284c7;
  color: #0284c7;
  transform: translateY(-1px);
}

.chip-pill.active {
  background: #0284c7;
  border-color: #0284c7;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
}
</style>

