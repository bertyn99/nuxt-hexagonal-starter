import type { ExecutionContext } from '../../../../hexagonal-kernel/core/application/use-case'
import type { WarehousePublicFacade } from '../../../../warehouse/core/application/warehouse-public.facade'
import type {
  AvailableWarehouseCargo,
  WarehouseStockPort,
} from '../../application/ports/outbound/warehouse-stock.port'

/**
 * Anti-Corruption Layer (ACL) Adapter.
 * Translates Warehouse's Public Application Facade into Delivery's own WarehouseStockPort.
 * Never touches warehouse/core/domain or warehouse/core/infrastructure.
 */
export class LocalWarehouseStockAdapter implements WarehouseStockPort {
  constructor(private readonly getWarehouseFacade: () => Promise<WarehousePublicFacade>) {}

  async listAvailableCargo(ctx?: ExecutionContext): Promise<AvailableWarehouseCargo[]> {
    const facade = await this.getWarehouseFacade()
    const items = await facade.listAvailableCargo(ctx)
    return items.map(item => ({
      binId: item.binId,
      binCode: item.binCode,
      cargoId: item.cargoId,
      cargoKind: item.cargoKind,
      sku: item.sku,
      label: item.label,
      handlingClass: item.handlingClass,
      weightKg: item.weightKg,
      volumeM3: item.volumeM3,
      itemCount: item.itemCount,
    }))
  }

  async allocateCargo(
    cargoId: string,
    shipmentId: string,
    ctx?: ExecutionContext,
  ): Promise<AvailableWarehouseCargo> {
    const facade = await this.getWarehouseFacade()
    const allocated = await facade.allocateCargoForShipment({ cargoId, shipmentId }, ctx)
    return {
      binId: allocated.binId,
      binCode: allocated.binCode,
      cargoId: allocated.cargoId,
      cargoKind: allocated.cargoKind,
      sku: allocated.sku,
      label: allocated.label,
      handlingClass: allocated.handlingClass,
      weightKg: allocated.weightKg,
      volumeM3: allocated.volumeM3,
      itemCount: allocated.itemCount,
    }
  }

  async releaseCargo(cargoId: string, ctx?: ExecutionContext): Promise<void> {
    const facade = await this.getWarehouseFacade()
    await facade.returnCargoToWarehouse({ cargoId }, ctx)
  }
}
