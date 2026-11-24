import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

export class DrizzleSqliteDriver {
  readonly sqlite: Database.Database
  readonly db: BetterSQLite3Database
  readonly filePath: string
  private closed = false

  constructor(filePath = ':memory:') {
    this.filePath = filePath
    if (filePath !== ':memory:') {
      mkdirSync(dirname(filePath), { recursive: true })
    }
    this.sqlite = new Database(filePath)
    this.sqlite.pragma('journal_mode = WAL')
    this.sqlite.pragma('foreign_keys = ON')
    this.db = drizzle(this.sqlite)
  }

  execDDL(sql: string): void {
    this.sqlite.exec(sql)
  }

  close(): void {
    if (!this.closed) {
      this.sqlite.close()
      this.closed = true
    }
  }

  isClosed(): boolean {
    return this.closed
  }
}
