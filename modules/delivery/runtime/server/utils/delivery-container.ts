import { useHexagonalKernel } from '../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import { useWarehousePublicFacade } from '../../../../warehouse/runtime/server/utils/warehouse-container'
import { LocalWarehouseStockAdapter } from '../../../core/infrastructure/acl/local-warehouse-stock.adapter'
import { createDeliveryContainer } from '../../../core/infrastructure/di/container'
import type { DeliveryContainer } from '../../../core/infrastructure/di/container'

let deliveryInstance: DeliveryContainer | null = null

export async function useDeliveryModule(): Promise<DeliveryContainer> {
  if (!deliveryInstance) {
    const kernel = useHexagonalKernel()
    const warehouseStockPort = new LocalWarehouseStockAdapter(useWarehousePublicFacade)

    deliveryInstance = createDeliveryContainer({
      persistenceMode: kernel.config.persistence,
      carrierMode: kernel.config.carrier,
      sqliteDriver: kernel.sqliteDriver,
      warehouseStockPort,
      eventBus: kernel.eventBus,
      auditLog: kernel.auditLog,
      clock: kernel.clock,
      traceCollector: kernel.traceCollector,
      faultState: kernel.faultState,
      seed: true,
    })

    kernel.registerModule({
      name: 'delivery',
      boundedContext: 'TMS (Dispatch)',
      description:
        'Shipment state machine, CarrierStrategy quotes, DeliveryExceptionChain, and SLA tracking.',
      persistenceAdapter: deliveryInstance.adapterName,
      endpointsPrefix: '/api/deliveries/*',
      pagePath: '/deliveries',
    })
  }

  await deliveryInstance.ready
  return deliveryInstance
}

export function resetDeliveryModule(): void {
  deliveryInstance?.dispose()
  deliveryInstance = null
}
