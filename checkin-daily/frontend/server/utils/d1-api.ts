import {
  createError,
  getRequestHeader,
  getRequestURL,
  readBody,
  setResponseHeader,
  setResponseStatus,
  type H3Event,
} from 'h3'
import {
  adminSessionTtlSeconds,
  authenticateAdmin,
  clearLoginAttempts,
  constantTimeEqual,
  createAdminSession,
  deleteAdminSession,
  findAdminAccount,
  isLoginBlocked,
  isSameOriginRequest,
  recordFailedLogin,
  storeAdminAccount,
  verifyPassword,
} from './d1-auth'
import { d1All, d1First, d1Run, getWorkerEnvironment, type D1Database } from './d1'

const maxRequestBytes = 2 * 1024 * 1024
const dummyPasswordHash = 'pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

interface JsonObject {
  [key: string]: unknown
}

function optionalString(input: JsonObject, key: string, maxLength: number): string | null {
  const value = input[key]
  if (value === undefined) return ''
  if (typeof value !== 'string' || value.length > maxLength) return null
  return value.trim()
}

interface CategoryRow {
  id: number
  name: string
  slug: string
  created_at: string
}

interface CountryRow {
  code: string
  name_ko: string
  name_en: string
  continent: string
  sort_order: number
  created_at: string
}

interface CityRow {
  id: string
  country_code: string
  name_ko: string
  name_en: string
  created_at: string
}

interface AdPlacementRow {
  id: string
  name: string
  ad_client_id: string
  ad_slot_id: string
  format: string
  is_active: number
  created_at: string
  updated_at: string
}

interface ArticleRow {
  id: number
  title: string
  slug: string
  summary: string
  content: string
  category: string
  author: string
  cover_image: string
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
  updated_at: string
  view_count: number
}

interface ArticleJoinRow extends ArticleRow {
  city_id: string | null
  city_country_code: string | null
  city_name_ko: string | null
  city_name_en: string | null
  city_created_at: string | null
  country_name_ko: string | null
  country_name_en: string | null
  country_continent: string | null
  country_sort_order: number | null
  country_created_at: string | null
}

interface ArticleInput {
  title: string
  slug: string
  summary: string
  content: string
  category: string
  author: string
  coverImage: string
  status: 'draft' | 'published'
  cityIds: string[]
}

export async function handleD1Api(event: H3Event, database: D1Database) {
  const url = getRequestURL(event)
  if (url.pathname === '/health') return { status: 'ok' }

  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')

  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] !== 'api') return respond(event, { error: 'not found' }, 404)

  if (parts[1] === 'auth') {
    const response = await handleAuth(event, database, parts.slice(2))
    if (response !== undefined) return response
  }

  const adminRoute = parts[1] === 'admin'
  if (adminRoute) {
    const session = await authenticateAdmin(event, database)
    if (!session.identity) return respond(event, { error: 'authentication required' }, 401)
    if (event.method !== 'GET' && !isSameOriginRequest(event)) {
      return respond(event, { error: 'request origin is not allowed' }, 403)
    }
  }

  return handleResource(event, database, parts, adminRoute)
}

async function handleAuth(event: H3Event, database: D1Database, path: string[]) {
  if (path.length === 1 && path[0] === 'bootstrap' && event.method === 'POST') {
    return bootstrapAdmin(event, database)
  }
  const action = path[0]
  if (
    path.length !== 1
    || (action !== 'login' && action !== 'session' && action !== 'logout')
  ) return undefined

  if (action === 'login' && event.method === 'POST') {
    if (!isSameOriginRequest(event)) return respond(event, { error: 'request origin is not allowed' }, 403)
    if (getRequestHeader(event, 'sec-fetch-site')?.toLowerCase() === 'cross-site') {
      return respond(event, { error: 'cross-site request rejected' }, 403)
    }
    if (await isLoginBlocked(event, database)) {
      setResponseHeader(event, 'Retry-After', 15 * 60)
      return respond(event, { error: 'too many login attempts; try again later' }, 429)
    }

    const input = await readJsonObject(event)
    const username = readString(input, 'username', 254)
    const password = readString(input, 'password', 1024)
    if (!username || !password) {
      return respond(event, { error: 'username and password are required' }, 400)
    }

    const account = await findAdminAccount(database, username)
    const validPassword = await verifyPassword(password, account?.password_hash ?? dummyPasswordHash)
    if (!account || !validPassword) {
      await recordFailedLogin(event, database)
      return respond(event, { error: 'invalid username or password' }, 401)
    }
    await clearLoginAttempts(event, database)
    await createAdminSession(event, database, {
      id: account.id,
      username: account.username,
      role: 'admin',
    })
    return respond(event, {
      username: account.username,
      role: 'admin',
      expiresIn: adminSessionTtlSeconds,
    })
  }

  if (action === 'session' && event.method === 'GET') {
    const session = await authenticateAdmin(event, database)
    if (!session.identity) return respond(event, { error: 'authentication required' }, 401)
    return respond(event, {
      username: session.identity.username,
      role: session.identity.role,
      expiresIn: adminSessionTtlSeconds,
    })
  }

  if (action === 'logout' && event.method === 'POST') {
    if (!isSameOriginRequest(event)) return respond(event, { error: 'request origin is not allowed' }, 403)
    const session = await authenticateAdmin(event, database)
    if (!session.identity) return respond(event, { error: 'authentication required' }, 401)
    await deleteAdminSession(event, database)
    setResponseStatus(event, 204)
    return null
  }

  return respond(event, { error: 'not found' }, 404)
}

