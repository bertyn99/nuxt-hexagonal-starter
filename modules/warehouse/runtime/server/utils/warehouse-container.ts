import { useHexagonalKernel } from '../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import type { WarehousePublicFacade } from '../../../core/application/warehouse-public.facade'
import { createWarehouseContainer } from '../../../core/infrastructure/di/container'
import type { WarehouseContainer } from '../../../core/infrastructure/di/container'

let warehouseInstance: WarehouseContainer | null = null

export async function useWarehouseModule(): Promise<WarehouseContainer> {
  if (!warehouseInstance) {
    const kernel = useHexagonalKernel()
    warehouseInstance = createWarehouseContainer({
      persistenceMode: kernel.config.persistence,
      sqliteDriver: kernel.sqliteDriver,
      eventBus: kernel.eventBus,
      clock: kernel.clock,
      traceCollector: kernel.traceCollector,
      seed: true,
    })

    kernel.registerModule({
      name: 'warehouse',
      boundedContext: 'WMS (Storage)',
      description:
        'Warehouse bins, composite Parcel/Pallet cargo units, and zone/capacity policies.',
      persistenceAdapter: warehouseInstance.adapterName,
      endpointsPrefix: '/api/warehouse/*',
      pagePath: '/warehouse',
    })
  }

  await warehouseInstance.ready
  return warehouseInstance
}

export async function useWarehousePublicFacade(): Promise<WarehousePublicFacade> {
  const mod = await useWarehouseModule()
  return mod.publicFacade
}

export function resetWarehouseModule(): void {
  warehouseInstance?.dispose()
  warehouseInstance = null
}
