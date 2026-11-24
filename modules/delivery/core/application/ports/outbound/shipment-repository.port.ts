import type { Shipment } from '../../../domain/entities/shipment'
import type { CarrierMode } from '../../../domain/policies/carrier-strategy'
import type { ShipmentStateName } from '../../../domain/states/shipment-state'

export interface ShipmentFilter {
  readonly state?: ShipmentStateName
  readonly carrierMode?: CarrierMode
  readonly slaBreachedOnly?: boolean
}

export interface ShipmentRepositoryPort {
  findById(id: string): Promise<Shipment | null>
  findByTrackingNumber(trackingNumber: string): Promise<Shipment | null>
  findAll(filter?: ShipmentFilter): Promise<Shipment[]>
  save(shipment: Shipment): Promise<void>
  delete(id: string): Promise<void>
}