async function bootstrapAdmin(event: H3Event, database: D1Database) {
  const token = getWorkerEnvironment(event)?.ADMIN_BOOTSTRAP_TOKEN
  const authorization = getRequestHeader(event, 'authorization') ?? ''
  if (!token) return respond(event, { error: 'not found' }, 404)
  if (!constantTimeEqual(authorization, `Bearer ${token}`)) {
    return respond(event, { error: 'bootstrap authorization required' }, 401)
  }

  const existing = await d1First<{ id: number }>(database, 'SELECT id FROM admin_accounts LIMIT 1')
  if (existing) return respond(event, { error: 'an admin account already exists' }, 409)

  const input = await readJsonObject(event)
  const username = readString(input, 'username', 254).toLowerCase()
  const password = readString(input, 'password', 1024)
  if (!username || !password || password.length < 12) {
    return respond(event, { error: 'username and a password of at least 12 characters are required' }, 400)
  }

  await storeAdminAccount(database, username, password)
  return respond(event, { username, created: true }, 201)
}

async function handleResource(event: H3Event, database: D1Database, parts: string[], admin: boolean) {
  const path = admin ? parts.slice(2) : parts.slice(1)
  const resource = path[0] ?? ''
  if (resource === 'articles') return handleArticles(event, database, path.slice(1), admin)
  if (resource === 'categories') return handleCategories(event, database, path.slice(1))
  if (resource === 'countries') return handleCountries(event, database, path.slice(1))
  if (resource === 'cities' && admin) return handleCityById(event, database, path.slice(1))
  if (resource === 'ads') return handleAds(event, database, path.slice(1), admin)
  return respond(event, { error: 'not found' }, 404)
}

async function handleArticles(event: H3Event, database: D1Database, path: string[], admin: boolean) {
  const url = getRequestURL(event)
  const method = event.method
  const lang = (url.searchParams.get('lang') ?? 'ko').trim().toLowerCase()
  if (method === 'GET' && path.length === 0) {
    return respond(event, await listArticles(database, url, admin))
  }
  if (method === 'GET' && path.length === 2 && path[0] === 'id' && !admin) {
    const id = Number(path[1] ?? '')
    if (!Number.isSafeInteger(id) || id < 1) return respond(event, { error: 'article not found' }, 404)
    const category = canonicalCategory(normalizeSlug(url.searchParams.get('category') ?? ''))
    const condition = category ? 'a.id = ? AND a.status = ? AND a.category = ?' : 'a.id = ? AND a.status = ?'
    const values: Array<string | number> = category ? [id, 'published', category] : [id, 'published']
    await incrementArticleView(database, id, category || undefined)
    const article = await getArticle(database, condition, lang, ...values)
    return article ? respond(event, article) : respond(event, { error: 'article not found' }, 404)
  }
  if (method === 'GET' && path.length === 1 && !admin) {
    const slug = normalizeSlug(path[0] ?? '')
    const existing = await d1First<{ id: number }>(
      database,
      'SELECT id FROM articles WHERE slug = ? AND status = ?',
      slug,
      'published',
    )
    if (!existing) return respond(event, { error: 'article not found' }, 404)
    await incrementArticleView(database, existing.id)
    const article = await getArticle(
      database,
      'a.slug = ? AND a.status = ?',
      lang,
      slug,
      'published',
    )
    return article ? respond(event, article) : respond(event, { error: 'article not found' }, 404)
  }
  if (method === 'POST' && path.length === 0 && admin) return createArticle(event, database)
  if (method === 'PUT' && path.length === 1 && admin) return updateArticle(event, database, path[0] ?? '')
  if (method === 'DELETE' && path.length === 1 && admin) return deleteArticle(event, database, path[0] ?? '')
  return respond(event, { error: 'not found' }, 404)
}

