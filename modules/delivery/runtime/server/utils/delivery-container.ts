import { useHexagonalKernel } from '../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import { registerDomainErrorGuidance } from '../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useWarehousePublicFacade } from '../../../../warehouse/runtime/server/utils/warehouse-container'
import { LocalWarehouseStockAdapter } from '../../../core/infrastructure/acl/local-warehouse-stock.adapter'
import { createDeliveryContainer } from '../../../core/infrastructure/di/container'
import type { DeliveryContainer } from '../../../core/infrastructure/di/container'

registerDomainErrorGuidance({
  INVALID_STATE_TRANSITION: {
    title: 'Invalid shipment state transition',
    fix: 'Check the current shipment state and perform an allowed lifecycle transition.',
  },
  CANNOT_CANCEL_DISPATCHED_SHIPMENT: {
    title: 'Cannot cancel dispatched shipment',
    fix: 'Only shipments in PendingDispatch can be cancelled. Record a delivery exception instead.',
  },
  SHIPMENT_NOT_FOUND: {
    title: 'Shipment not found',
    fix: 'Verify the shipment ID and refresh the deliveries list.',
  },
  CARRIER_HANDLING_NOT_SUPPORTED: {
    title: 'Carrier does not support cargo handling class',
    fix: 'Select a carrier mode that supports this cargo handling class (e.g. COLD_CHAIN_COURIER for cold chain).',
  },
  CARRIER_GATEWAY_UNAVAILABLE: {
    title: 'Carrier gateway unavailable',
    fix: 'Disable simulated carrier outage in the Architecture Inspector or retry when the carrier recovers.',
  },
})

let deliveryInstance: DeliveryContainer | null = null

export function registerDeliveryModuleMetadata(adapterName?: string): void {
  const kernel = useHexagonalKernel()
  kernel.registerModule({
    name: 'delivery',
    boundedContext: 'TMS (Dispatch)',
    description:
      'Shipment state machine, CarrierStrategy quotes, DeliveryExceptionChain, and SLA tracking.',
    persistenceAdapter:
      adapterName ??
      (kernel.config.persistence === 'drizzle-sqlite'
        ? 'DrizzleSqliteShipmentRepository'
        : 'InMemoryShipmentRepository'),
    endpointsPrefix: '/api/deliveries/*',
    pagePath: '/deliveries',
  })
}

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

    registerDeliveryModuleMetadata(deliveryInstance.adapterName)
  }

  await deliveryInstance.ready
  return deliveryInstance
}

export function resetDeliveryModule(): void {
  deliveryInstance?.dispose()
  deliveryInstance = null
}
