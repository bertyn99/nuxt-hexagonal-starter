import type { DomainEvent } from '../../domain/domain-event'
import type { AuditLogEntry, AuditLogPort } from '../../application/ports/audit-log.port'

let auditSeq = 0

export class InMemoryAuditLogAdapter implements AuditLogPort {
  private readonly entries: AuditLogEntry[] = []

  async recordFromEvent(event: DomainEvent, summary: string): Promise<AuditLogEntry> {
    auditSeq += 1
    const entry: AuditLogEntry = {
      id: `aud_${auditSeq.toString(36).padStart(5, '0')}`,
      eventId: event.eventId,
      eventName: event.eventName,
      boundedContext: event.boundedContext,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      occurredAt: event.occurredAt,
      summary,
      payload: { ...event.payload },
    }
    this.entries.push(entry)
    return entry
  }

  async listByAggregate(aggregateId: string): Promise<AuditLogEntry[]> {
    return this.entries.filter(entry => entry.aggregateId === aggregateId)
  }

  async listRecent(limit = 50): Promise<AuditLogEntry[]> {
    return this.entries.slice(-limit).reverse()
  }

  clear(): void {
    this.entries.length = 0
  }
}
