import { useHexagonalKernel } from '../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import { registerDomainErrorGuidance } from '../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import type { WarehousePublicFacade } from '../../../core/application/warehouse-public.facade'
import { createWarehouseContainer } from '../../../core/infrastructure/di/container'
import type { WarehouseContainer } from '../../../core/infrastructure/di/container'

registerDomainErrorGuidance({
  INCOMPATIBLE_STORAGE_ZONE: {
    title: 'Storage zone incompatible with cargo handling class',
    fix: 'Choose a warehouse bin whose storage zone matches the cargo handling requirements.',
  },
  BIN_CAPACITY_EXCEEDED: {
    title: 'Warehouse bin capacity exceeded',
    fix: 'Select another bin with enough remaining weight/volume capacity or split the cargo.',
  },
  CARGO_NOT_FOUND_IN_BIN: {
    title: 'Cargo unit not found',
    fix: 'Verify the cargo ID and refresh the warehouse inventory.',
  },
  CARGO_ALREADY_ALLOCATED: {
    title: 'Cargo unit already allocated',
    fix: 'Choose an unallocated cargo unit or cancel the existing shipment first.',
  },
  WAREHOUSE_BIN_NOT_FOUND: {
    title: 'Warehouse bin not found',
    fix: 'Verify the bin ID against the current list of warehouse bins.',
  },
  DUPLICATE_CARGO_UNIT: {
    title: 'Duplicate cargo unit',
    fix: 'Use a unique cargo identifier or inspect the existing unit in the bin.',
  },
})

let warehouseInstance: WarehouseContainer | null = null

export function registerWarehouseModuleMetadata(adapterName?: string): void {
  const kernel = useHexagonalKernel()
  kernel.registerModule({
    name: 'warehouse',
    boundedContext: 'WMS (Storage)',
    description: 'Warehouse bins, composite Parcel/Pallet cargo units, and zone/capacity policies.',
    persistenceAdapter:
      adapterName ??
      (kernel.config.persistence === 'drizzle-sqlite'
        ? 'DrizzleSqliteWarehouseBinRepository'
        : 'InMemoryWarehouseBinRepository'),
    endpointsPrefix: '/api/warehouse/*',
    pagePath: '/warehouse',
  })
}

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

    registerWarehouseModuleMetadata(warehouseInstance.adapterName)
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
