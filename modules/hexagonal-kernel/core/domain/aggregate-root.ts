import { Entity } from './entity'
import type { DomainEvent } from './domain-event'

export abstract class AggregateRoot<TId extends string = string> extends Entity<TId> {
  private readonly domainEvents: DomainEvent[] = []

  protected recordEvent(event: DomainEvent): void {
    this.domainEvents.push(event)
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents]
    this.domainEvents.length = 0
    return events
  }

  peekDomainEvents(): readonly DomainEvent[] {
    return [...this.domainEvents]
  }
}
