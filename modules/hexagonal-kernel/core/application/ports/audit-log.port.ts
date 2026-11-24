import type { DomainEvent } from '../../domain/domain-event'

export interface AuditLogEntry {
  readonly id: string
  readonly eventId: string
  readonly eventName: string
  readonly boundedContext: string
  readonly aggregateId: string
  readonly aggregateType: string
  readonly occurredAt: string
  readonly summary: string
  readonly payload: Readonly<Record<string, unknown>>
}

export interface AuditLogPort {
  recordFromEvent(event: DomainEvent, summary: string): Promise<AuditLogEntry>
  listByAggregate(aggregateId: string): Promise<AuditLogEntry[]>
  listRecent(limit?: number): Promise<AuditLogEntry[]>
}
