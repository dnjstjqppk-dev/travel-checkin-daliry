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

interface WorkerEnvironment {
  DB?: D1Database
  ADMIN_BOOTSTRAP_TOKEN?: string
}

let cachedDb: D1Database | undefined

export function getWorkerEnvironment(event: H3Event): WorkerEnvironment | undefined {
  const platform = event.context._platform?.cloudflare?.env
  const development = event.context.cloudflare?.env
  return (platform ?? development) as WorkerEnvironment | undefined
}

export function getD1Database(event?: H3Event): D1Database | undefined {
  if (event) {
    const db = getWorkerEnvironment(event)?.DB
    if (db) {
      cachedDb = db
      ;(globalThis as any).__cf_db = db
      return db
    }
  }
  if (cachedDb) return cachedDb
  if ((globalThis as any).__cf_db) return (globalThis as any).__cf_db
  return undefined
}

export async function d1All<Row>(
  database: D1Database,
  query: string,
  ...values: Array<string | number | null | ArrayBuffer | boolean>
): Promise<Row[]> {
  const result = await database.prepare(query).bind(...values).all<Row>()
  if (!result.success) {
    throw createError({ statusCode: 500, statusMessage: 'Database query failed' })
  }
  return result.results ?? []
}

export async function d1First<Row>(
  database: D1Database,
  query: string,
  ...values: Array<string | number | null | ArrayBuffer | boolean>
): Promise<Row | null> {
  return database.prepare(query).bind(...values).first<Row>()
}

export async function d1Run(
  database: D1Database,
  query: string,
  ...values: Array<string | number | null | ArrayBuffer | boolean>
): Promise<D1Result<never>> {
  const result = await database.prepare(query).bind(...values).run()
  if (!result.success) {
    throw createError({ statusCode: 500, statusMessage: 'Database operation failed' })
  }
  return result
}
