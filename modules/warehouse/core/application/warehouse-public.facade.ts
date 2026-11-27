import type { HandlingClass } from '../../../hexagonal-kernel/core/domain/handling-class'
import type { ExecutionContext, UseCase } from '../../../hexagonal-kernel/core/application/use-case'
import type { WarehouseBinView } from './dtos/warehouse.dtos'
import type {
  AllocateCargoForShipmentInput,
  AllocateCargoForShipmentOutput,
} from './use-cases/allocate-cargo-for-shipment.use-case'
import type { ListWarehouseBinsInput } from './use-cases/list-warehouse-bins.query'
import type {
  ReturnCargoToWarehouseInput,
  ReturnCargoToWarehouseOutput,
} from './use-cases/return-cargo-to-warehouse.use-case'

export interface PublicAvailableCargoDto {
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
 * Public Application Facade exposed by the Warehouse Bounded Context.
 * Other bounded contexts (such as Delivery) interact with Warehouse ONLY through
 * this application contract via their own Anti-Corruption Layer adapter.
 */
export interface WarehousePublicFacade {
  listAvailableCargo(ctx?: ExecutionContext): Promise<PublicAvailableCargoDto[]>
  allocateCargoForShipment(
    input: AllocateCargoForShipmentInput,
    ctx?: ExecutionContext,
  ): Promise<AllocateCargoForShipmentOutput>
  returnCargoToWarehouse(
    input: ReturnCargoToWarehouseInput,
    ctx?: ExecutionContext,
  ): Promise<ReturnCargoToWarehouseOutput>
}

export function createWarehousePublicFacade(deps: {
  listBins: UseCase<ListWarehouseBinsInput, WarehouseBinView[]>
  allocateCargo: UseCase<AllocateCargoForShipmentInput, AllocateCargoForShipmentOutput>
  returnCargo: UseCase<ReturnCargoToWarehouseInput, ReturnCargoToWarehouseOutput>
}): WarehousePublicFacade {
  return {
    async listAvailableCargo(ctx?: ExecutionContext): Promise<PublicAvailableCargoDto[]> {
      const bins = await deps.listBins.execute({}, ctx)
      const available: PublicAvailableCargoDto[] = []
      for (const bin of bins) {
        for (const cargo of bin.storedCargo) {
          if (cargo.status === 'AVAILABLE') {
            available.push({
              binId: bin.id,
              binCode: bin.code,
              cargoId: cargo.cargoId,
              cargoKind: cargo.kind,
              sku: cargo.sku,
              label: cargo.label,
              handlingClass: cargo.handlingClass,
              weightKg: cargo.weightKg,
              volumeM3: cargo.volumeM3,
              itemCount: cargo.itemCount,
            })
          }
        }
      }
      return available
    },

    allocateCargoForShipment(input, ctx) {
      return deps.allocateCargo.execute(input, ctx)
    },

    returnCargoToWarehouse(input, ctx) {
      return deps.returnCargo.execute(input, ctx)
    },
  }
}
