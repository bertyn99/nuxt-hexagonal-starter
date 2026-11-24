import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'

export interface CarrierWebhookDeliveryLog {
  readonly eventName: string
  readonly trackingNumber: string
  readonly occurredAt: string
}

/**
 * Observer Pattern: reacts to post-commit delivery lifecycle events to notify carrier webhooks.
 */
export function registerCarrierWebhookSubscriber(
  eventBus: EventBusPort,
  sink: CarrierWebhookDeliveryLog[] = [],
): () => void {
  const watched = [
    'ShipmentDispatched',
    'DeliverySlaBreached',
    'ShipmentDelivered',
    'ShipmentReturnedToWarehouse',
  ]
  const unsubs = watched.map(eventName =>
    eventBus.subscribe(eventName, event => {
      sink.push({
        eventName: event.eventName,
        trackingNumber: String(event.payload.trackingNumber ?? event.aggregateId),
        occurredAt: event.occurredAt,
      })
    }),
  )

  return () => {
    for (const unsub of unsubs) {
      unsub()
    }
  }
}
