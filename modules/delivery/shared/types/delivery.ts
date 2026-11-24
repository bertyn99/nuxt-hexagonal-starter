export type DeliveryHandlingClassDto = 'STANDARD' | 'FRAGILE' | 'COLD_CHAIN' | 'HAZMAT'
export type CarrierModeDto = 'STANDARD_GROUND' | 'EXPRESS_AIR' | 'COLD_CHAIN_COURIER'
export type ShipmentStateDto =
  | 'PendingDispatch'
  | 'Dispatched'
  | 'InTransit'
  | 'OutForDelivery'
  | 'DeliveryAttemptFailed'
  | 'Delivered'
  | 'ReturnedToWarehouse'
  | 'Cancelled'

export interface CargoSummaryDto {
  cargoId: string
  cargoKind: 'PARCEL' | 'PALLET'
  sku: string
  label: string
  handlingClass: DeliveryHandlingClassDto
  weightKg: number
  volumeM3: number
  itemCount: number
}

export interface AvailableCargoDto {
  binId: string
  binCode: string
  cargoId: string
  cargoKind: 'PARCEL' | 'PALLET'
  sku: string
  label: string
  handlingClass: DeliveryHandlingClassDto
  weightKg: number
  volumeM3: number
  itemCount: number
}

export interface ShipmentDto {
  id: string
  trackingNumber: string
  originBinId: string
  originBinCode: string
  cargoSummary: CargoSummaryDto
  destination: string
  carrierMode: CarrierModeDto
  carrierReference: string | null
  quotedCostCents: number
  quotedCostFormatted: string
  currency: string
  promisedByIso: string
  estimatedHours: number
  remainingHours: number
  state: ShipmentStateDto
  isTerminal: boolean
  attemptCount: number
  lastExceptionNote: string | null
  slaBreached: boolean
  createdAtIso: string
  updatedAtIso: string
}

export interface DeliveryQuoteDto {
  carrierMode: CarrierModeDto
  carrierLabel: string
  costCents: number
  costFormatted: string
  currency: string
  estimatedHours: number
  promisedByIso: string
  notes: string
}

export interface ShipmentTimelineEventDto {
  id: string
  eventId: string
  eventName: string
  boundedContext: string
  aggregateId: string
  aggregateType: string
  occurredAt: string
  summary: string
  payload: Record<string, unknown>
}

export interface ShipmentTimelineDto {
  shipment: ShipmentDto
  events: ShipmentTimelineEventDto[]
}

export interface SlaEvaluationDto {
  evaluatedAtIso: string
  evaluatedCount: number
  newlyBreachedCount: number
  totalBreachedCount: number
  breachedTrackingNumbers: string[]
}
