import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const authUsersTable = sqliteTable('auth_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  rolesJson: text('roles_json').notNull(),
  passwordHash: text('password_hash').notNull(),
  active: integer('active').notNull().default(1),
  createdAt: text('created_at').notNull(),
})
