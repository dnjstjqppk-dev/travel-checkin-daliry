import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import type { D1Database, D1PreparedStatement } from '../server/utils/d1'

export function testDatabase() {
  const sqlite = new DatabaseSync(':memory:')
  const migrations = new URL('../migrations/', import.meta.url)
  for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
  }
  class Statement {
    values: any[] = []
    constructor(public query: string) {}
    bind(...values: any[]) { this.values = values; return this }
    async first<Row>() { return (sqlite.prepare(this.query).get(...this.values) ?? null) as Row | null }
    async all<Row>() { return { success: true, results: sqlite.prepare(this.query).all(...this.values) as Row[] } }
    async run() {
      const result = sqlite.prepare(this.query).run(...this.values)
      return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }
    }
  }
  const database: D1Database = {
    prepare: (sql) => new Statement(sql),
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN IMMEDIATE')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        sqlite.exec('COMMIT')
        return results
      } catch (error) { sqlite.exec('ROLLBACK'); throw error }
    },
  }
  return { database, sqlite }
}
