import { isStaffRole } from './staff-permissions'
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
import { cachedPublic } from './response-cache'

// Per-isolate TTLs for public GETs. Short enough that editorial changes
// surface within a minute, long enough to absorb crawler bursts without
// re-running D1 on every hit.
const articleCache = { ttlMs: 60_000, swrMs: 300_000 }
const referenceCache = { ttlMs: 300_000, swrMs: 900_000 }
import { validateArticleForPublish } from './article-validator'
import { siteConfig } from '../../config/site.config'
import { publicArticleSql } from './sitemap-data'

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
  subtitle?: string
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
  source_name?: string
  source_url?: string
  license_info?: string
  is_breaking?: number
  first_published_at?: string | null
  source_first_published_at?: string | null
  source_updated_at?: string | null
  ingested_at?: string | null
  fact_checked_at?: string | null
  scheduled_at?: string | null
  retracted_at?: string | null
  retraction_reason?: string
  quality_score?: number
  review_status?: string
  meta_description?: string
  key_takeaways_json?: string
  generated_by?: string
}

/** Sentence boundary for Latin (". " etc.) and CJK ("。", "！", "？" with or without a following space). */
const SENTENCE_BREAK = /(?<=[.!?])\s+|(?<=[。！？])\s*/

function parseStringArray(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  } catch {
    return []
  }
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
  subtitle?: string
  slug: string
  summary: string
  content: string
  category: string
  author: string
  coverImage: string
  status: 'draft' | 'published'
  reviewStatus?: string
  sourceName?: string
  sourceUrl?: string
  licenseInfo?: string
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
    if (!account || !isStaffRole(account.role) || !validPassword) {
      await recordFailedLogin(event, database)
      return respond(event, { error: 'invalid username or password' }, 401)
    }
    await clearLoginAttempts(event, database)
    await createAdminSession(event, database, {
      id: account.id,
      username: account.username,
      role: account.role,
    })
    return respond(event, {
      username: account.username,
      role: account.role,
      expiresIn: adminSessionTtlSeconds,
    })
  }

  if (action === 'session' && event.method === 'GET') {
    const session = await authenticateAdmin(event, database)
    if (!session.identity) return respond(event, { error: 'authentication required' }, 401)
    const remaining = session.expiresAt ? Math.max(0, session.expiresAt - Math.floor(Date.now() / 1000)) : adminSessionTtlSeconds
    return respond(event, {
      username: session.identity.username,
      role: session.identity.role,
      expiresIn: remaining,
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
  if (resource === 'settings') return handleSettings(event, database, path.slice(1), admin)
  return respond(event, { error: 'not found' }, 404)
}

async function handleArticles(event: H3Event, database: D1Database, path: string[], admin: boolean) {
  const url = getRequestURL(event)
  const method = event.method
  const lang = (url.searchParams.get('lang') ?? 'ko').trim().toLowerCase()
  if (method === 'GET' && path.length === 0) {
    // cachedPublic bypasses /api/admin/* internally, so admin lists stay live.
    return respond(event, await cachedPublic(event, articleCache, () => listArticles(event, database, url, admin)))
  }
  if (method === 'GET' && path.length === 2 && path[0] === 'id' && !admin) {
    const id = Number(path[1] ?? '')
    if (!Number.isSafeInteger(id) || id < 1) return respond(event, { error: 'article not found' }, 404)
    const category = canonicalCategory(normalizeSlug(url.searchParams.get('category') ?? ''))
    const condition = category ? `a.id = ? AND ${publicArticleSql} AND a.category = ?` : `a.id = ? AND ${publicArticleSql}`
    const values: Array<string | number> = category ? [id, category] : [id]
    // Misses (null) are never cached, so newly published stories appear at once.
    const article = await cachedPublic(event, articleCache, () => getArticle(database, condition, lang, ...values))
    if (!article) return respond(event, { error: 'article not found' }, 404)
    // Track only after confirming the story exists: 404 probes must not write analytics rows.
    await trackArticleView(event, database, id, category || undefined)
    return respond(event, article)
  }
  if (method === 'GET' && path.length === 1 && !admin) {
    const slug = normalizeSlug(path[0] ?? '')
    const article = await cachedPublic(event, articleCache, () => getArticle(database, `a.slug = ? AND ${publicArticleSql}`, lang, slug))
    if (!article) return respond(event, { error: 'article not found' }, 404)
    await trackArticleView(event, database, (article as unknown as { id: number }).id)
    return respond(event, article)
  }
  if (method === 'GET' && path.length === 1 && admin) {
    const id = Number(path[0] ?? '')
    if (!Number.isSafeInteger(id) || id < 1) return respond(event, { error: 'invalid article id: must be a positive integer' }, 400)
    const article = await getArticle(database, 'a.id = ?', lang, id)
    return article ? respond(event, article) : respond(event, { error: 'article not found' }, 404)
  }
  if (method === 'POST' && path.length === 0 && admin) return createArticle(event, database)
  if (method === 'PUT' && path.length === 1 && admin) return updateArticle(event, database, path[0] ?? '')
  if (method === 'DELETE' && path.length === 1 && admin) return deleteArticle(event, database, path[0] ?? '')
  return respond(event, { error: 'not found' }, 404)
}

async function listArticles(event: H3Event, database: D1Database, url: URL, admin: boolean): Promise<unknown> {
  const lang = (url.searchParams.get('lang') ?? 'ko').trim().toLowerCase()
  const clauses: string[] = []
  const values: Array<string | number> = []
  if (!admin) clauses.push(publicArticleSql)

  const category = normalizeSlug(url.searchParams.get('category') ?? '')
  if (category && category !== 'realtime') {
    clauses.push('a.category = ?')
    values.push(canonicalCategory(category))
  }
  const idsParam = url.searchParams.get('ids')
  if (idsParam) {
    const rawIds = idsParam.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id) && id > 0)
    if (rawIds.length > 0) {
      clauses.push(`a.id IN (${rawIds.map(() => '?').join(',')})`)
      values.push(...rawIds)
    }
  }
  const search = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
  if (search) {
    // '!' is the LIKE escape character so user-entered % and _ match literally.
    const pattern = `%${search.replace(/[!%_]/g, (char) => `!${char}`)}%`
    clauses.push(`(a.title LIKE ? ESCAPE '!' OR a.summary LIKE ? ESCAPE '!'
      OR EXISTS (SELECT 1 FROM article_translations st WHERE st.article_id = a.id AND (st.title LIKE ? ESCAPE '!' OR st.summary LIKE ? ESCAPE '!'))
      OR EXISTS (SELECT 1 FROM article_tags sat JOIN tags stg ON stg.id = sat.tag_id WHERE sat.article_id = a.id AND stg.name LIKE ? ESCAPE '!'))`)
    values.push(pattern, pattern, pattern, pattern, pattern)
  }
  const tag = normalizeSlug(url.searchParams.get('tag') ?? '')
  if (tag) {
    clauses.push('EXISTS (SELECT 1 FROM article_tags fat JOIN tags ftg ON ftg.id = fat.tag_id WHERE fat.article_id = a.id AND ftg.slug = ?)')
    values.push(tag)
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

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const pageParam = url.searchParams.get('page')
  const hasPage = pageParam !== null
  const wantsMeta = hasPage || url.searchParams.get('with_meta') === 'true'

  // The full-table COUNT exists only for paginated responses; bare-array
  // callers (ticker, related, most-read) never read totals.
  const countRow = wantsMeta
    ? await d1First<{ count: number }>(
      database,
      `SELECT COUNT(DISTINCT a.id) AS count FROM articles a ${where}`,
      ...values,
    ).catch(() => ({ count: 0 }))
    : null
  const totalCount = countRow?.count ?? 0
  let page = 1
  if (hasPage) {
    page = Math.max(1, parseInt(pageParam, 10) || 1)
  }

  const limitValue = url.searchParams.get('limit')
  const offsetValue = url.searchParams.get('offset')
  let limit = limitValue === null ? (hasPage ? 10 : 0) : Number(limitValue)
  let offset = offsetValue === null ? (hasPage ? (page - 1) * limit : 0) : Number(offsetValue)

  if (!admin) {
    if ((limitValue !== null && (!Number.isInteger(limit) || limit <= 0))
      || (offsetValue !== null && (!Number.isInteger(offset) || offset < 0))) {
      throw createError({ statusCode: 400, statusMessage: 'limit and offset must be valid integers' })
    }
  }

  let pagination = ''
  const paginationValues: number[] = []
  if (limit > 0) {
    pagination = ' LIMIT ? OFFSET ?'
    paginationValues.push(Math.min(limit, 100), offset)
  } else if (offset > 0) {
    pagination = ' LIMIT -1 OFFSET ?'
    paginationValues.push(offset)
  }

  const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1

  if (wantsMeta) {
    setResponseHeader(event, 'X-Total-Count', String(totalCount))
    setResponseHeader(event, 'X-Total-Pages', String(totalPages))
    setResponseHeader(event, 'X-Current-Page', String(page))
    setResponseHeader(event, 'X-Page-Limit', String(limit > 0 ? limit : totalCount))
  }

  const sort = !admin && url.searchParams.get('sort') === 'views'
    ? 'a.view_count DESC, a.published_at DESC, a.id DESC'
    : 'a.published_at DESC, a.id DESC'
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
            ${admin ? 'COALESCE(t.content, a.content)' : "''"} AS content,
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
  const articles = groupArticles(rows)

  if (wantsMeta) {
    return {
      data: articles,
      page,
      limit: limit > 0 ? limit : totalCount,
      total_count: totalCount,
      total_pages: totalPages,
    }
  }

  return articles
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
       a.subtitle, a.source_name, a.source_url, a.license_info, a.is_breaking,
       a.first_published_at, a.source_first_published_at, a.source_updated_at,
       a.ingested_at, a.fact_checked_at, a.scheduled_at, a.retracted_at,
       a.retraction_reason, a.quality_score, a.review_status, a.meta_description, a.key_takeaways_json, a.generated_by,
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
  const article = groupArticles(rows)[0] ?? null
  if (article && typeof article === 'object') {
    const articleId = (article as Record<string, unknown>).id as number
    try {
      // One parallel wave instead of seven sequential round trips.
      const [citations, factChecks, corrections, prev, next, tags, languages] = await Promise.all([
        d1All(database, 'SELECT source_name, source_url, published_date, license_type FROM article_citations WHERE article_id = ?', articleId),
        d1All(database, 'SELECT claim, verification_status, evidence_url, checked_by, checked_at, notes FROM article_fact_checks WHERE article_id = ?', articleId),
        d1All(database, "SELECT original_statement, corrected_statement, reason, corrected_at FROM article_corrections WHERE article_id = ? AND status = 'approved'", articleId),
        // Prev & Next articles for bidirectional reader navigation
        d1First<{ id: number; title: string; category: string; slug: string }>(
          database,
          `SELECT a.id, COALESCE(t.title, a.title) AS title, a.category, a.slug FROM articles a
           LEFT JOIN article_translations t ON t.article_id = a.id AND t.lang = ?
           WHERE a.id < ? AND ${publicArticleSql} ORDER BY a.id DESC LIMIT 1`,
          normLang,
          articleId,
        ),
        d1First<{ id: number; title: string; category: string; slug: string }>(
          database,
          `SELECT a.id, COALESCE(t.title, a.title) AS title, a.category, a.slug FROM articles a
           LEFT JOIN article_translations t ON t.article_id = a.id AND t.lang = ?
           WHERE a.id > ? AND ${publicArticleSql} ORDER BY a.id ASC LIMIT 1`,
          normLang,
          articleId,
        ),
        d1All<{ slug: string; name: string }>(database,
          'SELECT tg.slug, tg.name FROM article_tags at JOIN tags tg ON tg.id = at.tag_id WHERE at.article_id = ? ORDER BY tg.name', articleId),
        d1All<{ lang: string }>(database,
          "SELECT lang FROM article_translations WHERE article_id = ? AND trim(title) <> '' AND trim(content) <> '' ORDER BY lang", articleId),
      ])
      ;(article as Record<string, unknown>).citations = citations
      ;(article as Record<string, unknown>).factChecks = factChecks
      ;(article as Record<string, unknown>).corrections = corrections
      ;(article as Record<string, unknown>).tags = tags
      ;(article as Record<string, unknown>).availableLanguages = ['ko', ...languages.map(row => row.lang)]
      ;(article as Record<string, unknown>).prevArticle = prev || null
      ;(article as Record<string, unknown>).nextArticle = next || null
    } catch {
      // Fallback if citations/factChecks table not populated
    }

    // Auto-calculate Reading Time and Non-Duplicate AI Key Takeaways (3~4 distinct body facts)
    const contentStr = String((article as Record<string, unknown>).content || '')
    const cleanChars = contentStr.replace(/!\[.*?\]\(.*?\)/g, '').replace(/#+\s/g, '').trim().length
    const readingTimeMinutes = Math.max(1, Math.ceil(cleanChars / 500))
    ;(article as Record<string, unknown>).readingTimeMinutes = readingTimeMinutes

    const titleText = String((article as Record<string, unknown>).title || '').trim()
    const summaryText = String((article as Record<string, unknown>).summary || '').trim()
    const summarySentenceSet = new Set(
      summaryText
        .split(SENTENCE_BREAK)
        .map((s) => s.trim())
        .filter(Boolean),
    )

    // Extract first substantive sentence from each body paragraph, excluding duplicates of summary/title
    const bodyParagraphs = contentStr
      .split(/\n{2,}/)
      .map((p) => p.replace(/\*\*/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').trim())
      .filter((p) => p && !p.startsWith('#') && !p.startsWith('!') && !p.startsWith('>') && p.length > 25)

    const extractedTakeaways: string[] = []
    for (const para of bodyParagraphs) {
      const sentences = para
        .split(SENTENCE_BREAK)
        .map((s) => s.trim())
        .filter((s) => [...s].length >= 12 && [...s].length <= 180)
      for (const s of sentences) {
        if (
          !summarySentenceSet.has(s)
          && !summaryText.includes(s)
          && s !== titleText
          && !extractedTakeaways.includes(s)
        ) {
          extractedTakeaways.push(s)
          break
        }
      }
      if (extractedTakeaways.length >= 4) break
    }

    const stored = normLang === 'ko' ? parseStringArray((article as Record<string, unknown>).storedTakeaways) : []
    delete (article as Record<string, unknown>).storedTakeaways
    ;(article as Record<string, unknown>).keyTakeaways = stored.length >= 2 ? stored : extractedTakeaways.length >= 2
      ? extractedTakeaways.slice(0, 4)
      : Array.from(summarySentenceSet).slice(0, 3)
  }
  return article
}

function groupArticles(rows: ArticleJoinRow[]): Record<string, unknown>[] {
  const articles = new Map<number, Record<string, unknown>>()
  for (const row of rows) {
    let article = articles.get(row.id)
    if (!article) {
      article = {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle || '',
        slug: row.slug,
        summary: row.summary,
        content: row.content,
        category: row.category,
        author: row.author,
        coverImage: row.cover_image,
        status: row.status,
        publishedAt: row.published_at,
        firstPublishedAt: row.first_published_at || row.published_at || row.created_at,
        sourceFirstPublishedAt: row.source_first_published_at,
        sourceUpdatedAt: row.source_updated_at,
        ingestedAt: row.ingested_at,
        factCheckedAt: row.fact_checked_at || null,
        scheduledAt: row.scheduled_at,
        retractedAt: row.retracted_at,
        retractionReason: row.retraction_reason,
        qualityScore: row.quality_score || 85,
        reviewStatus: row.review_status || 'approved',
        sourceName: row.source_name || '',
        sourceUrl: row.source_url || '',
        licenseInfo: row.license_info || 'Editorial Fair Citation',
        isBreaking: Boolean(row.is_breaking),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        viewCount: row.view_count,
        ...(row.meta_description !== undefined ? { metaDescription: row.meta_description || '' } : {}),
        ...(row.key_takeaways_json !== undefined ? { storedTakeaways: row.key_takeaways_json } : {}),
        ...(row.generated_by !== undefined ? { isAiGenerated: Boolean(row.generated_by) } : {}),
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

async function trackArticleView(event: H3Event, database: D1Database, articleId: number, category?: string) {
  const userAgent = (getRequestHeader(event, 'user-agent') || '').toLowerCase()
  const isBot = /bot|crawl|spider|slurp|headless|lighthouse|mediapartners|google|bing|yandex|baidu|facebookexternalhit|whatsapp|telegram/i.test(userAgent)
  const referrer = getRequestHeader(event, 'referer') ? 'referral' : 'direct'
  const userAgentSample = userAgent.slice(0, 100)

  const task = (async () => {
    try {
      await d1Run(
        database,
        `INSERT INTO analytics_events (article_id, event_type, bot_classification, referrer_category, target_platform, meta_json)
         VALUES (?, 'page_view', ?, ?, '', ?)`,
        articleId,
        isBot ? 'crawler' : 'human',
        referrer,
        JSON.stringify({ ua: userAgentSample }),
      )
    } catch {
      // Analytics error ignored
    }

    if (!isBot) {
      try {
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
      } catch {
        // View-count error ignored
      }
    }
  })()

  // Analytics must not serialize in front of the response: on Workers it runs
  // after the response is sent. Runtimes without waitUntil (tests, CLI) await
  // it so the side effect stays observable.
  const waitUntil = (event as unknown as { waitUntil?: unknown }).waitUntil
  if (typeof waitUntil === 'function') {
    (waitUntil as (promise: Promise<unknown>) => void)(task.catch(() => {}))
    return
  }
  await task
}

async function handleCategories(event: H3Event, database: D1Database, path: string[]) {
  const method = event.method
  if (method === 'GET' && path.length === 0) {
    const body = await cachedPublic(event, referenceCache, async () => {
      const rows = await d1All<CategoryRow>(database, 'SELECT * FROM categories ORDER BY id ASC')
      return rows.map(categoryJson)
    })
    return respond(event, body)
  }
  if (method === 'POST' && path.length === 0 && isAdminPath(event)) return createCategory(event, database)
  if (method === 'PUT' && path.length === 1 && isAdminPath(event)) return updateCategory(event, database, path[0] ?? '')
  if (method === 'DELETE' && path.length === 1 && isAdminPath(event)) return deleteCategory(event, database, path[0] ?? '')
  return respond(event, { error: 'not found' }, 404)
}

async function handleCountries(event: H3Event, database: D1Database, path: string[]) {
  const method = event.method
  if (method === 'GET' && path.length === 0) {
    const body = await cachedPublic(event, referenceCache, async () => {
      const rows = await d1All<CountryRow>(database, 'SELECT * FROM countries ORDER BY sort_order ASC, name_en ASC')
      return rows.map(countryJson)
    })
    return respond(event, body)
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
  const body = await cachedPublic(event, referenceCache, async () => {
    const country = await d1First<{ code: string }>(database, 'SELECT code FROM countries WHERE code = ?', countryCode)
    if (!country) return null
    const cities = await d1All<CityRow>(
      database,
      'SELECT * FROM cities WHERE country_code = ? ORDER BY name_en ASC',
      countryCode,
    )
    return cities.map(cityJson)
  })
  if (!body) return respond(event, { error: 'country not found' }, 404)
  return respond(event, body)
}

async function handleAds(event: H3Event, database: D1Database, path: string[], admin: boolean) {
  const method = event.method
  if (method === 'GET' && path.length === 0) {
    const body = await cachedPublic(event, referenceCache, async () => {
      const rows = await d1All<AdPlacementRow>(
        database,
        `SELECT * FROM ad_placements ${admin ? '' : 'WHERE is_active = 1'} ORDER BY id ASC`,
      )
      return rows.map(adPlacementJson)
    })
    return respond(event, body)
  }
  if (method === 'POST' && path.length === 0 && admin) return createAdPlacement(event, database)
  if (method === 'PUT' && path.length === 1 && admin) return updateAdPlacement(event, database, path[0] ?? '')
  if (method === 'DELETE' && path.length === 1 && admin) return deleteAdPlacement(event, database, path[0] ?? '')
  return respond(event, { error: 'not found' }, 404)
}

function respond(event: H3Event, body: unknown, status = 200) {
  setResponseStatus(event, status)
  if (event.method === 'GET' && !isAdminPath(event) && status >= 200 && status < 300) {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  } else {
    setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  }
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
  const subtitle = optionalString(input, 'subtitle', 255) || ''
  const slug = normalizeSlug(readString(input, 'slug', 200))
  const category = canonicalCategory(normalizeSlug(readString(input, 'category', 60)))
  const summary = optionalString(input, 'summary', 500)
  const content = optionalString(input, 'content', maxRequestBytes)
  const author = optionalString(input, 'author', 80)
  const coverImage = optionalString(input, 'coverImage', 2048)
  const sourceName = optionalString(input, 'sourceName', 120) || ''
  const sourceUrl = optionalString(input, 'sourceUrl', 500) || ''
  const licenseInfo = optionalString(input, 'licenseInfo', 120) || 'Editorial Fair Citation'
  const reviewStatus = optionalString(input, 'reviewStatus', 50) || (status === 'published' ? 'approved' : 'needs_review')
  if (!title || !slug || !category || summary === null || content === null || author === null || coverImage === null) return null
  return {
    title,
    subtitle,
    slug,
    summary,
    content,
    category,
    author,
    coverImage,
    status: status as ArticleInput['status'],
    reviewStatus,
    sourceName,
    sourceUrl,
    licenseInfo,
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
  if (['editor', 'reporter'].includes(event.context.staffRole) && (input.status !== 'draft' || !['draft', 'needs_review'].includes(input.reviewStatus || 'needs_review'))) {
    return respond(event, { error: 'Editorial approval is required to publish' }, 403)
  }
  if (!await categoryExists(database, input.category)) {
    return respond(event, { error: 'unknown article category' }, 400)
  }
  if (!await cityIdsExist(database, input.cityIds)) {
    return respond(event, { error: 'one or more selected cities do not exist' }, 400)
  }

  // Strict validation for public publishing (drafts bypass these rules)
  if (input.status === 'published') {
    if (!input.licenseInfo?.trim() || input.licenseInfo === 'Editorial Fair Citation') {
      return respond(event, { error: 'Document explicit content usage rights before publishing' }, 422)
    }
    const validation = validateArticleForPublish({
      content: input.content,
      coverImage: input.coverImage,
    })
    if (!validation.valid) {
      return respond(
        event,
        {
          error: 'validation_failed',
          message: '기사 발행 조건(본문 텍스트 800~2,000자, 본문 이미지 4~10장)을 충족하지 못했습니다.',
          textLength: validation.textLength,
          imageCount: validation.imageCount,
          errors: validation.errors,
          details: validation.details,
        },
        400,
      )
    }
  }

  const now = new Date().toISOString()
  const publishedAt = input.status === 'published' ? now : null
  const reviewStatus = input.reviewStatus || (input.status === 'published' ? 'approved' : 'needs_review')
  const session = await authenticateAdmin(event, database)
  const username = session.identity?.username || 'admin'

  const created = await database.prepare(
    `INSERT INTO articles
      (title, subtitle, slug, summary, content, category, author, cover_image, status, review_status, source_name, source_url, license_info, published_at, first_published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
  ).bind(
    input.title,
    input.subtitle || '',
    input.slug,
    input.summary,
    input.content,
    input.category,
    input.author,
    input.coverImage,
    input.status,
    reviewStatus,
    input.sourceName || '',
    input.sourceUrl || '',
    input.licenseInfo || 'Editorial Fair Citation',
    publishedAt,
    publishedAt,
    now,
    now,
  ).first<{ id: number }>()
  if (!created) throw createError({ statusCode: 500, statusMessage: 'Article could not be created' })

  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'editor',
    username,
    'create_article',
    `article:${created.id}`,
    JSON.stringify({ title: input.title, status: input.status, category: input.category }),
  )

  await replaceArticleCities(database, created.id, input.cityIds)
  const article = await getArticle(database, 'a.id = ?', 'ko', created.id)
  if (!article) throw createError({ statusCode: 500, statusMessage: 'Article could not be loaded after creation' })
  return respond(event, article, 201)
}

async function updateArticle(event: H3Event, database: D1Database, idValue: string) {
  const id = Number(idValue)
  if (!Number.isSafeInteger(id) || id < 1) return respond(event, { error: 'article not found' }, 404)
  const existing = await d1First<ArticleRow>(database, 'SELECT * FROM articles WHERE id = ?', id)
  if (!existing) return respond(event, { error: 'article not found' }, 404)
  if (event.context.staffRole === 'editor' && existing.status === 'published') return respond(event, { error: 'Published articles require chief editor approval' }, 403)
  const input = parseArticleInput(await readJsonObject(event))
  if (!input) return respond(event, { error: 'invalid article request' }, 400)
  if (['editor', 'reporter'].includes(event.context.staffRole) && (input.status !== 'draft' || !['draft', 'needs_review'].includes(input.reviewStatus || 'needs_review'))) {
    return respond(event, { error: 'Editorial approval is required to publish' }, 403)
  }
  if (!await categoryExists(database, input.category)) {
    return respond(event, { error: 'unknown article category' }, 400)
  }
  if (!await cityIdsExist(database, input.cityIds)) {
    return respond(event, { error: 'one or more selected cities do not exist' }, 400)
  }

  // Strict validation for public publishing (drafts bypass these rules)
  if (input.status === 'published') {
    if (!input.licenseInfo?.trim() || input.licenseInfo === 'Editorial Fair Citation') {
      return respond(event, { error: 'Document explicit content usage rights before publishing' }, 422)
    }
    const validation = validateArticleForPublish({
      content: input.content,
      coverImage: input.coverImage,
    })
    if (!validation.valid) {
      return respond(
        event,
        {
          error: 'validation_failed',
          message: '기사 발행 조건(본문 텍스트 800~2,000자, 본문 이미지 4~10장)을 충족하지 못했습니다.',
          textLength: validation.textLength,
          imageCount: validation.imageCount,
          errors: validation.errors,
          details: validation.details,
        },
        400,
      )
    }
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

  const now = new Date().toISOString()
  const session = await authenticateAdmin(event, database)
  const username = session.identity?.username || 'admin'
  const publishedAt = input.status === 'published'
    ? (existing.published_at || now)
    : null
  const firstPublishedAt = input.status === 'published'
    ? (existing.first_published_at || existing.published_at || now)
    : existing.first_published_at
  const reviewStatus = input.reviewStatus || (input.status === 'published' ? 'approved' : 'needs_review')

  // 1. Snapshot previous version into article_revisions
  try {
    const latestRev = await d1First<{ max_rev: number | null }>(
      database,
      'SELECT MAX(revision_num) AS max_rev FROM article_revisions WHERE article_id = ?',
      id,
    )
    const nextRevNumber = (latestRev?.max_rev ?? 0) + 1
    await d1Run(
      database,
      `INSERT INTO article_revisions (article_id, revision_num, title, summary, content, author_id, editor_note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      nextRevNumber,
      existing.title,
      existing.summary,
      existing.content,
      null,
      `Editorial update via CMS (${username || 'editor'})`,
      now,
    )
  } catch {
    // If article_revisions table not present in test env
  }

  // 2. Update articles table with all metadata
  await d1Run(
    database,
    `UPDATE articles
     SET title = ?, subtitle = ?, slug = ?, summary = ?, content = ?, category = ?, author = ?,
         cover_image = ?, status = ?, review_status = ?, source_name = ?, source_url = ?, license_info = ?,
         published_at = ?, first_published_at = ?, updated_at = ?
     WHERE id = ?`,
    input.title,
    input.subtitle || '',
    input.slug,
    input.summary,
    input.content,
    input.category,
    input.author,
    input.coverImage,
    input.status,
    reviewStatus,
    input.sourceName || '',
    input.sourceUrl || '',
    input.licenseInfo || 'Editorial Fair Citation',
    publishedAt,
    firstPublishedAt || null,
    now,
    id,
  )

  // 3. Record in audit_logs
  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'editor',
    username,
    'update_article',
    `article:${id}`,
    JSON.stringify({ title: input.title, status: input.status, category: input.category }),
  )

  await replaceArticleCities(database, id, input.cityIds)
  const article = await getArticle(database, 'a.id = ?', 'ko', id)
  if (!article) throw createError({ statusCode: 500, statusMessage: 'Article could not be loaded after update' })
  return respond(event, article)
}

async function deleteArticle(event: H3Event, database: D1Database, idValue: string) {
  const id = Number(idValue)
  if (!Number.isSafeInteger(id) || id < 1) return respond(event, { error: 'article not found' }, 404)
  const existing = await d1First<{ id: number; title: string }>(database, 'SELECT id, title FROM articles WHERE id = ?', id)
  if (!existing) return respond(event, { error: 'article not found' }, 404)
  const session = await authenticateAdmin(event, database)
  const username = session.identity?.username || 'admin'
  await d1Run(database, 'DELETE FROM articles WHERE id = ?', id)
  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'editor',
    username,
    'delete_article',
    `article:${id}`,
    JSON.stringify({ title: existing.title }),
  )
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

async function handleSettings(event: H3Event, database: D1Database, path: string[], admin: boolean) {
  const method = event.method

    if (method === 'GET' && path.length === 0) {
    const merged = await cachedPublic(event, referenceCache, async () => {
      const rows = await d1All<{ key: string; value: string }>(
        database,
        'SELECT key, value FROM site_settings'
      ).catch(() => [])

      const dbMap: Record<string, string> = {}
      for (const r of rows) {
        dbMap[r.key] = r.value
      }

      // Statutory publisher fields are returned only as configured — never with invented defaults.
      return {
        company_name: dbMap.company_name || '',
        representative: dbMap.representative || '',
        business_number: dbMap.business_number || '',
        mail_order_number: dbMap.mail_order_number || '',
        newspaper_number: dbMap.newspaper_number || '',
        youth_protection_officer: dbMap.youth_protection_officer || '',
        publisher: dbMap.publisher || '',
        address: dbMap.address || '',
        contact_email: dbMap.contact_email || '',
        contact_phone: dbMap.contact_phone || '',
        site_url: dbMap.site_url || siteConfig.domain,
        brand_name: dbMap.brand_name || 'CHECK-IN',
        brand_subname: dbMap.brand_subname || 'DAILY',
        slogan: dbMap.slogan || '글로벌 여행 인텔리전스 & 마켓 트렌드 뉴스 미디어',
        description: dbMap.description || '전 세계 항공, 호텔, 여행지 트렌드 및 여행 정책을 가장 빠르고 깊이 있게 전달하는 글로벌 여행 전문 디지털 뉴스룸',
      }
    })
    return respond(event, merged)
  }

  if ((method === 'PUT' || method === 'POST') && path.length === 0 && admin) {
    const input = await readJsonObject(event)
    const nowIso = new Date().toISOString()
    const allowedKeys = [
      'company_name',
      'representative',
      'business_number',
      'mail_order_number',
      'newspaper_number',
      'youth_protection_officer',
      'publisher',
      'address',
      'contact_email',
      'contact_phone',
      'site_url',
      'brand_name',
      'brand_subname',
      'slogan',
      'description',
    ]

    for (const key of allowedKeys) {
      if (input && input[key] !== undefined) {
        const val = String(input[key] ?? '').trim().slice(0, 500)
        await d1Run(
          database,
          `INSERT INTO site_settings (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          key,
          val,
          nowIso
        )
      }
    }

    return respond(event, { success: true, message: '사이트 및 법적 설정이 성공적으로 저장되었습니다.' })
  }

  return respond(event, { error: 'not found' }, 404)
}

