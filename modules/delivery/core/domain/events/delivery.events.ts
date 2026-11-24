import { createDomainEvent } from '../../../../hexagonal-kernel/core/domain/domain-event'
import type { DomainEvent } from '../../../../hexagonal-kernel/core/domain/domain-event'

export function createShipmentCreatedEvent(params: {
  shipmentId: string
  trackingNumber: string
  originBinId: string
  cargoId: string
  destination: string
  carrierMode: string
  quotedCostCents: number
  currency: string
  promisedBy: string
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'ShipmentCreated',
    boundedContext: 'delivery',
    aggregateId: params.shipmentId,
    aggregateType: 'Shipment',
    occurredAt: params.occurredAt,
    payload: {
      trackingNumber: params.trackingNumber,
      originBinId: params.originBinId,
      cargoId: params.cargoId,
      destination: params.destination,
      carrierMode: params.carrierMode,
      quotedCostCents: params.quotedCostCents,
      currency: params.currency,
      promisedBy: params.promisedBy,
    },
  })
}

export function createShipmentDispatchedEvent(params: {
  shipmentId: string
  trackingNumber: string
  carrierMode: string
  carrierReference: string
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'ShipmentDispatched',
    boundedContext: 'delivery',
    aggregateId: params.shipmentId,
    aggregateType: 'Shipment',
    occurredAt: params.occurredAt,
    payload: {
      trackingNumber: params.trackingNumber,
      carrierMode: params.carrierMode,
      carrierReference: params.carrierReference,
    },
  })
}

export function createShipmentTransitAdvancedEvent(params: {
  shipmentId: string
  trackingNumber: string
  previousState: string
  nextState: string
  locationNote?: string
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'ShipmentTransitAdvanced',
    boundedContext: 'delivery',
    aggregateId: params.shipmentId,
    aggregateType: 'Shipment',
    occurredAt: params.occurredAt,
    payload: {
      trackingNumber: params.trackingNumber,
      previousState: params.previousState,
      nextState: params.nextState,
      locationNote: params.locationNote ?? '',
    },
  })
}

export function createDeliveryAttemptFailedEvent(params: {
  shipmentId: string
  trackingNumber: string
  attemptNumber: number
  reason: string
  resolutionAction: string
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'DeliveryAttemptFailed',
    boundedContext: 'delivery',
    aggregateId: params.shipmentId,
    aggregateType: 'Shipment',
    occurredAt: params.occurredAt,
    payload: {
      trackingNumber: params.trackingNumber,
      attemptNumber: params.attemptNumber,
      reason: params.reason,
      resolutionAction: params.resolutionAction,
    },
  })
}

export function createDeliverySlaBreachedEvent(params: {
  shipmentId: string
  trackingNumber: string
  promisedBy: string
  detectedAt: string
  overdueHours: number
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'DeliverySlaBreached',
    boundedContext: 'delivery',
    aggregateId: params.shipmentId,
    aggregateType: 'Shipment',
    occurredAt: params.occurredAt,
    payload: {
      trackingNumber: params.trackingNumber,
      promisedBy: params.promisedBy,
      detectedAt: params.detectedAt,
      overdueHours: params.overdueHours,
    },
  })
}

export function createShipmentReturnedToWarehouseEvent(params: {
  shipmentId: string
  trackingNumber: string
  originBinId: string
  cargoId: string
  reason: string
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'ShipmentReturnedToWarehouse',
    boundedContext: 'delivery',
    aggregateId: params.shipmentId,
    aggregateType: 'Shipment',
    occurredAt: params.occurredAt,
    payload: {
      trackingNumber: params.trackingNumber,
      originBinId: params.originBinId,
      cargoId: params.cargoId,
      reason: params.reason,
    },
  })
}

export function createShipmentDeliveredEvent(params: {
  shipmentId: string
  trackingNumber: string
  recipientNote?: string
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'ShipmentDelivered',
    boundedContext: 'delivery',
    aggregateId: params.shipmentId,
    aggregateType: 'Shipment',
    occurredAt: params.occurredAt,
    payload: {
      trackingNumber: params.trackingNumber,
      recipientNote: params.recipientNote ?? '',
    },
  })
}

export function createShipmentCancelledEvent(params: {
  shipmentId: string
  trackingNumber: string
  originBinId: string
  cargoId: string
  reason: string
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'ShipmentCancelled',
    boundedContext: 'delivery',
    aggregateId: params.shipmentId,
    aggregateType: 'Shipment',
    occurredAt: params.occurredAt,
    payload: {
      trackingNumber: params.trackingNumber,
      originBinId: params.originBinId,
      cargoId: params.cargoId,
      reason: params.reason,
    },
  })
}
