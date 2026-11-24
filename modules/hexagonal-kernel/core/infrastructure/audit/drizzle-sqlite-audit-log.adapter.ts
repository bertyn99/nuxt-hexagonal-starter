import { desc, eq } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { DomainEvent } from '../../domain/domain-event'
import type { AuditLogEntry, AuditLogPort } from '../../application/ports/audit-log.port'
import type { DrizzleSqliteDriver } from '../persistence/drizzle-sqlite-driver'

export const auditLogsTable = sqliteTable('hex_audit_logs', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  eventName: text('event_name').notNull(),
  boundedContext: text('bounded_context').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  occurredAt: text('occurred_at').notNull(),
  summary: text('summary').notNull(),
  payloadJson: text('payload_json').notNull(),
})

let sqliteAuditSeq = 0

export class DrizzleSqliteAuditLogAdapter implements AuditLogPort {
  constructor(private readonly driver: DrizzleSqliteDriver) {
    this.ensureSchema()
  }

  ensureSchema(): void {
    this.driver.execDDL(`
      CREATE TABLE IF NOT EXISTS hex_audit_logs (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        bounded_context TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_hex_audit_logs_aggregate
        ON hex_audit_logs (aggregate_id, occurred_at);
    `)
  }

  async recordFromEvent(event: DomainEvent, summary: string): Promise<AuditLogEntry> {
    sqliteAuditSeq += 1
    const id = `aud_${Date.now().toString(36)}_${sqliteAuditSeq.toString(36).padStart(4, '0')}`
    const entry: AuditLogEntry = {
      id,
      eventId: event.eventId,
      eventName: event.eventName,
      boundedContext: event.boundedContext,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      occurredAt: event.occurredAt,
      summary,
      payload: { ...event.payload },
    }

    this.driver.db
      .insert(auditLogsTable)
      .values({
        id: entry.id,
        eventId: entry.eventId,
        eventName: entry.eventName,
        boundedContext: entry.boundedContext,
        aggregateId: entry.aggregateId,
        aggregateType: entry.aggregateType,
        occurredAt: entry.occurredAt,
        summary: entry.summary,
        payloadJson: JSON.stringify(entry.payload),
      })
      .run()

    return entry
  }

  async listByAggregate(aggregateId: string): Promise<AuditLogEntry[]> {
    const rows = this.driver.db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.aggregateId, aggregateId))
      .all()

    return rows.map(row => ({
      id: row.id,
      eventId: row.eventId,
      eventName: row.eventName,
      boundedContext: row.boundedContext,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
      occurredAt: row.occurredAt,
      summary: row.summary,
      payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    }))
  }

  async listRecent(limit = 50): Promise<AuditLogEntry[]> {
    const rows = this.driver.db
      .select()
      .from(auditLogsTable)
      .orderBy(desc(auditLogsTable.occurredAt))
      .limit(limit)
      .all()

    return rows.map(row => ({
      id: row.id,
      eventId: row.eventId,
      eventName: row.eventName,
      boundedContext: row.boundedContext,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
      occurredAt: row.occurredAt,
      summary: row.summary,
      payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    }))
  }
}
