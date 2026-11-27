import type { ExecutionContext } from '../../../../../hexagonal-kernel/core/application/use-case'
import type { HandlingClass } from '../../../../../hexagonal-kernel/core/domain/handling-class'

export interface AvailableWarehouseCargo {
  readonly binId: string
  readonly binCode: string
  readonly cargoId: string
  readonly cargoKind: 'PARCEL' | 'PALLET'
  readonly sku: string
  readonly label: string
  readonly handlingClass: HandlingClass
  readonly weightKg: number
  readonly volumeM3: number
  readonly itemCount: number
}

/**
 * Anti-Corruption Layer (ACL) Outbound Port owned by Delivery.
 * Translates Warehouse concepts into Delivery's own language without leaking Warehouse domain types.
 */
export interface WarehouseStockPort {
  listAvailableCargo(ctx?: ExecutionContext): Promise<AvailableWarehouseCargo[]>
  allocateCargo(
    cargoId: string,
    shipmentId: string,
    ctx?: ExecutionContext,
  ): Promise<AvailableWarehouseCargo>
  releaseCargo?(cargoId: string, ctx?: ExecutionContext): Promise<void>
}