async function listArticles(database: D1Database, url: URL, admin: boolean): Promise<unknown[]> {
  const lang = (url.searchParams.get('lang') ?? 'ko').trim().toLowerCase()
  const clauses: string[] = []
  const values: Array<string | number> = []
  let pagination = ''
  const paginationValues: number[] = []
  if (!admin) clauses.push("a.status = 'published'")

  const category = normalizeSlug(url.searchParams.get('category') ?? '')
  if (category) {
    clauses.push('a.category = ?')
    values.push(canonicalCategory(category))
  }
  const search = (url.searchParams.get('q') ?? '').trim()
  if (search) {
    clauses.push('(a.title LIKE ? OR a.summary LIKE ?)')
    values.push(`%${search}%`, `%${search}%`)
  }
  const country = (url.searchParams.get('country') ?? '').trim().toUpperCase()
  const city = (url.searchParams.get('city') ?? '').trim()
  if (city) {
    clauses.push(`EXISTS (
      SELECT 1 FROM article_cities filter_ac
      JOIN cities filter_city ON filter_city.id = filter_ac.city_id
      WHERE filter_ac.article_id = a.id AND filter_city.id = ?
      ${country ? 'AND filter_city.country_code = ?' : ''}
    )`)
    values.push(city)
    if (country) values.push(country)
  } else if (country) {
    clauses.push(`EXISTS (
      SELECT 1 FROM article_cities filter_ac
      JOIN cities filter_city ON filter_city.id = filter_ac.city_id
      WHERE filter_ac.article_id = a.id AND filter_city.country_code = ?
    )`)
    values.push(country)
  }

  if (!admin) {
    const limitValue = url.searchParams.get('limit')
    const offsetValue = url.searchParams.get('offset')
    const limit = limitValue === null ? 0 : Number(limitValue)
    const offset = offsetValue === null ? 0 : Number(offsetValue)
    if ((limitValue !== null && (!Number.isInteger(limit) || limit <= 0))
      || (offsetValue !== null && (!Number.isInteger(offset) || offset < 0))) {
      throw createError({ statusCode: 400, statusMessage: 'limit and offset must be valid integers' })
    }
    if (limit > 0) {
      pagination = ' LIMIT ? OFFSET ?'
      paginationValues.push(Math.min(limit, 100), offset)
    } else if (offset > 0) {
      pagination = ' LIMIT -1 OFFSET ?'
      paginationValues.push(offset)
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const sort = !admin && url.searchParams.get('sort') === 'views'
    ? 'a.view_count DESC, a.published_at DESC, a.created_at DESC'
    : 'a.published_at DESC, a.created_at DESC'
  const rows = await d1All<ArticleJoinRow>(
    database,
    `WITH paged_articles AS (
      SELECT a.id FROM articles a ${where}
      ORDER BY ${sort}${pagination}
     )
     SELECT a.id, a.slug, a.category, a.author, a.cover_image, a.status,
            a.published_at, a.created_at, a.updated_at, a.view_count,
            COALESCE(t.title, a.title) AS title,
            COALESCE(t.summary, a.summary) AS summary,
            COALESCE(t.content, a.content) AS content,
            c.id AS city_id, c.country_code AS city_country_code, c.name_ko AS city_name_ko,
            c.name_en AS city_name_en, c.created_at AS city_created_at,
            co.name_ko AS country_name_ko, co.name_en AS country_name_en,
            co.continent AS country_continent, co.sort_order AS country_sort_order,
            co.created_at AS country_created_at
     FROM articles a
     JOIN paged_articles page ON page.id = a.id
     LEFT JOIN article_translations t ON t.article_id = a.id AND t.lang = ?
     LEFT JOIN article_cities ac ON ac.article_id = a.id
     LEFT JOIN cities c ON c.id = ac.city_id
     LEFT JOIN countries co ON co.code = c.country_code
     ORDER BY ${sort}`,
    ...values,
    ...paginationValues,
    lang,
  )
  return groupArticles(rows)
}

async function getArticle(
  database: D1Database,
  condition: string,
  lang: string = 'ko',
  ...values: Array<string | number>
): Promise<unknown | null> {
  const normLang = (lang || 'ko').trim().toLowerCase()
  const rows = await d1All<ArticleJoinRow>(
    database,
    `SELECT a.id, a.slug, a.category, a.author, a.cover_image, a.status,
       a.published_at, a.created_at, a.updated_at, a.view_count,
       COALESCE(t.title, a.title) AS title,
       COALESCE(t.summary, a.summary) AS summary,
       COALESCE(t.content, a.content) AS content,
       c.id AS city_id, c.country_code AS city_country_code, c.name_ko AS city_name_ko,
       c.name_en AS city_name_en, c.created_at AS city_created_at,
       co.name_ko AS country_name_ko, co.name_en AS country_name_en,
       co.continent AS country_continent, co.sort_order AS country_sort_order,
       co.created_at AS country_created_at
     FROM articles a
     LEFT JOIN article_translations t ON t.article_id = a.id AND t.lang = ?
     LEFT JOIN article_cities ac ON ac.article_id = a.id
     LEFT JOIN cities c ON c.id = ac.city_id
     LEFT JOIN countries co ON co.code = c.country_code
     WHERE ${condition}
     ORDER BY a.published_at DESC, a.created_at DESC`,
    normLang,
    ...values,
  )
  return groupArticles(rows)[0] ?? null
}

function groupArticles(rows: ArticleJoinRow[]): Record<string, unknown>[] {
  const articles = new Map<number, Record<string, unknown>>()
  for (const row of rows) {
    let article = articles.get(row.id)
    if (!article) {
      article = {
        id: row.id,
        title: row.title,
        slug: row.slug,
        summary: row.summary,
        content: row.content,
        category: row.category,
        author: row.author,
        coverImage: row.cover_image,
        status: row.status,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        viewCount: row.view_count,
      }
      articles.set(row.id, article)
    }
    if (row.city_id) {
      const cities = (article.cities ??= []) as Record<string, unknown>[]
      cities.push({
        id: row.city_id,
        countryCode: row.city_country_code,
        nameKo: row.city_name_ko,
        nameEn: row.city_name_en,
        createdAt: row.city_created_at,
        country: {
          code: row.city_country_code,
          nameKo: row.country_name_ko,
          nameEn: row.country_name_en,
          continent: row.country_continent,
          sortOrder: row.country_sort_order,
          createdAt: row.country_created_at,
        },
      })
    }
  }
  return [...articles.values()]
}

async function incrementArticleView(database: D1Database, articleId: number, category?: string) {
  if (category) {
    await d1Run(
      database,
      'UPDATE articles SET view_count = view_count + 1 WHERE id = ? AND status = ? AND category = ?',
      articleId,
      'published',
      category,
    )
    return
  }
  await d1Run(database, 'UPDATE articles SET view_count = view_count + 1 WHERE id = ? AND status = ?', articleId, 'published')
}

async function handleCategories(event: H3Event, database: D1Database, path: string[]) {
  const method = event.method
  if (method === 'GET' && path.length === 0) {
    const rows = await d1All<CategoryRow>(database, 'SELECT * FROM categories ORDER BY id ASC')
    return respond(event, rows.map(categoryJson))
  }
  if (method === 'POST' && path.length === 0 && isAdminPath(event)) return createCategory(event, database)
  if (method === 'PUT' && path.length === 1 && isAdminPath(event)) return updateCategory(event, database, path[0] ?? '')
  if (method === 'DELETE' && path.length === 1 && isAdminPath(event)) return deleteCategory(event, database, path[0] ?? '')
  return respond(event, { error: 'not found' }, 404)
}

async function handleCountries(event: H3Event, database: D1Database, path: string[]) {
  const method = event.method
  if (method === 'GET' && path.length === 0) {
    const rows = await d1All<CountryRow>(database, 'SELECT * FROM countries ORDER BY sort_order ASC, name_en ASC')
    return respond(event, rows.map(countryJson))
  }
  if (method === 'GET' && path.length === 2 && path[1] === 'cities') {
    return listCities(event, database, path[0] ?? '')
  }
  if (method === 'POST' && path.length === 0 && isAdminPath(event)) return createCountry(event, database)
  if (method === 'PUT' && path.length === 1 && isAdminPath(event)) return updateCountry(event, database, path[0] ?? '')
  if (method === 'DELETE' && path.length === 1 && isAdminPath(event)) return deleteCountry(event, database, path[0] ?? '')
  if (method === 'POST' && path.length === 2 && path[1] === 'cities' && isAdminPath(event)) {
    return createCity(event, database, path[0] ?? '')
  }
  return respond(event, { error: 'not found' }, 404)
}

async function listCities(event: H3Event, database: D1Database, code: string) {
  const countryCode = code.trim().toUpperCase()
  const country = await d1First<{ code: string }>(database, 'SELECT code FROM countries WHERE code = ?', countryCode)
  if (!country) return respond(event, { error: 'country not found' }, 404)
  const cities = await d1All<CityRow>(
    database,
    'SELECT * FROM cities WHERE country_code = ? ORDER BY name_en ASC',
    countryCode,
  )
  return respond(event, cities.map(cityJson))
}

async function handleAds(event: H3Event, database: D1Database, path: string[], admin: boolean) {
  const method = event.method
  if (method === 'GET' && path.length === 0) {
    const rows = await d1All<AdPlacementRow>(
      database,
      `SELECT * FROM ad_placements ${admin ? '' : 'WHERE is_active = 1'} ORDER BY id ASC`,
    )
    return respond(event, rows.map(adPlacementJson))
  }
  if (method === 'POST' && path.length === 0 && admin) return createAdPlacement(event, database)
  if (method === 'PUT' && path.length === 1 && admin) return updateAdPlacement(event, database, path[0] ?? '')
  if (method === 'DELETE' && path.length === 1 && admin) return deleteAdPlacement(event, database, path[0] ?? '')
  return respond(event, { error: 'not found' }, 404)
}

function respond(event: H3Event, body: unknown, status = 200) {
  setResponseStatus(event, status)
  return body
}

function isAdminPath(event: H3Event): boolean {
  return getRequestURL(event).pathname.startsWith('/api/admin/')
}

async function readJsonObject(event: H3Event): Promise<JsonObject | null> {
  const length = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (length > maxRequestBytes) {
    throw createError({ statusCode: 413, statusMessage: 'request body is too large' })
  }
  const value: unknown = await readBody(event)
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null
}

function readString(input: JsonObject | null, key: string, maxLength: number): string {
  const value = input?.[key]
  return typeof value === 'string' && value.length <= maxLength ? value.trim() : ''
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
}

function canonicalCategory(slug: string): string {
  if (slug === 'flights') return 'airline'
  if (slug === 'hotels') return 'hotel'
  if (slug === 'industry') return 'major'
  return slug
}

function categoryJson(row: CategoryRow) {
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at }
}

function countryJson(row: CountryRow) {
  return {
    code: row.code,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    continent: row.continent,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

function cityJson(row: CityRow) {
  return {
    id: row.id,
    countryCode: row.country_code,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    createdAt: row.created_at,
  }
}

function adPlacementJson(row: AdPlacementRow) {
  return {
    id: row.id,
    name: row.name,
    adClientId: row.ad_client_id,
    adSlotId: row.ad_slot_id,
    format: row.format,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseArticleInput(input: JsonObject | null): ArticleInput | null {
  if (!input) return null
  const status = input.status
  const cityIds = input.cityIds ?? []
  if (
    typeof status !== 'string'
    || !['draft', 'published'].includes(status)
    || !Array.isArray(cityIds)
    || cityIds.length > 50
    || cityIds.some((id) => typeof id !== 'string' || id.length > 50)
  ) return null
  const title = readString(input, 'title', 180)
  const slug = normalizeSlug(readString(input, 'slug', 200))
  const category = canonicalCategory(normalizeSlug(readString(input, 'category', 60)))
  const summary = optionalString(input, 'summary', 500)
  const content = optionalString(input, 'content', maxRequestBytes)
  const author = optionalString(input, 'author', 80)
  const coverImage = optionalString(input, 'coverImage', 2048)
  if (!title || !slug || !category || summary === null || content === null || author === null || coverImage === null) return null
  return {
    title,
    slug,
    summary,
    content,
    category,
    author,
    coverImage,
    status: status as ArticleInput['status'],
    cityIds: [...new Set((cityIds as string[]).map((id) => id.trim()).filter(Boolean))],
  }
}

async function createCategory(event: H3Event, database: D1Database) {
  const input = await readJsonObject(event)
  const name = readString(input, 'name', 60)
  const slug = normalizeSlug(readString(input, 'slug', 60))
  if (!name || !slug) return respond(event, { error: 'category name and slug are required' }, 400)
  const duplicate = await d1First<{ id: number }>(database, 'SELECT id FROM categories WHERE slug = ?', slug)
  if (duplicate) return respond(event, { error: 'category could not be created; check that the slug is unique' }, 409)
  const row = await database.prepare(
    'INSERT INTO categories (name, slug) VALUES (?, ?) RETURNING *',
  ).bind(name, slug).first<CategoryRow>()
  if (!row) throw createError({ statusCode: 500, statusMessage: 'Category could not be created' })
  return respond(event, categoryJson(row), 201)
}

async function updateCategory(event: H3Event, database: D1Database, idValue: string) {
  const id = Number(idValue)
  if (!Number.isSafeInteger(id) || id < 1) return respond(event, { error: 'category not found' }, 404)
  const current = await d1First<CategoryRow>(database, 'SELECT * FROM categories WHERE id = ?', id)
  if (!current) return respond(event, { error: 'category not found' }, 404)
  const input = await readJsonObject(event)
  const name = readString(input, 'name', 60)
  const slug = normalizeSlug(readString(input, 'slug', 60))
  if (!name || !slug) return respond(event, { error: 'category name and slug are required' }, 400)
  const duplicate = await d1First<{ id: number }>(
    database,
    'SELECT id FROM categories WHERE slug = ? AND id <> ?',
    slug,
    id,
  )
  if (duplicate) return respond(event, { error: 'category could not be updated; check that the slug is unique' }, 409)

  const results = await database.batch([
    database.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?').bind(name, slug, id),
    database.prepare('UPDATE articles SET category = ?, updated_at = ? WHERE category = ?')
      .bind(slug, new Date().toISOString(), current.slug),
  ])
  if (results.some((result) => !result.success)) {
    throw createError({ statusCode: 500, statusMessage: 'Category could not be updated' })
  }
  const updated = await d1First<CategoryRow>(database, 'SELECT * FROM categories WHERE id = ?', id)
  return respond(event, updated ? categoryJson(updated) : { error: 'category could not be loaded' }, updated ? 200 : 500)
}

async function deleteCategory(event: H3Event, database: D1Database, idValue: string) {
  const id = Number(idValue)
  if (!Number.isSafeInteger(id) || id < 1) return respond(event, { error: 'category not found' }, 404)
  const category = await d1First<CategoryRow>(database, 'SELECT * FROM categories WHERE id = ?', id)
  if (!category) return respond(event, { error: 'category not found' }, 404)
  const article = await d1First<{ id: number }>(database, 'SELECT id FROM articles WHERE category = ? LIMIT 1', category.slug)
  if (article) return respond(event, { error: 'category is used by existing articles' }, 409)
  await d1Run(database, 'DELETE FROM categories WHERE id = ?', id)
  setResponseStatus(event, 204)
  return null
}

async function createCountry(event: H3Event, database: D1Database) {
  const input = await readJsonObject(event)
  const country = parseCountryInput(input)
  if (!country) return respond(event, { error: 'country code and names are required' }, 400)
  if (!/^[A-Z]{2}$/.test(country.code)) {
    return respond(event, { error: 'country code must contain two letters' }, 400)
  }
  const duplicate = await d1First<{ code: string }>(database, 'SELECT code FROM countries WHERE code = ?', country.code)
  if (duplicate) return respond(event, { error: 'country could not be created; check that the code is unique' }, 409)
  const row = await database.prepare(
    'INSERT INTO countries (code, name_ko, name_en, continent, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING *',
  ).bind(country.code, country.nameKo, country.nameEn, country.continent, country.sortOrder).first<CountryRow>()
  if (!row) throw createError({ statusCode: 500, statusMessage: 'Country could not be created' })
  return respond(event, countryJson(row), 201)
}

async function updateCountry(event: H3Event, database: D1Database, codeValue: string) {
  const code = codeValue.trim().toUpperCase()
  const current = await d1First<CountryRow>(database, 'SELECT * FROM countries WHERE code = ?', code)
  if (!current) return respond(event, { error: 'country not found' }, 404)
  const input = await readJsonObject(event)
  const country = parseCountryInput(input)
  if (!country) return respond(event, { error: 'country code and names are required' }, 400)
  if (country.code !== code) return respond(event, { error: 'country code cannot be changed' }, 400)
  await d1Run(
    database,
    'UPDATE countries SET name_ko = ?, name_en = ?, continent = ?, sort_order = ? WHERE code = ?',
    country.nameKo,
    country.nameEn,
    country.continent,
    country.sortOrder,
    code,
  )
  const updated = await d1First<CountryRow>(database, 'SELECT * FROM countries WHERE code = ?', code)
  return respond(event, updated ? countryJson(updated) : { error: 'country could not be updated' }, updated ? 200 : 500)
}

async function deleteCountry(event: H3Event, database: D1Database, codeValue: string) {
  const code = codeValue.trim().toUpperCase()
  const country = await d1First<CountryRow>(database, 'SELECT * FROM countries WHERE code = ?', code)
  if (!country) return respond(event, { error: 'country not found' }, 404)
  const results = await database.batch([
    database.prepare(
      `DELETE FROM article_cities
       WHERE city_id IN (SELECT id FROM cities WHERE country_code = ?)`,
    ).bind(code),
    database.prepare('DELETE FROM cities WHERE country_code = ?').bind(code),
    database.prepare('DELETE FROM countries WHERE code = ?').bind(code),
  ])
  if (results.some((result) => !result.success)) {
    throw createError({ statusCode: 500, statusMessage: 'Country could not be deleted' })
  }
  setResponseStatus(event, 204)
  return null
}

function parseCountryInput(input: JsonObject | null) {
  if (!input) return null
  const code = readString(input, 'code', 2).toUpperCase()
  const nameKo = readString(input, 'nameKo', 100)
  const nameEn = readString(input, 'nameEn', 100)
  const continent = readString(input, 'continent', 50)
  const sortOrder = input.sortOrder === undefined ? 0 : input.sortOrder
  if (!code || !nameKo || !nameEn || typeof sortOrder !== 'number' || !Number.isInteger(sortOrder)) return null
  return { code, nameKo, nameEn, continent, sortOrder }
}

async function createCity(event: H3Event, database: D1Database, countryCodeValue: string) {
  const countryCode = countryCodeValue.trim().toUpperCase()
  const country = await d1First<{ code: string }>(database, 'SELECT code FROM countries WHERE code = ?', countryCode)
  if (!country) return respond(event, { error: 'country not found' }, 404)
  const input = await readJsonObject(event)
  const city = parseCityInput(input)
  if (!city) return respond(event, { error: 'city id and names are required' }, 400)
  const duplicate = await d1First<{ id: string }>(database, 'SELECT id FROM cities WHERE id = ?', city.id)
  if (duplicate) return respond(event, { error: 'city could not be created; check that its id is unique' }, 409)
  const row = await database.prepare(
    'INSERT INTO cities (id, country_code, name_ko, name_en) VALUES (?, ?, ?, ?) RETURNING *',
  ).bind(city.id, countryCode, city.nameKo, city.nameEn).first<CityRow>()
  if (!row) throw createError({ statusCode: 500, statusMessage: 'City could not be created' })
  return respond(event, cityJson(row), 201)
}

async function handleCityById(event: H3Event, database: D1Database, path: string[]) {
  if (path.length !== 1) return respond(event, { error: 'not found' }, 404)
  if (event.method === 'PUT') return updateCity(event, database, path[0] ?? '')
  if (event.method === 'DELETE') return deleteCity(event, database, path[0] ?? '')
  return respond(event, { error: 'not found' }, 404)
}

async function updateCity(event: H3Event, database: D1Database, id: string) {
  const current = await d1First<CityRow>(database, 'SELECT * FROM cities WHERE id = ?', id)
  if (!current) return respond(event, { error: 'city not found' }, 404)
  const input = await readJsonObject(event)
  const city = parseCityInput(input)
  if (!city) return respond(event, { error: 'city id and names are required' }, 400)
  if (city.id !== current.id) return respond(event, { error: 'city id cannot be changed' }, 400)
  await d1Run(
    database,
    'UPDATE cities SET name_ko = ?, name_en = ? WHERE id = ?',
    city.nameKo,
    city.nameEn,
    current.id,
  )
  const updated = await d1First<CityRow>(database, 'SELECT * FROM cities WHERE id = ?', current.id)
  return respond(event, updated ? cityJson(updated) : { error: 'city could not be updated' }, updated ? 200 : 500)
}

async function deleteCity(event: H3Event, database: D1Database, id: string) {
  const current = await d1First<CityRow>(database, 'SELECT * FROM cities WHERE id = ?', id)
  if (!current) return respond(event, { error: 'city not found' }, 404)
  const results = await database.batch([
    database.prepare('DELETE FROM article_cities WHERE city_id = ?').bind(id),
    database.prepare('DELETE FROM cities WHERE id = ?').bind(id),
  ])
  if (results.some((result) => !result.success)) {
    throw createError({ statusCode: 500, statusMessage: 'City could not be deleted' })
  }
  setResponseStatus(event, 204)
  return null
}

function parseCityInput(input: JsonObject | null) {
  if (!input) return null
  const id = normalizeSlug(readString(input, 'id', 50))
  const nameKo = readString(input, 'nameKo', 100)
  const nameEn = readString(input, 'nameEn', 100)
  if (!id || !nameKo || !nameEn) return null
  return { id, nameKo, nameEn }
}

async function createArticle(event: H3Event, database: D1Database) {
  const input = parseArticleInput(await readJsonObject(event))
  if (!input) return respond(event, { error: 'invalid article request' }, 400)
  if (!await categoryExists(database, input.category)) {
    return respond(event, { error: 'unknown article category' }, 400)
  }
  if (!await cityIdsExist(database, input.cityIds)) {
    return respond(event, { error: 'one or more selected cities do not exist' }, 400)
  }

  const publishedAt = input.status === 'published' ? new Date().toISOString() : null
  const created = await database.prepare(
    `INSERT INTO articles
      (title, slug, summary, content, category, author, cover_image, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
  ).bind(
    input.title,
    input.slug,
    input.summary,
    input.content,
    input.category,
    input.author,
    input.coverImage,
    input.status,
    publishedAt,
  ).first<{ id: number }>()
  if (!created) throw createError({ statusCode: 500, statusMessage: 'Article could not be created' })

  await replaceArticleCities(database, created.id, input.cityIds)
  const article = await getArticle(database, 'a.id = ?', created.id)
  if (!article) throw createError({ statusCode: 500, statusMessage: 'Article could not be loaded after creation' })
  return respond(event, article, 201)
}

async function updateArticle(event: H3Event, database: D1Database, idValue: string) {
  const id = Number(idValue)
  if (!Number.isSafeInteger(id) || id < 1) return respond(event, { error: 'article not found' }, 404)
  const existing = await d1First<ArticleRow>(database, 'SELECT * FROM articles WHERE id = ?', id)
  if (!existing) return respond(event, { error: 'article not found' }, 404)
  const input = parseArticleInput(await readJsonObject(event))
  if (!input) return respond(event, { error: 'invalid article request' }, 400)
  if (!await categoryExists(database, input.category)) {
    return respond(event, { error: 'unknown article category' }, 400)
  }
  if (!await cityIdsExist(database, input.cityIds)) {
    return respond(event, { error: 'one or more selected cities do not exist' }, 400)
  }

  const duplicate = await d1First<{ id: number }>(
    database,
    'SELECT id FROM articles WHERE slug = ? AND id <> ?',
    input.slug,
    id,
  )
  if (duplicate) {
    return respond(event, { error: 'article could not be updated; check that the slug is unique' }, 409)
  }
  await d1Run(
    database,
    `UPDATE articles
     SET title = ?, slug = ?, summary = ?, content = ?, category = ?, author = ?,
         cover_image = ?, status = ?, published_at = ?, updated_at = ?
     WHERE id = ?`,
    input.title,
    input.slug,
    input.summary,
    input.content,
    input.category,
    input.author,
    input.coverImage,
    input.status,
    input.status === 'published' ? new Date().toISOString() : null,
    new Date().toISOString(),
    id,
  )

  await replaceArticleCities(database, id, input.cityIds)
  const article = await getArticle(database, 'a.id = ?', id)
  if (!article) throw createError({ statusCode: 500, statusMessage: 'Article could not be loaded after update' })
  return respond(event, article)
}

async function deleteArticle(event: H3Event, database: D1Database, idValue: string) {
  const id = Number(idValue)
  if (!Number.isSafeInteger(id) || id < 1) return respond(event, { error: 'article not found' }, 404)
  const existing = await d1First<{ id: number }>(database, 'SELECT id FROM articles WHERE id = ?', id)
  if (!existing) return respond(event, { error: 'article not found' }, 404)
  await d1Run(database, 'DELETE FROM articles WHERE id = ?', id)
  setResponseStatus(event, 204)
  return null
}

async function categoryExists(database: D1Database, slug: string): Promise<boolean> {
  return !!await d1First<{ id: number }>(database, 'SELECT id FROM categories WHERE slug = ?', slug)
}

async function cityIdsExist(database: D1Database, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true
  const placeholders = ids.map(() => '?').join(', ')
  const rows = await d1All<{ id: string }>(
    database,
    `SELECT id FROM cities WHERE id IN (${placeholders})`,
    ...ids,
  )
  return rows.length === ids.length
}

async function replaceArticleCities(database: D1Database, articleId: number, cityIds: string[]) {
  const statements = [
    database.prepare('DELETE FROM article_cities WHERE article_id = ?').bind(articleId),
    ...cityIds.map((cityId) => database.prepare(
      'INSERT INTO article_cities (article_id, city_id) VALUES (?, ?)',
    ).bind(articleId, cityId)),
  ]
  const results = await database.batch(statements)
  if (results.some((result) => !result.success)) {
    throw createError({ statusCode: 500, statusMessage: 'Article locations could not be updated' })
  }
}

interface AdInput {
  id: string
  name: string
  adClientId: string
  adSlotId: string
  format: string
  isActive: boolean
}

function parseAdInput(input: JsonObject | null): AdInput | null {
  if (!input || (input.isActive !== undefined && typeof input.isActive !== 'boolean')) return null
  const id = normalizeSlug(readString(input, 'id', 50))
  const name = readString(input, 'name', 100)
  const adClientId = optionalString(input, 'adClientId', 100)
  const adSlotId = optionalString(input, 'adSlotId', 100)
  const format = optionalString(input, 'format', 50)
  if (adClientId === null || adSlotId === null || format === null) return null
  const isActive = input.isActive === true
  if (!id || !name) return null
  if (isActive && (!/^ca-pub-[0-9]+$/.test(adClientId) || !/^[0-9]+$/.test(adSlotId))) return null
  return { id, name, adClientId, adSlotId, format: format || 'auto', isActive }
}

async function createAdPlacement(event: H3Event, database: D1Database) {
  const input = parseAdInput(await readJsonObject(event))
  if (!input) {
    return respond(event, { error: 'ad placement id and name are required, with valid ids for active ads' }, 400)
  }
  const duplicate = await d1First<{ id: string }>(database, 'SELECT id FROM ad_placements WHERE id = ?', input.id)
  if (duplicate) {
    return respond(event, { error: 'ad placement could not be created; check that the id is unique' }, 409)
  }
  const row = await database.prepare(
    `INSERT INTO ad_placements (id, name, ad_client_id, ad_slot_id, format, is_active)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
  ).bind(
    input.id,
    input.name,
    input.adClientId,
    input.adSlotId,
    input.format,
    input.isActive ? 1 : 0,
  ).first<AdPlacementRow>()
  if (!row) throw createError({ statusCode: 500, statusMessage: 'Ad placement could not be created' })
  return respond(event, adPlacementJson(row), 201)
}

async function updateAdPlacement(event: H3Event, database: D1Database, id: string) {
  const existing = await d1First<AdPlacementRow>(database, 'SELECT * FROM ad_placements WHERE id = ?', id)
  if (!existing) return respond(event, { error: 'ad placement not found' }, 404)
  const input = parseAdInput(await readJsonObject(event))
  if (!input) {
    return respond(event, { error: 'ad placement id and name are required, with valid ids for active ads' }, 400)
  }
  if (input.id !== existing.id) return respond(event, { error: 'ad placement id cannot be changed' }, 400)
  await d1Run(
    database,
    `UPDATE ad_placements
     SET name = ?, ad_client_id = ?, ad_slot_id = ?, format = ?, is_active = ?,
         updated_at = ?
     WHERE id = ?`,
    input.name,
    input.adClientId,
    input.adSlotId,
    input.format,
    input.isActive ? 1 : 0,
    new Date().toISOString(),
    id,
  )
  const updated = await d1First<AdPlacementRow>(database, 'SELECT * FROM ad_placements WHERE id = ?', id)
  return respond(event, updated ? adPlacementJson(updated) : { error: 'ad placement could not be loaded after update' }, updated ? 200 : 500)
}

async function deleteAdPlacement(event: H3Event, database: D1Database, id: string) {
  const existing = await d1First<{ id: string }>(database, 'SELECT id FROM ad_placements WHERE id = ?', id)
  if (!existing) return respond(event, { error: 'ad placement not found' }, 404)
  await d1Run(database, 'DELETE FROM ad_placements WHERE id = ?', id)
  setResponseStatus(event, 204)
  return null
}
