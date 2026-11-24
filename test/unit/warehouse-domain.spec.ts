import { describe, expect, it } from 'vitest'
import { InProcessEventBusAdapter, VirtualClockAdapter } from '../../modules/hexagonal-kernel/core/infrastructure'
import {
  AllocateCargoForShipmentUseCase,
  ReceiveAndStoreCargoUseCase,
} from '../../modules/warehouse/core/application'
import {
  BinCapacityExceededError,
  CargoAlreadyAllocatedError,
  CargoNotFoundInBinError,
  IncompatibleStorageZoneError,
  Pallet,
  Weight,
} from '../../modules/warehouse/core/domain'
import { InMemoryWarehouseBinRepository } from '../../modules/warehouse/core/infrastructure'
import { createSamplePallet, ParcelBuilder, WarehouseBinBuilder } from '../helpers/builders'

describe('Warehouse Bounded Context — Pure Domain & Use Cases', () => {
  const fixedNow = new Date('2026-11-24T12:00:00.000Z')

  it('computes Composite Pallet weight, volume, and strictest HandlingClass recursively', () => {
    const pallet = createSamplePallet('plt-composite-1')
    // 10kg tare + 20kg + 15kg = 45kg
    expect(pallet.getWeight().kilograms).toBe(45)
    // (60*50*40 + 50*40*30) cm3 = 180,000 cm3 = 0.18 m3
    expect(pallet.getVolume().cubicMeters).toBe(0.18)
    // 1 HAZMAT parcel elevates entire pallet to HAZMAT
    expect(pallet.getHandlingClass()).toBe('HAZMAT')
    expect(pallet.getItemCount()).toBe(2)

    // Nested pallet inside pallet
    const outerPallet = Pallet.create({
      id: 'plt-outer',
      sku: 'PLT-OUTER',
      label: 'Double Stacked Pallet',
      tareWeight: Weight.fromKilograms(5),
      children: [pallet, new ParcelBuilder().withWeightKg(5).withHandlingClass('FRAGILE').build()],
    })
    expect(outerPallet.getWeight().kilograms).toBe(55)
    expect(outerPallet.getHandlingClass()).toBe('HAZMAT')
    expect(outerPallet.getItemCount()).toBe(3)
  })

  it('enforces StorageAllocationChain: rejects COLD_CHAIN and HAZMAT in AMBIENT bins', () => {
    const ambientBin = new WarehouseBinBuilder().withCode('BAY-A01').withZone('AMBIENT').build()
    const coldParcel = new ParcelBuilder().withHandlingClass('COLD_CHAIN').build()
    const hazmatPallet = createSamplePallet()

    expect(() => ambientBin.storeCargo(coldParcel, fixedNow)).toThrowError(IncompatibleStorageZoneError)
    expect(() => ambientBin.storeCargo(hazmatPallet, fixedNow)).toThrowError(IncompatibleStorageZoneError)
  })

  it('enforces weight and volume capacity limits on WarehouseBin', () => {
    const smallBin = new WarehouseBinBuilder()
      .withCode('BAY-SMALL')
      .withZone('AMBIENT')
      .withCapacity(50, 0.2)
      .build()

    const tooHeavy = new ParcelBuilder().withWeightKg(60).withDimensionsCm(20, 20, 20).build()
    expect(() => smallBin.storeCargo(tooHeavy, fixedNow)).toThrowError(BinCapacityExceededError)

    const tooBulky = new ParcelBuilder().withWeightKg(10).withDimensionsCm(100, 100, 30).build()
    expect(() => smallBin.storeCargo(tooBulky, fixedNow)).toThrowError(BinCapacityExceededError)
  })

  it('emits CargoStoredInBin and BinThresholdReached when crossing >= 85% capacity', () => {
    const bin = new WarehouseBinBuilder()
      .withCode('BAY-CAP')
      .withZone('AMBIENT')
      .withCapacity(100, 5.0)
      .build()

    const heavyParcel = new ParcelBuilder().withWeightKg(90).withDimensionsCm(40, 40, 40).build()
    bin.storeCargo(heavyParcel, fixedNow)

    const events = bin.pullDomainEvents()
    expect(events.map(e => e.eventName)).toEqual(['CargoStoredInBin', 'BinThresholdReached'])
    expect(bin.utilizationPercent).toBe(90)
  })

  it('prevents double-allocation and rejects missing cargo allocations', () => {
    const parcel = new ParcelBuilder().withId('cargo-alloc-1').build()
    const bin = new WarehouseBinBuilder().withCargo(parcel).build()

    bin.allocateCargo('cargo-alloc-1', 'shp-1', fixedNow)
    expect(() => bin.allocateCargo('cargo-alloc-1', 'shp-2', fixedNow)).toThrowError(CargoAlreadyAllocatedError)
    expect(() => bin.allocateCargo('missing-id', 'shp-2', fixedNow)).toThrowError(CargoNotFoundInBinError)
  })

  it('executes ReceiveAndStoreCargoUseCase and AllocateCargoForShipmentUseCase with pure InMemory adapters', async () => {
    const repo = new InMemoryWarehouseBinRepository()
    const eventBus = new InProcessEventBusAdapter()
    const clock = new VirtualClockAdapter(fixedNow)

    const bin = new WarehouseBinBuilder().withId('bin-cold-1').withCode('BAY-C01').withZone('COLD_CHAIN').build()
    await repo.save(bin)

    const receiveUc = new ReceiveAndStoreCargoUseCase(repo, eventBus, clock)
    const stored = await receiveUc.execute({
      binId: 'bin-cold-1',
      kind: 'PARCEL',
      sku: 'SKU-VAX-01',
      label: 'Thermal Vaccine Pack',
      parcel: {
        sku: 'SKU-VAX-01',
        label: 'Thermal Vaccine Pack',
        weightKg: 15,
        lengthCm: 50,
        widthCm: 40,
        heightCm: 30,
        handlingClass: 'COLD_CHAIN',
      },
    })

    expect(stored.bin.cargoCount).toBe(1)

    const allocateUc = new AllocateCargoForShipmentUseCase(repo, eventBus, clock)
    const allocated = await allocateUc.execute({
      cargoId: stored.storedCargoId,
      shipmentId: 'shp-test-1',
    })

    expect(allocated.binCode).toBe('BAY-C01')
    expect(allocated.handlingClass).toBe('COLD_CHAIN')
    expect(eventBus.getPublishedEvents().map(e => e.eventName)).toContain('CargoAllocated')
  })
})
