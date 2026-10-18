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
  updatedAt?: string
  viewCount?: number
  cities?: City[]
  reviewStatus?: string
  firstPublishedAt?: string | null
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
  page?: number
  sort?: 'recent' | 'views'
  lang?: string
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
  const apiBase = import.meta.server ? '' : config.public.apiBase
  const apiRequest = useRequestFetch()
  const articles = ref<Article[]>([])
  const current = ref<Article | null>(null)
  const adPlacements = ref<AdPlacement[]>([])
  const loading = ref(false)
  const error = ref('')
  const totalCount = ref(0)
  const totalPages = ref(1)
  const currentPage = ref(1)

  async function load(categoryOrFilters: string | ArticleFilters = '', admin = false, append = false) {
    loading.value = true
    error.value = ''
    try {
      const path = admin ? '/api/admin/articles' : '/api/articles'
      const filters = typeof categoryOrFilters === 'string' ? { category: categoryOrFilters } : categoryOrFilters
      const loaded = await apiRequest<any>(`${apiBase}${path}`, {
        query: {
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.country ? { country: filters.country } : {}),
          ...(filters.city ? { city: filters.city } : {}),
          ...(filters.search ? { q: filters.search } : {}),
          ...(filters.page ? { page: filters.page } : {}),
          ...(filters.limit ? { limit: filters.limit, offset: filters.offset || 0 } : {}),
          ...(filters.sort ? { sort: filters.sort } : {}),
          ...(filters.lang ? { lang: filters.lang } : {}),
        },
      })
      if (Array.isArray(loaded)) {
        articles.value = append ? [...articles.value, ...loaded] : loaded
        totalCount.value = loaded.length
        totalPages.value = 1
        currentPage.value = 1
        return loaded.length
      } else if (loaded && typeof loaded === 'object' && Array.isArray(loaded.data)) {
        const list = loaded.data as Article[]
        articles.value = append ? [...articles.value, ...list] : list
        totalCount.value = loaded.total_count ?? loaded.totalCount ?? list.length
        totalPages.value = loaded.total_pages ?? loaded.totalPages ?? 1
        currentPage.value = loaded.page ?? 1
        return list.length
      }
      return 0
    } catch {
      error.value = '일시적인 네트워크 지연으로 기사를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
      if (!append) articles.value = []
      return 0
    } finally {
      loading.value = false
    }
  }

  async function loadOne(slug: string, lang?: string) {
    current.value = await apiRequest<Article>(`${apiBase}/api/articles/${encodeURIComponent(slug)}`, {
      query: { ...(lang ? { lang } : {}) },
    })
    return current.value
  }

  async function loadById(id: string | number, category: string, lang?: string) {
    current.value = await apiRequest<Article>(`${apiBase}/api/articles/id/${id}`, {
      query: { category, ...(lang ? { lang } : {}) },
    })
    return current.value
  }

  async function save(input: ArticleInput, id?: number) {
    const path = id ? `/api/admin/articles/${id}` : '/api/admin/articles'
    return await apiRequest<Article>(`${apiBase}${path}`, {
      method: id ? 'PUT' : 'POST',
      body: input,
    })
  }

  async function remove(id: number) {
    await apiRequest(`${apiBase}/api/admin/articles/${id}`, { method: 'DELETE' })
    articles.value = articles.value.filter((article) => article.id !== id)
  }

  async function loadCategories(admin = false) {
    const path = admin ? '/api/admin/categories' : '/api/categories'
    return await apiRequest<Category[]>(`${apiBase}${path}`)
  }

  async function saveCategory(input: Omit<Category, 'id'>, id?: number) {
    const path = id ? `/api/admin/categories/${id}` : '/api/admin/categories'
    return await apiRequest<Category>(`${apiBase}${path}`, { method: id ? 'PUT' : 'POST', body: input })
  }

  async function removeCategory(id: number) {
    await apiRequest(`${apiBase}/api/admin/categories/${id}`, { method: 'DELETE' })
  }

  async function loadCountries() {
    return await apiRequest<Country[]>(`${apiBase}/api/countries`)
  }

  async function saveCountry(input: Country, code?: string) {
    const path = code ? `/api/admin/countries/${encodeURIComponent(code)}` : '/api/admin/countries'
    return await apiRequest<Country>(`${apiBase}${path}`, { method: code ? 'PUT' : 'POST', body: input })
  }

  async function removeCountry(code: string) {
    await apiRequest(`${apiBase}/api/admin/countries/${encodeURIComponent(code)}`, { method: 'DELETE' })
  }

  async function loadCities(countryCode: string, admin = false) {
    const path = admin ? '/api/admin/countries' : '/api/countries'
    return await apiRequest<City[]>(`${apiBase}${path}/${encodeURIComponent(countryCode)}/cities`)
  }

  async function saveCity(countryCode: string, input: Omit<City, 'countryCode' | 'country'>, id?: string) {
    const path = id ? `/api/admin/cities/${encodeURIComponent(id)}` : `/api/admin/countries/${encodeURIComponent(countryCode)}/cities`
    return await apiRequest<City>(`${apiBase}${path}`, { method: id ? 'PUT' : 'POST', body: input })
  }

  async function removeCity(id: string) {
    await apiRequest(`${apiBase}/api/admin/cities/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  async function loadAdPlacements(admin = false) {
    const path = admin ? '/api/admin/ads' : '/api/ads'
    const placements = await apiRequest<AdPlacement[]>(`${apiBase}${path}`)
    if (admin) adPlacements.value = placements
    return placements
  }

  async function saveAdPlacement(input: AdPlacement, id?: string) {
    const path = id ? `/api/admin/ads/${encodeURIComponent(id)}` : '/api/admin/ads'
    return await apiRequest<AdPlacement>(`${apiBase}${path}`, { method: id ? 'PUT' : 'POST', body: input })
  }

  async function removeAdPlacement(id: string) {
    await apiRequest(`${apiBase}/api/admin/ads/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  return {
    articles, current, adPlacements, loading, error, totalCount, totalPages, currentPage,
    load, loadOne, loadById, save, remove,
    loadCategories, saveCategory, removeCategory, loadCountries, saveCountry,
    removeCountry, loadCities, saveCity, removeCity, loadAdPlacements,
    saveAdPlacement, removeAdPlacement,
  }
})