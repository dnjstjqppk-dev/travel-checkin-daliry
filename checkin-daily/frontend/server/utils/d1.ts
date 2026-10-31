import type { H3Event } from 'h3'
import { createError } from 'h3'

export interface D1Result<Row> {
  results?: Row[]
  success: boolean
  meta?: {
    changes?: number
    last_row_id?: number
  }
  error?: string
}

export interface D1PreparedStatement {
  bind(...values: Array<string | number | null | ArrayBuffer | boolean>): D1PreparedStatement
  all<Row>(): Promise<D1Result<Row>>
  first<Row>(): Promise<Row | null>
  run(): Promise<D1Result<never>>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<D1Result<never>[]>
}

export interface WorkerEnvironment {
  DB?: D1Database
  ADMIN_BOOTSTRAP_TOKEN?: string
  IMAGES_BUCKET?: unknown
  R2_IMAGES?: unknown
  R2_PUBLIC_DOMAIN?: string
}

let cachedDb: D1Database | undefined

export function getWorkerEnvironment(event: H3Event): WorkerEnvironment | undefined {
  const platform = event.context._platform?.cloudflare?.env
  const development = event.context.cloudflare?.env
  return (platform ?? development) as WorkerEnvironment | undefined
}

export function getD1Database(event?: H3Event): D1Database | undefined {
  if (event) {
    const env = getWorkerEnvironment(event)
    if (env?.DB) return env.DB
  }
  if (cachedDb) return cachedDb
  return undefined
}

export function setTestD1Database(db: D1Database | undefined) {
  cachedDb = db
}

export async function d1Run(database: D1Database, query: string, ...values: Array<string | number | null | ArrayBuffer | boolean>): Promise<D1Result<never>> {
  const statement = database.prepare(query).bind(...values)
  const result = await statement.run()
  if (!result.success) {
    throw createError({ statusCode: 500, statusMessage: result.error || 'D1 write operation failed' })
  }
  return result
}

export async function d1First<Row>(database: D1Database, query: string, ...values: Array<string | number | null | ArrayBuffer | boolean>): Promise<Row | null> {
  const statement = database.prepare(query).bind(...values)
  return statement.first<Row>()
}

export async function d1All<Row>(database: D1Database, query: string, ...values: Array<string | number | null | ArrayBuffer | boolean>): Promise<Row[]> {
  const statement = database.prepare(query).bind(...values)
  const result = await statement.all<Row>()
  if (!result.success) {
    throw createError({ statusCode: 500, statusMessage: result.error || 'D1 read operation failed' })
  }
  return result.results || []
}
