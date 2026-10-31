<script setup lang="ts">
import type { Article } from '~/stores/articles'

const props = defineProps<{
  placeholder?: string
  isMobile?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', query: string): void
  (e: 'select'): void
}>()

const route = useRoute()
const router = useRouter()
const { locale, t, locUrl } = useI18n()

const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const results = ref<Article[]>([])
const isOpen = ref(false)
const isLoading = ref(false)
const selectedIndex = ref(-1)
const searchRoot = ref<HTMLElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => route.query.q, (newQ) => {
  query.value = typeof newQ === 'string' ? newQ : ''
})

async function fetchSuggestions(searchTerm: string) {
  const trimmed = searchTerm.trim()
  if (trimmed.length < 2) {
    results.value = []
    isOpen.value = false
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    const data = await $fetch<Article[]>('/api/articles', {
      query: {
        q: trimmed,
        limit: 5,
        lang: locale.value,
      },
    })
    results.value = data || []
    isOpen.value = results.value.length > 0
    selectedIndex.value = -1
  } catch {
    results.value = []
  } finally {
    isLoading.value = false
  }
}

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  const val = query.value.trim()
  if (val.length < 2) {
    results.value = []
    isOpen.value = false
    return
  }
  debounceTimer = setTimeout(() => {
    fetchSuggestions(val)
  }, 220)
}

function onFocus() {
  if (query.value.trim().length >= 2 && results.value.length > 0) {
    isOpen.value = true
  }
}

function closeDropdown() {
  isOpen.value = false
  selectedIndex.value = -1
}

function onKeyDown(e: KeyboardEvent) {
  if (!isOpen.value) {
    if (e.key === 'ArrowDown' && query.value.trim().length >= 2) {
      isOpen.value = true
      fetchSuggestions(query.value)
    }
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = selectedIndex.value <= 0 ? results.value.length - 1 : selectedIndex.value - 1
  } else if (e.key === 'Escape') {
    closeDropdown()
  } else if (e.key === 'Enter') {
    if (selectedIndex.value >= 0 && results.value[selectedIndex.value]) {
      e.preventDefault()
      const item = results.value[selectedIndex.value]!
      navigateToArticle(item)
    } else {
      onSubmit()
    }
  }
}

function navigateToArticle(article: Article) {
  closeDropdown()
  emit('select')
  router.push(locUrl(`/news/${article.category}/article/${article.id}`))
}

function onSubmit() {
  closeDropdown()
  const q = query.value.trim()
  emit('submit', q)
  const target = locUrl('/news')
  router.push(q ? { path: target, query: { q } } : target)
}

