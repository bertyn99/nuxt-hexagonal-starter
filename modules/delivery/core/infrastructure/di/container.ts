import { AuthorizingUseCaseDecorator } from '../../../../hexagonal-kernel/core/application/decorators/authorizing-use-case.decorator'
import type { AuthorizationPolicySpec } from '../../../../hexagonal-kernel/core/application/decorators/authorizing-use-case.decorator'
import { TracingUseCaseDecorator } from '../../../../hexagonal-kernel/core/application/decorators/tracing-use-case.decorator'
import type { AuditLogPort } from '../../../../hexagonal-kernel/core/application/ports/audit-log.port'
import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { TraceCollectorPort } from '../../../../hexagonal-kernel/core/application/ports/trace-collector.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import type { DrizzleSqliteDriver } from '../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type {
  CarrierAdapterMode,
  CarrierFaultStateDto,
  PersistenceMode,
} from '../../../../hexagonal-kernel/shared/types/inspector'
import {
  canCreateShipment,
  canEvaluateDeliverySlas,
  canManageShipmentLifecycle,
} from '../../domain/policies/delivery-access.policy'
import {
  AdvanceShipmentTransitUseCase,
  CancelShipmentUseCase,
  CreateShipmentFromWarehouseUseCase,
  DispatchShipmentUseCase,
  EvaluateDeliverySlasUseCase,
  GetShipmentTimelineQuery,
  ListShipmentsQuery,
  MarkShipmentDeliveredUseCase,
  QuoteShipmentQuery,
  RecordDeliveryAttemptFailureUseCase,
} from '../../application'
import type {
  AdvanceShipmentTransitInput,
  CancelShipmentInput,
  CarrierGatewayPort,
  CreateShipmentFromWarehouseInput,
  DeliveryQuoteView,
  DispatchShipmentInput,
  GetShipmentTimelineInput,
  MarkShipmentDeliveredInput,
  QuoteShipmentInput,
  RecordDeliveryAttemptFailureInput,
  RecordDeliveryAttemptFailureOutput,
  ShipmentFilter,
  ShipmentRepositoryPort,
  ShipmentTimelineView,
  ShipmentView,
  SlaEvaluationView,
  WarehouseStockPort,
} from '../../application'
import { SimulatedCarrierGatewayAdapter } from '../carrier/simulated-carrier-gateway.adapter'
import { WebhookConsoleCarrierGatewayAdapter } from '../carrier/webhook-console-carrier-gateway.adapter'
import { registerCarrierWebhookSubscriber } from '../subscribers/carrier-webhook.subscriber'
import type { CarrierWebhookDeliveryLog } from '../subscribers/carrier-webhook.subscriber'
import { seedShipmentsIfEmpty } from './delivery-seed'
import { selectDeliveryPersistenceFactory } from './persistence-adapter.factory'

export interface DeliveryContainer {
  readonly adapterName: string
  readonly carrierAdapterName: string
  readonly shipmentRepository: ShipmentRepositoryPort
  readonly warehouseStockPort: WarehouseStockPort
  readonly webhookLogs: CarrierWebhookDeliveryLog[]
  readonly quoteShipment: UseCase<QuoteShipmentInput, DeliveryQuoteView>
  readonly createShipmentFromWarehouse: UseCase<CreateShipmentFromWarehouseInput, ShipmentView>
  readonly dispatchShipment: UseCase<DispatchShipmentInput, ShipmentView>
  readonly advanceTransit: UseCase<AdvanceShipmentTransitInput, ShipmentView>
  readonly markDelivered: UseCase<MarkShipmentDeliveredInput, ShipmentView>
  readonly recordAttemptFailure: UseCase<
    RecordDeliveryAttemptFailureInput,
    RecordDeliveryAttemptFailureOutput
  >
  readonly cancelShipment: UseCase<CancelShipmentInput, ShipmentView>
  readonly evaluateSlas: UseCase<void, SlaEvaluationView>
  readonly listShipments: UseCase<ShipmentFilter | undefined, ShipmentView[]>
  readonly getTimeline: UseCase<GetShipmentTimelineInput, ShipmentTimelineView>
  readonly ready: Promise<void>
  dispose(): void
}

