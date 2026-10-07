import { defineStore } from 'pinia'

export interface Article {
  id: number
  title: string
  slug: string
  summary: string
  content: string
  category: 'flights' | 'hotels' | 'industry'
  author: string
  coverImage: string
  status: 'draft' | 'published'
  publishedAt: string | null
  createdAt: string
}

export interface Category {
  id: number
  name: string
  slug: string
}

export type ArticleInput = Omit<Article, 'id' | 'publishedAt' | 'createdAt'>

export const useArticlesStore = defineStore('articles', () => {
  const config = useRuntimeConfig()
  const apiBase = import.meta.server ? config.apiInternalBase : config.public.apiBase
  const articles = ref<Article[]>([])
  const current = ref<Article | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function load(category = '', admin = false) {
    loading.value = true
    error.value = ''
    try {
      const path = admin ? '/api/admin/articles' : '/api/articles'
      articles.value = await $fetch<Article[]>(`${apiBase}${path}`, {
        query: category ? { category } : undefined,
      })
    } catch {
      error.value = '기사를 불러오지 못했습니다. API 서버가 실행 중인지 확인해 주세요.'
      articles.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadOne(slug: string) {
    current.value = await $fetch<Article>(`${apiBase}/api/articles/${slug}`)
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

  return { articles, current, loading, error, load, loadOne, save, remove, loadCategories, saveCategory, removeCategory }
})