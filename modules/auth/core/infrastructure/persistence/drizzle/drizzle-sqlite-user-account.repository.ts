import { asc, eq } from 'drizzle-orm'
import type { DrizzleSqliteDriver } from '../../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type { UserAccountRepositoryPort } from '../../../application/ports/outbound/user-account-repository.port'
import type { UserAccount } from '../../../domain/entities/user-account'
import { fromUserAccountRecord, toUserAccountRecord } from '../user-account.mapper'
import { authUsersTable } from './auth.schema'

export class DrizzleSqliteUserAccountRepository implements UserAccountRepositoryPort {
  constructor(private readonly driver: DrizzleSqliteDriver) {
    this.ensureSchema()
  }

  ensureSchema(): void {
    this.driver.execDDL(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        roles_json TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_auth_users_email
        ON auth_users (email);
    `)
  }

  async findById(id: string): Promise<UserAccount | null> {
    const row = this.driver.db.select().from(authUsersTable).where(eq(authUsersTable.id, id)).get()
    return row ? fromUserAccountRecord(row) : null
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const normalized = email.trim().toLowerCase()
    const row = this.driver.db
      .select()
      .from(authUsersTable)
      .where(eq(authUsersTable.email, normalized))
      .get()
    return row ? fromUserAccountRecord(row) : null
  }

  async findAll(): Promise<UserAccount[]> {
    const rows = this.driver.db
      .select()
      .from(authUsersTable)
      .orderBy(asc(authUsersTable.createdAt))
      .all()
    return rows.map(fromUserAccountRecord)
  }

  async save(account: UserAccount): Promise<void> {
    const record = toUserAccountRecord(account)
    this.driver.db
      .insert(authUsersTable)
      .values(record)
      .onConflictDoUpdate({
        target: authUsersTable.id,
        set: {
          email: record.email,
          name: record.name,
          rolesJson: record.rolesJson,
          passwordHash: record.passwordHash,
          active: record.active,
          createdAt: record.createdAt,
        },
      })
      .run()
  }
}
