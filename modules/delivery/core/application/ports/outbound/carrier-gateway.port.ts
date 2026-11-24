import type { CarrierMode } from '../../../domain/policies/carrier-strategy'

export interface CarrierDispatchRequest {
  readonly shipmentId: string
  readonly trackingNumber: string
  readonly carrierMode: CarrierMode
  readonly destination: string
  readonly weightKg: number
}

export interface CarrierDispatchReceipt {
  readonly carrierReference: string
  readonly adapterName: string
  readonly extraDelayHours: number
}

export interface CarrierGatewayPort {
  readonly adapterName: string
  dispatchShipment(request: CarrierDispatchRequest): Promise<CarrierDispatchReceipt>
}
