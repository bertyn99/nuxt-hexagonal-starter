import { TracingUseCaseDecorator } from '../../../../hexagonal-kernel/core/application/decorators/tracing-use-case.decorator'
import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { TraceCollectorPort } from '../../../../hexagonal-kernel/core/application/ports/trace-collector.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import type { DrizzleSqliteDriver } from '../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type { PersistenceMode } from '../../../../hexagonal-kernel/shared/types/inspector'
import {
  AllocateCargoForShipmentUseCase,
  createWarehousePublicFacade,
  GetWarehouseUtilizationQuery,
  ListWarehouseBinsQuery,
  ReceiveAndStoreCargoUseCase,
  ReleaseCargoFromBinUseCase,
  ReturnCargoToWarehouseUseCase,
} from '../../application'
import type {
  AllocateCargoForShipmentInput,
  AllocateCargoForShipmentOutput,
  ListWarehouseBinsInput,
  ReceiveAndStoreCargoInput,
  ReceiveAndStoreCargoOutput,
  ReleaseCargoFromBinInput,
  ReleaseCargoFromBinOutput,
  ReturnCargoToWarehouseInput,
  ReturnCargoToWarehouseOutput,
  WarehouseBinRepositoryPort,
  WarehouseBinView,
  WarehousePublicFacade,
  WarehouseUtilizationView,
} from '../../application'
import { selectWarehousePersistenceFactory } from './persistence-adapter.factory'
import { seedWarehouseBinsIfEmpty } from './warehouse-seed'

export interface WarehouseContainer {
  readonly adapterName: string
  readonly binRepository: WarehouseBinRepositoryPort
  readonly receiveAndStoreCargo: UseCase<ReceiveAndStoreCargoInput, ReceiveAndStoreCargoOutput>
  readonly allocateCargoForShipment: UseCase<AllocateCargoForShipmentInput, AllocateCargoForShipmentOutput>
  readonly releaseCargoFromBin: UseCase<ReleaseCargoFromBinInput, ReleaseCargoFromBinOutput>
  readonly returnCargoToWarehouse: UseCase<ReturnCargoToWarehouseInput, ReturnCargoToWarehouseOutput>
  readonly listBins: UseCase<ListWarehouseBinsInput, WarehouseBinView[]>
  readonly getUtilization: UseCase<void, WarehouseUtilizationView>
  readonly publicFacade: WarehousePublicFacade
  readonly ready: Promise<void>
  dispose(): void
}

export function createWarehouseContainer(deps: {
  persistenceMode: PersistenceMode
  sqliteDriver: DrizzleSqliteDriver | null
  eventBus: EventBusPort
  clock: ClockPort
  traceCollector: TraceCollectorPort
  seed?: boolean
}): WarehouseContainer {
  const factory = selectWarehousePersistenceFactory(deps.persistenceMode, deps.sqliteDriver)
  const { adapterName, binRepository } = factory.create()

  const wrap = <TIn, TOut>(
    useCase: UseCase<TIn, TOut>,
    drivingAdapter: string,
    domainComponent: string,
  ): UseCase<TIn, TOut> => {
    return new TracingUseCaseDecorator(
      useCase,
      deps.traceCollector,
      deps.clock,
      deps.eventBus,
      {
        drivingAdapter,
        domainComponent,
        drivenAdapter: adapterName,
      },
    )
  }

  const receiveAndStoreCargo = wrap(
    new ReceiveAndStoreCargoUseCase(binRepository, deps.eventBus, deps.clock),
    'POST /api/warehouse/cargo',
    'WarehouseBin + StorageAllocationChain + CargoUnit',
  )

  const allocateCargoForShipment = wrap(
    new AllocateCargoForShipmentUseCase(binRepository, deps.eventBus, deps.clock),
    'ACL: WarehousePublicFacade.allocateCargoForShipment',
    'WarehouseBin.allocateCargo()',
  )

  const releaseCargoFromBin = wrap(
    new ReleaseCargoFromBinUseCase(binRepository, deps.eventBus, deps.clock),
    'POST /api/warehouse/cargo/:cargoId/release',
    'WarehouseBin.releaseCargo()',
  )

  const returnCargoToWarehouse = wrap(
    new ReturnCargoToWarehouseUseCase(binRepository, deps.eventBus, deps.clock),
    'EventSubscriber: ShipmentReturnedToWarehouse',
    'WarehouseBin.returnCargo()',
  )

  const listBins = wrap(
    new ListWarehouseBinsQuery(binRepository),
    'GET /api/warehouse/bins',
    'WarehouseBin Read Model',
  )

  const getUtilization = wrap(
    new GetWarehouseUtilizationQuery(binRepository),
    'GET /api/warehouse/utilization',
    'Warehouse Utilization Aggregator',
  )

  const publicFacade = createWarehousePublicFacade({
    listBins,
    allocateCargo: allocateCargoForShipment,
    returnCargo: returnCargoToWarehouse,
  })

  // Cross-context event subscription: return cargo to available stock when delivery fails after 3 attempts
  const unsubReturned = deps.eventBus.subscribe('ShipmentReturnedToWarehouse', async (event) => {
    const cargoId = event.payload.cargoId
    if (typeof cargoId === 'string' && cargoId.length > 0) {
      await returnCargoToWarehouse.execute({ cargoId })
    }
  })

  // Also release reservation if a pending shipment is cancelled
  const unsubCancelled = deps.eventBus.subscribe('ShipmentCancelled', async (event) => {
    const cargoId = event.payload.cargoId
    if (typeof cargoId === 'string' && cargoId.length > 0) {
      try {
        await returnCargoToWarehouse.execute({ cargoId })
      }
      catch {
        // Cargo may already have been released manually
      }
    }
  })

  const ready = deps.seed === false
    ? Promise.resolve()
    : seedWarehouseBinsIfEmpty(binRepository, deps.clock)

  return {
    adapterName,
    binRepository,
    receiveAndStoreCargo,
    allocateCargoForShipment,
    releaseCargoFromBin,
    returnCargoToWarehouse,
    listBins,
    getUtilization,
    publicFacade,
    ready,
    dispose() {
      unsubReturned()
      unsubCancelled()
    },
  }
}