export function createDeliveryContainer(deps: {
  persistenceMode: PersistenceMode
  carrierMode: CarrierAdapterMode
  sqliteDriver: DrizzleSqliteDriver | null
  warehouseStockPort: WarehouseStockPort
  eventBus: EventBusPort
  auditLog: AuditLogPort
  clock: ClockPort
  traceCollector: TraceCollectorPort
  faultState?: CarrierFaultStateDto
  seed?: boolean
}): DeliveryContainer {
  const persistenceFactory = selectDeliveryPersistenceFactory(
    deps.persistenceMode,
    deps.sqliteDriver,
  )
  const { adapterName, shipmentRepository } = persistenceFactory.create()

  const carrierGateway: CarrierGatewayPort =
    deps.carrierMode === 'webhook-console'
      ? new WebhookConsoleCarrierGatewayAdapter()
      : new SimulatedCarrierGatewayAdapter(deps.faultState)

  const webhookLogs: CarrierWebhookDeliveryLog[] = []
  const unsubWebhook = registerCarrierWebhookSubscriber(deps.eventBus, webhookLogs)

  const wrap = <TIn, TOut>(
    useCase: UseCase<TIn, TOut>,
    drivingAdapter: string,
    domainComponent: string,
    drivenAdapter = adapterName,
    authPolicy?: AuthorizationPolicySpec<TIn>,
  ): UseCase<TIn, TOut> => {
    const guarded = authPolicy ? new AuthorizingUseCaseDecorator(useCase, authPolicy) : useCase
    return new TracingUseCaseDecorator(guarded, deps.traceCollector, deps.clock, deps.eventBus, {
      drivingAdapter,
      domainComponent,
      drivenAdapter,
      authorized: Boolean(authPolicy),
    })
  }

  const quoteShipment = wrap(
    new QuoteShipmentQuery(deps.clock),
    'POST /api/deliveries/quote',
    'CarrierStrategy (Strategy Pattern)',
    'Pure Domain Policy (no I/O)',
  )

  const createShipmentFromWarehouse = wrap(
    new CreateShipmentFromWarehouseUseCase(
      shipmentRepository,
      deps.warehouseStockPort,
      deps.eventBus,
      deps.clock,
    ),
    'POST /api/deliveries',
    'Shipment.create() + CarrierStrategy',
    `${adapterName} + LocalWarehouseStockAdapter (ACL)`,
    {
      policyName: 'delivery:shipment:create',
      requiredRolesDescription: 'dispatcher or admin',
      check: actor => canCreateShipment(actor),
    },
  )

  const dispatchShipment = wrap(
    new DispatchShipmentUseCase(shipmentRepository, carrierGateway, deps.eventBus, deps.clock),
    'POST /api/deliveries/:id/dispatch',
    'ShipmentState: PendingDispatch -> Dispatched',
    `${adapterName} + ${carrierGateway.adapterName}`,
    {
      policyName: 'delivery:shipment:dispatch',
      requiredRolesDescription: 'dispatcher or admin',
      check: actor => canManageShipmentLifecycle(actor),
    },
  )

  const advanceTransit = wrap(
    new AdvanceShipmentTransitUseCase(shipmentRepository, deps.eventBus, deps.clock),
    'POST /api/deliveries/:id/advance',
    'ShipmentState: Dispatched -> InTransit -> OutForDelivery',
    adapterName,
    {
      policyName: 'delivery:shipment:advance',
      requiredRolesDescription: 'dispatcher or admin',
      check: actor => canManageShipmentLifecycle(actor),
    },
  )

  const markDelivered = wrap(
    new MarkShipmentDeliveredUseCase(shipmentRepository, deps.eventBus, deps.clock),
    'POST /api/deliveries/:id/deliver',
    'ShipmentState: OutForDelivery -> Delivered',
    adapterName,
    {
      policyName: 'delivery:shipment:deliver',
      requiredRolesDescription: 'dispatcher or admin',
      check: actor => canManageShipmentLifecycle(actor),
    },
  )

  const recordAttemptFailure = wrap(
    new RecordDeliveryAttemptFailureUseCase(shipmentRepository, deps.eventBus, deps.clock),
    'POST /api/deliveries/:id/fail-attempt',
    'DeliveryExceptionChain (Chain of Responsibility)',
    adapterName,
    {
      policyName: 'delivery:shipment:fail-attempt',
      requiredRolesDescription: 'dispatcher or admin',
      check: actor => canManageShipmentLifecycle(actor),
    },
  )

  const cancelShipment = wrap(
    new CancelShipmentUseCase(shipmentRepository, deps.eventBus, deps.clock),
    'POST /api/deliveries/:id/cancel',
    'ShipmentState.cancel() Guard',
    adapterName,
    {
      policyName: 'delivery:shipment:cancel',
      requiredRolesDescription: 'dispatcher or admin',
      check: actor => canManageShipmentLifecycle(actor),
    },
  )

  const evaluateSlas = wrap(
    new EvaluateDeliverySlasUseCase(shipmentRepository, deps.eventBus, deps.clock),
    'POST /api/deliveries/evaluate-slas',
    'DeliveryWindow.isBreached(ClockPort)',
    adapterName,
    {
      policyName: 'delivery:sla:evaluate',
      requiredRolesDescription: 'dispatcher or admin',
      check: actor => canEvaluateDeliverySlas(actor),
    },
  )

  const listShipments = wrap(
    new ListShipmentsQuery(shipmentRepository, deps.clock),
    'GET /api/deliveries',
    'Shipment Read Model',
  )

  const getTimeline = wrap(
    new GetShipmentTimelineQuery(shipmentRepository, deps.auditLog, deps.clock),
    'GET /api/deliveries/:id/timeline',
    'AuditLog Domain Event Projection',
  )

  const ready =
    deps.seed === false
      ? Promise.resolve()
      : seedShipmentsIfEmpty(shipmentRepository, deps.eventBus, deps.clock)

  return {
    adapterName,
    carrierAdapterName: carrierGateway.adapterName,
    shipmentRepository,
    warehouseStockPort: deps.warehouseStockPort,
    webhookLogs,
    quoteShipment,
    createShipmentFromWarehouse,
    dispatchShipment,
    advanceTransit,
    markDelivered,
    recordAttemptFailure,
    cancelShipment,
    evaluateSlas,
    listShipments,
    getTimeline,
    ready,
    dispose() {
      unsubWebhook()
    },
  }
}
