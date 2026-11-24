import { describe, expect, it } from 'vitest'
import {
  InMemoryAuditLogAdapter,
  InMemoryTraceCollectorAdapter,
  InProcessEventBusAdapter,
  VirtualClockAdapter,
} from '../../modules/hexagonal-kernel/core/infrastructure'
import {
  CannotCancelDispatchedShipmentError,
  CarrierHandlingNotSupportedError,
  InvalidStateTransitionError,
  Money,
  resolveCarrierStrategy,
  TrackingNumber,
} from '../../modules/delivery/core/domain'
import { EvaluateDeliverySlasUseCase } from '../../modules/delivery/core/application'
import {
  createDeliveryContainer,
  InMemoryShipmentRepository,
  LocalWarehouseStockAdapter,
} from '../../modules/delivery/core/infrastructure'
import { createWarehouseContainer } from '../../modules/warehouse/core/infrastructure'
import { ParcelBuilder, ShipmentBuilder, WarehouseBinBuilder } from '../helpers/builders'

describe('Delivery Bounded Context — State Machine, Strategies, Chains & ClockPort SLA', () => {
  const baseTime = new Date('2026-11-24T08:00:00.000Z')

  it('validates Money integer arithmetic and TrackingNumber format', () => {
    const a = Money.fromCents(1999, 'EUR')
    const b = Money.fromCents(501, 'EUR')
    expect(a.add(b).amountCents).toBe(2500)
    expect(a.add(b).format()).toBe('€25.00')

    expect(TrackingNumber.create('log-2026-abc123').value).toBe('LOG-2026-ABC123')
    expect(() => TrackingNumber.create('BAD-FORMAT')).toThrow()
  })

  it('enforces CarrierStrategy handling eligibility, pricing, and ETA', () => {
    const air = resolveCarrierStrategy('EXPRESS_AIR')
    const airQuote = air.quote({ weightKg: 10, volumeM3: 0.1, handlingClass: 'FRAGILE' })
    expect(airQuote.estimatedHours).toBe(12)
    expect(airQuote.cost.amountCents).toBeGreaterThan(0)

    // Express Air forbids HAZMAT & COLD_CHAIN
    expect(() => air.quote({ weightKg: 10, volumeM3: 0.1, handlingClass: 'HAZMAT' })).toThrowError(
      CarrierHandlingNotSupportedError,
    )
    expect(() =>
      air.quote({ weightKg: 10, volumeM3: 0.1, handlingClass: 'COLD_CHAIN' }),
    ).toThrowError(CarrierHandlingNotSupportedError)

    const cold = resolveCarrierStrategy('COLD_CHAIN_COURIER')
    expect(
      cold.quote({ weightKg: 10, volumeM3: 0.1, handlingClass: 'COLD_CHAIN' }).estimatedHours,
    ).toBe(18)
  })

  it('enforces Shipment State Machine transitions and forbids cancelling once Dispatched', () => {
    const shipment = new ShipmentBuilder().withNow(baseTime).build()
    expect(shipment.state).toBe('PendingDispatch')

    // Cannot deliver directly from PendingDispatch
    expect(() => shipment.markDelivered(baseTime)).toThrowError(InvalidStateTransitionError)

    shipment.dispatch('GRD-001', baseTime)
    expect(shipment.state).toBe('Dispatched')

    // Cancelling after dispatch MUST throw CannotCancelDispatchedShipmentError
    expect(() => shipment.cancel('Changed mind', baseTime)).toThrowError(
      CannotCancelDispatchedShipmentError,
    )

    expect(shipment.advanceTransit(baseTime)).toBe('InTransit')
    expect(shipment.advanceTransit(baseTime)).toBe('OutForDelivery')
    shipment.markDelivered(baseTime, 'Signed')
    expect(shipment.state).toBe('Delivered')
    expect(shipment.isTerminal).toBe(true)
  })

  it('executes DeliveryExceptionChain across 3 failed attempts -> ReturnedToWarehouse', () => {
    const shipment = new ShipmentBuilder().withNow(baseTime).build()
    shipment.dispatch('GRD-002', baseTime)
    shipment.advanceTransit(baseTime) // InTransit
    shipment.advanceTransit(baseTime) // OutForDelivery
    shipment.pullDomainEvents()

    const r1 = shipment.recordFailedAttempt('Gate locked', baseTime)
    expect(r1.action).toBe('SCHEDULE_NEXT_DAY_RETRY')
    expect(shipment.state).toBe('DeliveryAttemptFailed')

    const r2 = shipment.recordFailedAttempt('No receiver', baseTime)
    expect(r2.action).toBe('HOLD_AT_LOCAL_HUB')
    expect(shipment.state).toBe('DeliveryAttemptFailed')

    const r3 = shipment.recordFailedAttempt('Address refused', baseTime)
    expect(r3.action).toBe('RETURN_TO_WAREHOUSE')
    expect(r3.shouldReturnToWarehouse).toBe(true)
    expect(shipment.state).toBe('ReturnedToWarehouse')

    const events = shipment.pullDomainEvents().map(e => e.eventName)
    expect(events).toContain('DeliveryAttemptFailed')
    expect(events).toContain('ShipmentReturnedToWarehouse')
  })

  it('detects SLA breaches deterministically when VirtualClock advances past DeliveryWindow', async () => {
    const repo = new InMemoryShipmentRepository()
    const eventBus = new InProcessEventBusAdapter()
    const clock = new VirtualClockAdapter(baseTime)

    // Express Air has 12h SLA
    const shipment = new ShipmentBuilder()
      .withCarrierMode('EXPRESS_AIR')
      .withNow(clock.now())
      .build()
    shipment.dispatch('AIR-777', clock.now())
    shipment.pullDomainEvents()
    await repo.save(shipment)

    const evalUc = new EvaluateDeliverySlasUseCase(repo, eventBus, clock)

    // +6h: still within 12h SLA
    clock.advanceByHours(6)
    const firstEval = await evalUc.execute()
    expect(firstEval.newlyBreachedCount).toBe(0)

    // +8h more (total +14h): breaches 12h SLA!
    clock.advanceByHours(8)
    const secondEval = await evalUc.execute()
    expect(secondEval.newlyBreachedCount).toBe(1)
    expect(secondEval.breachedTrackingNumbers).toContain(shipment.trackingNumber.value)
    expect(eventBus.getPublishedEvents().map(e => e.eventName)).toContain('DeliverySlaBreached')
  })

  it('orchestrates cross-context ACL allocation and event-driven return-to-warehouse restocking', async () => {
    const eventBus = new InProcessEventBusAdapter()
    const auditLog = new InMemoryAuditLogAdapter()
    const clock = new VirtualClockAdapter(baseTime)
    const traceCollector = new InMemoryTraceCollectorAdapter()

    const warehouse = createWarehouseContainer({
      persistenceMode: 'in-memory',
      sqliteDriver: null,
      eventBus,
      clock,
      traceCollector,
      seed: false,
    })

    const parcel = new ParcelBuilder().withId('cargo-cross-1').withHandlingClass('STANDARD').build()
    const bin = new WarehouseBinBuilder()
      .withId('bin-x1')
      .withCode('BAY-X01')
      .withCargo(parcel)
      .build()
    await warehouse.binRepository.save(bin)

    const delivery = createDeliveryContainer({
      persistenceMode: 'in-memory',
      carrierMode: 'simulated',
      sqliteDriver: null,
      warehouseStockPort: new LocalWarehouseStockAdapter(async () => warehouse.publicFacade),
      eventBus,
      auditLog,
      clock,
      traceCollector,
      seed: false,
    })

    // 1. Delivery allocates cargo from Warehouse via ACL
    const created = await delivery.createShipmentFromWarehouse.execute({
      cargoId: 'cargo-cross-1',
      destination: 'Brussels Logistics Hub, BE',
      carrierMode: 'STANDARD_GROUND',
    })

    const binAfterAlloc = await warehouse.binRepository.findById('bin-x1')
    expect(binAfterAlloc?.findCargo('cargo-cross-1')?.status).toBe('ALLOCATED')

    // 2. Dispatch -> InTransit -> OutForDelivery -> 3 failed attempts -> ReturnedToWarehouse event
    await delivery.dispatchShipment.execute({ shipmentId: created.id })
    await delivery.advanceTransit.execute({ shipmentId: created.id })
    await delivery.advanceTransit.execute({ shipmentId: created.id })
    await delivery.recordAttemptFailure.execute({ shipmentId: created.id, reason: 'Attempt 1' })
    await delivery.recordAttemptFailure.execute({ shipmentId: created.id, reason: 'Attempt 2' })
    const finalFail = await delivery.recordAttemptFailure.execute({
      shipmentId: created.id,
      reason: 'Attempt 3',
    })

    expect(finalFail.shipment.state).toBe('ReturnedToWarehouse')

    // 3. Warehouse automatically reacted to ShipmentReturnedToWarehouse and restocked cargo!
    const binAfterReturn = await warehouse.binRepository.findById('bin-x1')
    expect(binAfterReturn?.findCargo('cargo-cross-1')?.status).toBe('AVAILABLE')

    warehouse.dispose()
    delivery.dispose()
  })
})
