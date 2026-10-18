import { defineStore } from 'pinia'

const storageKey = 'checkin-daily:saved-articles'

export const useSavedStore = defineStore('saved-articles', () => {
  const ids = ref<number[]>([])
  const slugs = ref<string[]>([])
  const isLoaded = ref(false)

  function load() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const loadedIds: number[] = []
          const loadedSlugs: string[] = []
          for (const item of parsed) {
            if (typeof item === 'number' && Number.isSafeInteger(item) && item > 0) {
              loadedIds.push(item)
            } else if (typeof item === 'string' && item.trim()) {
              const num = parseInt(item, 10)
              if (!isNaN(num) && String(num) === item.trim()) {
                loadedIds.push(num)
              } else {
                loadedSlugs.push(item.trim())
              }
            }
          }
          ids.value = loadedIds
          slugs.value = loadedSlugs
        }
      }
    } catch {
      ids.value = []
      slugs.value = []
    } finally {
      isLoaded.value = true
    }
  }

  function has(idOrSlug: number | string): boolean {
    if (typeof idOrSlug === 'number') {
      return ids.value.includes(idOrSlug)
    }
    const num = parseInt(String(idOrSlug), 10)
    if (!isNaN(num) && ids.value.includes(num)) return true
    return slugs.value.includes(String(idOrSlug))
  }

  function toggle(target: number | string | { id?: number; slug?: string }) {
    if (!import.meta.client) return
    let id: number | undefined
    let slug: string | undefined

    if (typeof target === 'number') {
      id = target
    } else if (typeof target === 'string') {
      const num = parseInt(target, 10)
      if (!isNaN(num) && String(num) === target.trim()) {
        id = num
      } else {
        slug = target.trim()
      }
    } else if (target && typeof target === 'object') {
      if (typeof target.id === 'number') id = target.id
      if (typeof target.slug === 'string') slug = target.slug
    }

    const hasId = id !== undefined && ids.value.includes(id)
    const hasSlug = !!(slug && slugs.value.includes(slug))

    if (hasId || hasSlug) {
      if (id !== undefined) ids.value = ids.value.filter((i) => i !== id)
      if (slug) slugs.value = slugs.value.filter((s) => s !== slug)
    } else {
      if (id !== undefined) ids.value = [...ids.value, id]
      if (slug) slugs.value = [...slugs.value, slug]
    }

    try {
      // Store both IDs and legacy slugs
      const combined = [...ids.value, ...slugs.value]
      localStorage.setItem(storageKey, JSON.stringify(combined))
    } catch (e) {
      // Safe fallback if localStorage quota exceeded
      console.warn('LocalStorage save failed:', e)
    }
  }

  return { ids, slugs, isLoaded, load, has, toggle }
})