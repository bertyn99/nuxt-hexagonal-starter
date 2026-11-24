import { createDomainEvent } from '../../../../hexagonal-kernel/core/domain/domain-event'
import type { DomainEvent } from '../../../../hexagonal-kernel/core/domain/domain-event'
import type { HandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'
import type { StorageZone } from '../value-objects/storage-zone'

export function createCargoStoredInBinEvent(params: {
  binId: string
  binCode: string
  zone: StorageZone
  cargoId: string
  cargoKind: 'PARCEL' | 'PALLET'
  cargoLabel: string
  handlingClass: HandlingClass
  weightKg: number
  volumeM3: number
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'CargoStoredInBin',
    boundedContext: 'warehouse',
    aggregateId: params.binId,
    aggregateType: 'WarehouseBin',
    occurredAt: params.occurredAt,
    payload: {
      binCode: params.binCode,
      zone: params.zone,
      cargoId: params.cargoId,
      cargoKind: params.cargoKind,
      cargoLabel: params.cargoLabel,
      handlingClass: params.handlingClass,
      weightKg: params.weightKg,
      volumeM3: params.volumeM3,
    },
  })
}

export function createCargoAllocatedEvent(params: {
  binId: string
  binCode: string
  cargoId: string
  cargoLabel: string
  shipmentId: string
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'CargoAllocated',
    boundedContext: 'warehouse',
    aggregateId: params.binId,
    aggregateType: 'WarehouseBin',
    occurredAt: params.occurredAt,
    payload: {
      binCode: params.binCode,
      cargoId: params.cargoId,
      cargoLabel: params.cargoLabel,
      shipmentId: params.shipmentId,
    },
  })
}

export function createCargoReleasedEvent(params: {
  binId: string
  binCode: string
  cargoId: string
  cargoLabel: string
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'CargoReleased',
    boundedContext: 'warehouse',
    aggregateId: params.binId,
    aggregateType: 'WarehouseBin',
    occurredAt: params.occurredAt,
    payload: {
      binCode: params.binCode,
      cargoId: params.cargoId,
      cargoLabel: params.cargoLabel,
    },
  })
}

export function createBinThresholdReachedEvent(params: {
  binId: string
  binCode: string
  zone: StorageZone
  utilizationPercent: number
  occurredAt: Date
}): DomainEvent {
  return createDomainEvent({
    eventName: 'BinThresholdReached',
    boundedContext: 'warehouse',
    aggregateId: params.binId,
    aggregateType: 'WarehouseBin',
    occurredAt: params.occurredAt,
    payload: {
      binCode: params.binCode,
      zone: params.zone,
      utilizationPercent: params.utilizationPercent,
    },
  })
}
