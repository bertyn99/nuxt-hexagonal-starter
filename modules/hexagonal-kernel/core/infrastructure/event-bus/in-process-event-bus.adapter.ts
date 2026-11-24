import type { DomainEvent } from '../../domain/domain-event'
import type { DomainEventHandler, EventBusPort } from '../../application/ports/event-bus.port'

export class InProcessEventBusAdapter implements EventBusPort {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>()
  private readonly wildcardHandlers = new Set<DomainEventHandler>()
  private readonly history: DomainEvent[] = []
  private readonly maxHistory: number

  constructor(maxHistory = 200) {
    this.maxHistory = maxHistory
  }

  async publish(event: DomainEvent): Promise<void> {
    this.history.push(event)
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory)
    }

    const specific = this.handlers.get(event.eventName)
    if (specific) {
      for (const handler of specific) {
        await handler(event)
      }
    }

    for (const handler of this.wildcardHandlers) {
      await handler(event)
    }
  }

  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event)
    }
  }

  subscribe(eventName: string, handler: DomainEventHandler): () => void {
    let set = this.handlers.get(eventName)
    if (!set) {
      set = new Set()
      this.handlers.set(eventName, set)
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
    }
  }

  subscribeAll(handler: DomainEventHandler): () => void {
    this.wildcardHandlers.add(handler)
    return () => {
      this.wildcardHandlers.delete(handler)
    }
  }

  getPublishedEvents(limit = 50): readonly DomainEvent[] {
    if (limit <= 0) {
      return []
    }
    return this.history.slice(-limit)
  }

  clearHistory(): void {
    this.history.length = 0
  }
}
