import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const warehouseBinsTable = sqliteTable('warehouse_bins', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  zone: text('zone').notNull(),
  maxWeightKg: real('max_weight_kg').notNull(),
  maxVolumeM3: real('max_volume_m3').notNull(),
  storedEntriesJson: text('stored_entries_json').notNull(),
})
