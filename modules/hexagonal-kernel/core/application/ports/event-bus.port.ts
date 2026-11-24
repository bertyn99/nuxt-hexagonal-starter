import type { DomainEvent } from '../../domain/domain-event'

export type DomainEventHandler<TEvent extends DomainEvent = DomainEvent> = (
  event: TEvent,
) => Promise<void> | void

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>
  publishAll(events: readonly DomainEvent[]): Promise<void>
  subscribe(eventName: string, handler: DomainEventHandler): () => void
  subscribeAll(handler: DomainEventHandler): () => void
  getPublishedEvents(limit?: number): readonly DomainEvent[]
  clearHistory(): void
}