function handleClickOutside(e: MouseEvent) {
  if (searchRoot.value && !searchRoot.value.contains(e.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('click', handleClickOutside)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('click', handleClickOutside)
  }
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div ref="searchRoot" class="ttr-search-autocomplete" :class="{ 'is-mobile': isMobile }">
    <form class="ttr-search-box-inner" @submit.prevent="onSubmit">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        v-model="query"
        type="search"
        :placeholder="placeholder || t('search_placeholder')"
        aria-label="뉴스 실시간 검색"
        autocomplete="off"
        @input="onInput"
        @focus="onFocus"
        @keydown="onKeyDown"
      >
      <div v-if="isLoading" class="search-spinner" />
      <button v-if="isMobile" type="submit" class="ttr-search-btn-mobile">{{ t('search') }}</button>
    </form>

    <!-- Autocomplete Dropdown Menu -->
    <transition name="ttr-dropdown">
      <div v-if="isOpen && results.length > 0" class="ttr-autocomplete-dropdown" role="listbox">
        <div class="dropdown-header">
          <span class="dropdown-title">LIVE INTELLIGENCE SEARCH</span>
          <span class="dropdown-count">{{ results.length }} RESULTS</span>
        </div>
        <ul class="dropdown-list">
          <li
            v-for="(item, idx) in results"
            :key="item.id"
            class="dropdown-item"
            :class="{ 'is-selected': idx === selectedIndex }"
            role="option"
            :aria-selected="idx === selectedIndex"
            @mouseenter="selectedIndex = idx"
            @click="navigateToArticle(item)"
          >
            <div class="item-thumb">
              <img
                v-if="item.coverImage"
                :src="item.coverImage"
                :alt="item.title"
                loading="lazy"
              >
              <div v-else class="thumb-fallback">📰</div>
            </div>
            <div class="item-meta">
              <div class="meta-top">
                <span class="category-pill">{{ item.category.toUpperCase() }}</span>
                <span v-if="item.publishedAt" class="date-label">
                  {{ new Date(item.publishedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) }}
                </span>
              </div>
              <h5 class="item-title">{{ item.title }}</h5>
            </div>
          </li>
        </ul>
        <div class="dropdown-footer">
          <span>Press <strong>Enter</strong> to view all results</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.ttr-search-autocomplete {
  position: relative;
  width: 100%;
}

.ttr-search-box-inner {
  display: flex;
  align-items: center;
  background: var(--bg-input, #11121d);
  border: 1px solid var(--border, #23253a);
  border-radius: 6px;
  padding: 0 10px;
  height: 34px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ttr-search-box-inner:focus-within {
  border-color: var(--accent, #00d4aa);
  box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.18);
}

.search-icon {
  color: var(--text-muted, #7e8299);
  margin-right: 8px;
  flex-shrink: 0;
}

input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-base, #ffffff);
  font-size: 13px;
  width: 100%;
  font-family: inherit;
}

input::placeholder {
  color: var(--text-muted, #5e6278);
  font-size: 12.5px;
}

.search-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 212, 170, 0.2);
  border-top-color: var(--accent, #00d4aa);
  border-radius: 50%;
  animation: ttr-spin 0.6s linear infinite;
  margin-left: 6px;
  flex-shrink: 0;
}

@keyframes ttr-spin {
  to { transform: rotate(360deg); }
}

.ttr-search-btn-mobile {
  background: var(--accent, #00d4aa);
  color: #0d0e1a;
  border: none;
  border-radius: 4px;
  padding: 0 12px;
  height: 28px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  margin-left: 6px;
  white-space: nowrap;
}

/* Autocomplete Dropdown */
.ttr-autocomplete-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  min-width: 320px;
  background: var(--bg-card, #181927);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  overflow: hidden;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-surface, #13141f);
  border-bottom: 1px solid var(--border, #23253a);
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  font-weight: 700;
}

.dropdown-title {
  color: var(--accent, #00d4aa);
  letter-spacing: 0.5px;
}

.dropdown-count {
  color: var(--text-muted, #7e8299);
}

.dropdown-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 360px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid rgba(35, 37, 58, 0.4);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover,
.dropdown-item.is-selected {
  background: rgba(0, 212, 170, 0.08);
}

.item-thumb {
  width: 48px;
  height: 34px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-fallback {
  font-size: 14px;
}

.item-meta {
  flex: 1;
  min-width: 0;
}

.meta-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.category-pill {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 9.5px;
  font-weight: 800;
  color: var(--accent, #00d4aa);
  background: rgba(0, 212, 170, 0.12);
  padding: 1px 4px;
  border-radius: 3px;
}

.date-label {
  font-size: 11px;
  color: var(--text-muted, #7e8299);
}

.item-title {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-base, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.dropdown-footer {
  padding: 6px 12px;
  background: var(--bg-surface, #13141f);
  border-top: 1px solid var(--border, #23253a);
  font-size: 10.5px;
  color: var(--text-muted, #7e8299);
  text-align: right;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
}

.dropdown-footer strong {
  color: var(--accent, #00d4aa);
}

/* Transitions */
.ttr-dropdown-enter-active,
.ttr-dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.ttr-dropdown-enter-from,
.ttr-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

