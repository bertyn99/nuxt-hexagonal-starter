import type { DomainEvent } from '../domain/domain-event'
import type { AuditLogPort } from './ports/audit-log.port'
import type { EventBusPort } from './ports/event-bus.port'

export function registerAuditLogSubscriber(
  eventBus: EventBusPort,
  auditLog: AuditLogPort,
): () => void {
  return eventBus.subscribeAll(async (event: DomainEvent) => {
    const summary = formatDomainEventSummary(event)
    await auditLog.recordFromEvent(event, summary)
  })
}

export function formatDomainEventSummary(event: DomainEvent): string {
  const payload = event.payload
  switch (event.eventName) {
    case 'CargoStoredInBin':
      return `Stored ${String(payload.cargoLabel ?? payload.cargoId)} (${String(payload.handlingClass ?? '')}) in bin ${String(payload.binCode ?? event.aggregateId)}`
    case 'CargoAllocated':
      return `Allocated cargo ${String(payload.cargoLabel ?? payload.cargoId)} from bin ${String(payload.binCode ?? event.aggregateId)}`
    case 'CargoReleased':
      return `Released cargo ${String(payload.cargoId)} from bin ${String(payload.binCode ?? event.aggregateId)}`
    case 'BinThresholdReached':
      return `Bin ${String(payload.binCode ?? event.aggregateId)} reached ${String(payload.utilizationPercent)}% capacity threshold`
    case 'ShipmentCreated':
      return `Created shipment ${String(payload.trackingNumber)} via ${String(payload.carrierMode)} to ${String(payload.destination)}`
    case 'ShipmentDispatched':
      return `Dispatched ${String(payload.trackingNumber)} with carrier ref ${String(payload.carrierReference ?? 'N/A')}`
    case 'ShipmentTransitAdvanced':
      return `Shipment ${String(payload.trackingNumber)} moved to ${String(payload.nextState)}`
    case 'DeliveryAttemptFailed':
      return `Delivery attempt #${String(payload.attemptNumber)} failed (${String(payload.reason)}) -> ${String(payload.resolutionAction)}`
    case 'DeliverySlaBreached':
      return `SLA breached for ${String(payload.trackingNumber)} (promised ${String(payload.promisedBy)})`
    case 'ShipmentReturnedToWarehouse':
      return `Shipment ${String(payload.trackingNumber)} returned to warehouse bin ${String(payload.originBinId)}`
    case 'ShipmentDelivered':
      return `Shipment ${String(payload.trackingNumber)} delivered successfully`
    case 'ShipmentCancelled':
      return `Shipment ${String(payload.trackingNumber)} cancelled before dispatch`
    default:
      return `${event.eventName} on ${event.aggregateType}#${event.aggregateId}`
  }
}
