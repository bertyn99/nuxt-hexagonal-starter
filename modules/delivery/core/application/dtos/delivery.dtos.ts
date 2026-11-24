import type { AuditLogEntry } from '../../../../hexagonal-kernel/core/application/ports/audit-log.port'
import type { CargoSummary, CarrierMode, Shipment, ShipmentStateName } from '../../domain'

export interface ShipmentView {
  readonly id: string
  readonly trackingNumber: string
  readonly originBinId: string
  readonly originBinCode: string
  readonly cargoSummary: CargoSummary
  readonly destination: string
  readonly carrierMode: CarrierMode
  readonly carrierReference: string | null
  readonly quotedCostCents: number
  readonly quotedCostFormatted: string
  readonly currency: string
  readonly promisedByIso: string
  readonly estimatedHours: number
  readonly remainingHours: number
  readonly state: ShipmentStateName
  readonly isTerminal: boolean
  readonly attemptCount: number
  readonly lastExceptionNote: string | null
  readonly slaBreached: boolean
  readonly createdAtIso: string
  readonly updatedAtIso: string
}

export interface ShipmentTimelineView {
  readonly shipment: ShipmentView
  readonly events: readonly AuditLogEntry[]
}

export interface DeliveryQuoteView {
  readonly carrierMode: CarrierMode
  readonly carrierLabel: string
  readonly costCents: number
  readonly costFormatted: string
  readonly currency: string
  readonly estimatedHours: number
  readonly promisedByIso: string
  readonly notes: string
}

export interface SlaEvaluationView {
  readonly evaluatedAtIso: string
  readonly evaluatedCount: number
  readonly newlyBreachedCount: number
  readonly totalBreachedCount: number
  readonly breachedTrackingNumbers: string[]
}

export function mapShipmentToView(shipment: Shipment, now: Date): ShipmentView {
  return {
    id: shipment.id,
    trackingNumber: shipment.trackingNumber.value,
    originBinId: shipment.originBinId,
    originBinCode: shipment.originBinCode,
    cargoSummary: { ...shipment.cargoSummary },
    destination: shipment.destination,
    carrierMode: shipment.carrierMode,
    carrierReference: shipment.carrierReference,
    quotedCostCents: shipment.quotedCost.amountCents,
    quotedCostFormatted: shipment.quotedCost.format(),
    currency: shipment.quotedCost.currency,
    promisedByIso: shipment.deliveryWindow.promisedByIso,
    estimatedHours: shipment.deliveryWindow.estimatedHours,
    remainingHours: shipment.deliveryWindow.remainingHours(now),
    state: shipment.state,
    isTerminal: shipment.isTerminal,
    attemptCount: shipment.attemptCount,
    lastExceptionNote: shipment.lastExceptionNote,
    slaBreached: shipment.slaBreached,
    createdAtIso: shipment.createdAtIso,
    updatedAtIso: shipment.updatedAtIso,
  }
}
