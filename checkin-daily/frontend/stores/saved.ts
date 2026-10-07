import { defineStore } from 'pinia'

const storageKey = 'checkin-daily:saved-articles'

export const useSavedStore = defineStore('saved-articles', () => {
  const slugs = ref<string[]>([])

  function load() {
    try {
      slugs.value = JSON.parse(localStorage.getItem(storageKey) || '[]')
    } catch {
      slugs.value = []
    }
  }

  function has(slug: string) {
    return slugs.value.includes(slug)
  }

  function toggle(slug: string) {
    slugs.value = has(slug) ? slugs.value.filter((item) => item !== slug) : [...slugs.value, slug]
    localStorage.setItem(storageKey, JSON.stringify(slugs.value))
  }

  return { slugs, load, has, toggle }
})