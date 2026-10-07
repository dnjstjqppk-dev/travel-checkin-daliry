import { defineStore } from 'pinia'

export interface Article {
  id: number
  title: string
  slug: string
  summary: string
  content: string
  category: string
  author: string
  coverImage: string
  status: 'draft' | 'published'
  publishedAt: string | null
  createdAt: string
  cities?: City[]
}

export interface Category {
  id: number
  name: string
  slug: string
}

export interface Country {
  code: string
  nameKo: string
  nameEn: string
  continent: string
  sortOrder: number
}

export interface City {
  id: string
  countryCode: string
  nameKo: string
  nameEn: string
  country?: Country
}

export interface ArticleFilters {
  category?: string
  country?: string
  city?: string
  search?: string
  limit?: number
  offset?: number
}

export interface AdPlacement {
  id: string
  name: string
  adClientId: string
  adSlotId: string
  format: string
  isActive: boolean
}

export type ArticleInput = Omit<Article, 'id' | 'publishedAt' | 'createdAt' | 'cities'> & { cityIds: string[] }

export const useArticlesStore = defineStore('articles', () => {
  const config = useRuntimeConfig()
  const apiBase = import.meta.server ? config.apiInternalBase : config.public.apiBase
  const articles = ref<Article[]>([])
  const current = ref<Article | null>(null)
  const adPlacements = ref<AdPlacement[]>([])
  const loading = ref(false)
  const error = ref('')

  async function load(categoryOrFilters: string | ArticleFilters = '', admin = false, append = false) {
    loading.value = true
    error.value = ''
    try {
      const path = admin ? '/api/admin/articles' : '/api/articles'
      const filters = typeof categoryOrFilters === 'string' ? { category: categoryOrFilters } : categoryOrFilters
      const loaded = await $fetch<Article[]>(`${apiBase}${path}`, {
        query: {
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.country ? { country: filters.country } : {}),
          ...(filters.city ? { city: filters.city } : {}),
          ...(filters.search ? { q: filters.search } : {}),
          ...(filters.limit ? { limit: filters.limit, offset: filters.offset || 0 } : {}),
        },
      })
      articles.value = append ? [...articles.value, ...loaded] : loaded
      return loaded.length
    } catch {
      error.value = '기사를 불러오지 못했습니다. API 서버가 실행 중인지 확인해 주세요.'
      if (!append) articles.value = []
      return 0
    } finally {
      loading.value = false
    }
  }

  async function loadOne(slug: string) {
    current.value = await $fetch<Article>(`${apiBase}/api/articles/${slug}`)
    return current.value
  }

  async function loadById(id: string | number, category: string) {
    current.value = await $fetch<Article>(`${apiBase}/api/articles/id/${id}`, { query: { category } })
    return current.value
  }

  async function save(input: ArticleInput, id?: number) {
    const path = id ? `/api/admin/articles/${id}` : '/api/admin/articles'
    return await $fetch<Article>(`${apiBase}${path}`, {
      method: id ? 'PUT' : 'POST',
      body: input,
    })
  }

  async function remove(id: number) {
    await $fetch(`${apiBase}/api/admin/articles/${id}`, { method: 'DELETE' })
    articles.value = articles.value.filter((article) => article.id !== id)
  }

  async function loadCategories(admin = false) {
    const path = admin ? '/api/admin/categories' : '/api/categories'
    return await $fetch<Category[]>(`${apiBase}${path}`)
  }

  async function saveCategory(input: Omit<Category, 'id'>, id?: number) {
    const path = id ? `/api/admin/categories/${id}` : '/api/admin/categories'
    return await $fetch<Category>(`${apiBase}${path}`, { method: id ? 'PUT' : 'POST', body: input })
  }

  async function removeCategory(id: number) {
    await $fetch(`${apiBase}/api/admin/categories/${id}`, { method: 'DELETE' })
  }

  async function loadCountries() {
    return await $fetch<Country[]>(`${apiBase}/api/countries`)
  }

  async function saveCountry(input: Country, code?: string) {
    const path = code ? `/api/admin/countries/${code}` : '/api/admin/countries'
    return await $fetch<Country>(`${apiBase}${path}`, { method: code ? 'PUT' : 'POST', body: input })
  }

  async function removeCountry(code: string) {
    await $fetch(`${apiBase}/api/admin/countries/${code}`, { method: 'DELETE' })
  }

  async function loadCities(countryCode: string, admin = false) {
    const path = admin ? '/api/admin/countries' : '/api/countries'
    return await $fetch<City[]>(`${apiBase}${path}/${countryCode}/cities`)
  }

  async function saveCity(countryCode: string, input: Omit<City, 'countryCode' | 'country'>, id?: string) {
    const path = id ? `/api/admin/cities/${id}` : `/api/admin/countries/${countryCode}/cities`
    return await $fetch<City>(`${apiBase}${path}`, { method: id ? 'PUT' : 'POST', body: input })
  }

  async function removeCity(id: string) {
    await $fetch(`${apiBase}/api/admin/cities/${id}`, { method: 'DELETE' })
  }

  async function loadAdPlacements(admin = false) {
    const path = admin ? '/api/admin/ads' : '/api/ads'
    const placements = await $fetch<AdPlacement[]>(`${apiBase}${path}`)
    if (admin) adPlacements.value = placements
    return placements
  }

  async function saveAdPlacement(input: AdPlacement, id?: string) {
    const path = id ? `/api/admin/ads/${id}` : '/api/admin/ads'
    return await $fetch<AdPlacement>(`${apiBase}${path}`, { method: id ? 'PUT' : 'POST', body: input })
  }

  async function removeAdPlacement(id: string) {
    await $fetch(`${apiBase}/api/admin/ads/${id}`, { method: 'DELETE' })
  }

  return {
    articles, current, adPlacements, loading, error, load, loadOne, loadById, save, remove,
    loadCategories, saveCategory, removeCategory, loadCountries, saveCountry,
    removeCountry, loadCities, saveCity, removeCity, loadAdPlacements,
    saveAdPlacement, removeAdPlacement,
  }
})