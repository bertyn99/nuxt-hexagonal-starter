import { Shipment } from '../../domain/entities/shipment'
import type { CargoSummary, ShipmentSnapshot } from '../../domain/entities/shipment'
import type { CarrierMode } from '../../domain/policies/carrier-strategy'
import type { ShipmentStateName } from '../../domain/states/shipment-state'

export interface ShipmentPersistenceRecord {
  id: string
  trackingNumber: string
  originBinId: string
  originBinCode: string
  cargoSummaryJson: string
  destination: string
  carrierMode: CarrierMode
  carrierReference: string | null
  quotedCostCents: number
  currency: string
  promisedByIso: string
  estimatedHours: number
  state: ShipmentStateName
  attemptCount: number
  lastExceptionNote: string | null
  slaBreached: number
  createdAtIso: string
  updatedAtIso: string
}

export function toShipmentRecord(shipment: Shipment): ShipmentPersistenceRecord {
  const s = shipment.toSnapshot()
  return {
    id: s.id,
    trackingNumber: s.trackingNumber,
    originBinId: s.originBinId,
    originBinCode: s.originBinCode,
    cargoSummaryJson: JSON.stringify(s.cargoSummary),
    destination: s.destination,
    carrierMode: s.carrierMode,
    carrierReference: s.carrierReference,
    quotedCostCents: s.quotedCostCents,
    currency: s.currency,
    promisedByIso: s.promisedByIso,
    estimatedHours: s.estimatedHours,
    state: s.state,
    attemptCount: s.attemptCount,
    lastExceptionNote: s.lastExceptionNote,
    slaBreached: s.slaBreached ? 1 : 0,
    createdAtIso: s.createdAtIso,
    updatedAtIso: s.updatedAtIso,
  }
}

export function fromShipmentRecord(record: ShipmentPersistenceRecord): Shipment {
  const snapshot: ShipmentSnapshot = {
    id: record.id,
    trackingNumber: record.trackingNumber,
    originBinId: record.originBinId,
    originBinCode: record.originBinCode,
    cargoSummary: JSON.parse(record.cargoSummaryJson) as CargoSummary,
    destination: record.destination,
    carrierMode: record.carrierMode,
    carrierReference: record.carrierReference,
    quotedCostCents: record.quotedCostCents,
    currency: record.currency,
    promisedByIso: record.promisedByIso,
    estimatedHours: record.estimatedHours,
    state: record.state,
    attemptCount: record.attemptCount,
    lastExceptionNote: record.lastExceptionNote,
    slaBreached: Boolean(record.slaBreached),
    createdAtIso: record.createdAtIso,
    updatedAtIso: record.updatedAtIso,
  }
  return Shipment.rehydrate(snapshot)
}
