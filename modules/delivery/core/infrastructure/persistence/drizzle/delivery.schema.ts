import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const deliveryShipmentsTable = sqliteTable('delivery_shipments', {
  id: text('id').primaryKey(),
  trackingNumber: text('tracking_number').notNull().unique(),
  originBinId: text('origin_bin_id').notNull(),
  originBinCode: text('origin_bin_code').notNull(),
  cargoSummaryJson: text('cargo_summary_json').notNull(),
  destination: text('destination').notNull(),
  carrierMode: text('carrier_mode').notNull(),
  carrierReference: text('carrier_reference'),
  quotedCostCents: integer('quoted_cost_cents').notNull(),
  currency: text('currency').notNull(),
  promisedByIso: text('promised_by_iso').notNull(),
  estimatedHours: integer('estimated_hours').notNull(),
  state: text('state').notNull(),
  attemptCount: integer('attempt_count').notNull(),
  lastExceptionNote: text('last_exception_note'),
  slaBreached: integer('sla_breached').notNull(),
  createdAtIso: text('created_at_iso').notNull(),
  updatedAtIso: text('updated_at_iso').notNull(),
})
