import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { d1First, d1Run, getD1Database, type D1Database } from '../utils/d1'

const providerUrl = 'https://open.er-api.com/v6/latest/KRW'
const currenciesByCountry = [
  { code: 'KR', country: '대한민국', currency: 'KRW', currencyName: '원' },
  { code: 'JP', country: '일본', currency: 'JPY', currencyName: '엔' },
  { code: 'US', country: '미국', currency: 'USD', currencyName: '달러' },
  { code: 'FR', country: '프랑스', currency: 'EUR', currencyName: '유로' },
  { code: 'IT', country: '이탈리아', currency: 'EUR', currencyName: '유로' },
  { code: 'TH', country: '태국', currency: 'THB', currencyName: '바트' },
  { code: 'VN', country: '베트남', currency: 'VND', currencyName: '동' },
  { code: 'SG', country: '싱가포르', currency: 'SGD', currencyName: '싱가포르 달러' },
  { code: 'GB', country: '영국', currency: 'GBP', currencyName: '파운드' },
  { code: 'AU', country: '호주', currency: 'AUD', currencyName: '호주 달러' },
] as const

interface CachedRates {
  rates_json: string
  provider_updated_at: string
  expires_at: number
}

interface ProviderResponse {
  result: string
  time_last_update_utc: string
  time_next_update_unix: number
  base_code: string
  rates: Record<string, number>
}

function isProviderResponse(value: unknown): value is ProviderResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<ProviderResponse>
  return response.result === 'success'
    && response.base_code === 'KRW'
    && typeof response.time_last_update_utc === 'string'
    && typeof response.time_next_update_unix === 'number'
    && Boolean(response.rates)
    && typeof response.rates === 'object'
}

function formatRates(rates: Record<string, number>, updatedAt: string, stale: boolean) {
  const currencies = currenciesByCountry.map((item) => {
    const rate = rates[item.currency]
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw createError({ statusCode: 502, statusMessage: `Exchange rate is unavailable for ${item.currency}` })
    }
    const unit = (item.currency === 'JPY' || item.currency === 'VND') ? 100 : 1
    const krwPrice = (1 / rate) * unit
    return {
      ...item,
      unit,
      krwPrice: Math.round(krwPrice * 100) / 100,
      per1000Krw: rate * 1000,
    }
  })
  return {
    base: 'KRW',
    amount: 1000,
    rates: currencies,
    updatedAt,
    stale,
    source: 'ExchangeRate-API (Live Market)',
    sourceUrl: 'https://www.exchangerate-api.com',
  }
}

async function readCachedRates(database: D1Database): Promise<CachedRates | null> {
  return d1First<CachedRates>(
    database,
    'SELECT rates_json, provider_updated_at, expires_at FROM exchange_rate_cache WHERE base_code = ?',
    'KRW',
  )
}

async function getProviderRates(): Promise<ProviderResponse> {
  const response = await fetch(providerUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: 'Exchange rate provider request failed' })
  }
  const result: unknown = await response.json()
  if (!isProviderResponse(result)) {
    throw createError({ statusCode: 502, statusMessage: 'Exchange rate provider returned invalid data' })
  }
  return result
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const forceRefresh = query.refresh === 'true'

  if (forceRefresh) {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
  } else {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
  }
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')

  const database = getD1Database(event)
  const cached = database ? await readCachedRates(database) : null
  const now = Math.floor(Date.now() / 1000)

  // Use cached data only if forceRefresh is false and cache is not expired
  if (!forceRefresh && cached && cached.expires_at > now) {
    return formatRates(JSON.parse(cached.rates_json) as Record<string, number>, cached.provider_updated_at, false)
  }

  let latest: ProviderResponse
  try {
    latest = await getProviderRates()
  } catch (error) {
    if (cached) {
      setResponseHeader(event, 'X-Rate-Data-Stale', 'true')
      return formatRates(JSON.parse(cached.rates_json) as Record<string, number>, cached.provider_updated_at, true)
    }
    throw createError({
      statusCode: 502,
      statusMessage: 'Currency rates are temporarily unavailable',
      cause: error,
    })
  }

  // TTL: 1 hour (3600 seconds) for real-time market updates
  const expiry = now + 3600
  if (database) {
    await d1Run(
      database,
      `INSERT INTO exchange_rate_cache (base_code, rates_json, provider_updated_at, expires_at, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(base_code) DO UPDATE SET
         rates_json = excluded.rates_json,
         provider_updated_at = excluded.provider_updated_at,
         expires_at = excluded.expires_at,
         fetched_at = excluded.fetched_at`,
      'KRW',
      JSON.stringify(latest.rates),
      latest.time_last_update_utc,
      expiry,
      new Date().toISOString(),
    )
  }
  return formatRates(latest.rates, latest.time_last_update_utc, false)
})
