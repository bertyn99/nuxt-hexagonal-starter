import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { ShipmentRepositoryPort } from '../../application/ports/outbound/shipment-repository.port'
import { Shipment, TrackingNumber } from '../../domain'

export async function seedShipmentsIfEmpty(
  shipmentRepository: ShipmentRepositoryPort,
  eventBus: EventBusPort,
  clock: ClockPort,
): Promise<void> {
  const existing = await shipmentRepository.findAll()
  if (existing.length > 0) {
    return
  }

  const now = clock.now()
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000)

  // 1. Express Air shipment currently OutForDelivery (close to 12h SLA -> great for Virtual Clock demo!)
  const expressShipment = Shipment.create({
    id: 'shp-demo-air-01',
    trackingNumber: TrackingNumber.create('LOG-2026-AIR101'),
    originBinId: 'bin-a01',
    originBinCode: 'BAY-A01',
    cargoSummary: {
      cargoId: 'cargo-hist-01',
      cargoKind: 'PARCEL',
      sku: 'SKU-OPT-99',
      label: 'Surgical Laser Calibration Kit',
      handlingClass: 'FRAGILE',
      weightKg: 9.4,
      volumeM3: 0.084,
      itemCount: 1,
    },
    destination: 'Lyon Medical Center, FR',
    carrierMode: 'EXPRESS_AIR',
    now: hoursAgo(10),
  })
  expressShipment.dispatch('AIR-00101', hoursAgo(9))
  expressShipment.advanceTransit(hoursAgo(6), 'Paris CDG Hub')
  expressShipment.advanceTransit(hoursAgo(2), 'Lyon Courier Van #14')
  await shipmentRepository.save(expressShipment)
  await eventBus.publishAll(expressShipment.pullDomainEvents())

  // 2. Cold Chain shipment InTransit
  const coldShipment = Shipment.create({
    id: 'shp-demo-cold-02',
    trackingNumber: TrackingNumber.create('LOG-2026-CLD202'),
    originBinId: 'bin-c01',
    originBinCode: 'BAY-C01',
    cargoSummary: {
      cargoId: 'cargo-hist-02',
      cargoKind: 'PARCEL',
      sku: 'SKU-BIO-44',
      label: 'Cryo-Stabilized Insulin Batch',
      handlingClass: 'COLD_CHAIN',
      weightKg: 14.2,
      volumeM3: 0.112,
      itemCount: 1,
    },
    destination: 'Geneva University Hospital, CH',
    carrierMode: 'COLD_CHAIN_COURIER',
    now: hoursAgo(4),
  })
  coldShipment.dispatch('CRYO-00202', hoursAgo(3.2))
  coldShipment.advanceTransit(hoursAgo(2), 'Alpine Thermal Relay')
  await shipmentRepository.save(coldShipment)
  await eventBus.publishAll(coldShipment.pullDomainEvents())

  // 3. Standard Ground shipment Delivered cleanly on-time
  const deliveredShipment = Shipment.create({
    id: 'shp-demo-grd-03',
    trackingNumber: TrackingNumber.create('LOG-2026-GRD303'),
    originBinId: 'bin-a02',
    originBinCode: 'BAY-A02',
    cargoSummary: {
      cargoId: 'cargo-hist-03',
      cargoKind: 'PALLET',
      sku: 'PLT-IND-55',
      label: 'CNC Spindle Spare Parts Pallet',
      handlingClass: 'STANDARD',
      weightKg: 112.5,
      volumeM3: 0.92,
      itemCount: 4,
    },
    destination: 'Stuttgart Assembly Plant, DE',
    carrierMode: 'STANDARD_GROUND',
    now: hoursAgo(26),
  })
  deliveredShipment.dispatch('GRD-00303', hoursAgo(24))
  deliveredShipment.advanceTransit(hoursAgo(16), 'Strasbourg Freight Terminal')
  deliveredShipment.advanceTransit(hoursAgo(6), 'Stuttgart Final Mile')
  deliveredShipment.markDelivered(hoursAgo(3), 'Signed by Dock Supervisor M. Weber')
  await shipmentRepository.save(deliveredShipment)
  await eventBus.publishAll(deliveredShipment.pullDomainEvents())

  // 4. PendingDispatch Express Air shipment (ready to test Dispatch or Cancel immediately)
  const pendingShipment = Shipment.create({
    id: 'shp-demo-pnd-04',
    trackingNumber: TrackingNumber.create('LOG-2026-PND404'),
    originBinId: 'bin-a01',
    originBinCode: 'BAY-A01',
    cargoSummary: {
      cargoId: 'cargo-hist-04',
      cargoKind: 'PARCEL',
      sku: 'SKU-AVN-18',
      label: 'Avionics Flight Telemetry Unit',
      handlingClass: 'FRAGILE',
      weightKg: 11.8,
      volumeM3: 0.065,
      itemCount: 1,
    },
    destination: 'Toulouse Aerospace Hangar B, FR',
    carrierMode: 'EXPRESS_AIR',
    now: hoursAgo(1.5),
  })
  await shipmentRepository.save(pendingShipment)
  await eventBus.publishAll(pendingShipment.pullDomainEvents())

  // 5. DeliveryAttemptFailed (2/3 attempts -> next Fail Attempt triggers DeliveryExceptionChain return!)
  const failedAttemptShipment = Shipment.create({
    id: 'shp-demo-att-05',
    trackingNumber: TrackingNumber.create('LOG-2026-ATT505'),
    originBinId: 'bin-a02',
    originBinCode: 'BAY-A02',
    cargoSummary: {
      cargoId: 'cargo-hist-05',
      cargoKind: 'PARCEL',
      sku: 'SKU-ROB-08',
      label: '6-Axis Robotic Wrist Actuator',
      handlingClass: 'STANDARD',
      weightKg: 28.0,
      volumeM3: 0.19,
      itemCount: 1,
    },
    destination: 'Rotterdam Port Gate 7, NL',
    carrierMode: 'STANDARD_GROUND',
    now: hoursAgo(18),
  })
  failedAttemptShipment.dispatch('GRD-00505', hoursAgo(16))
  failedAttemptShipment.advanceTransit(hoursAgo(11), 'Antwerp Cross-Dock')
  failedAttemptShipment.advanceTransit(hoursAgo(7), 'Rotterdam Courier #09')
  failedAttemptShipment.recordFailedAttempt('Customs gate locked after shift change', hoursAgo(5))
  failedAttemptShipment.recordFailedAttempt('Loading bay 7 blocked by crane maintenance', hoursAgo(2))
  await shipmentRepository.save(failedAttemptShipment)
  await eventBus.publishAll(failedAttemptShipment.pullDomainEvents())

  // 6. Dispatched Cold-Chain shipment awaiting linehaul transit
  const dispatchedColdShipment = Shipment.create({
    id: 'shp-demo-dsp-06',
    trackingNumber: TrackingNumber.create('LOG-2026-DSP606'),
    originBinId: 'bin-c02',
    originBinCode: 'BAY-C02',
    cargoSummary: {
      cargoId: 'cargo-hist-06',
      cargoKind: 'PARCEL',
      sku: 'SKU-LAB-61',
      label: 'Cryo Tissue Assay Kit',
      handlingClass: 'COLD_CHAIN',
      weightKg: 8.6,
      volumeM3: 0.052,
      itemCount: 1,
    },
    destination: 'Basel BioPharma Campus, CH',
    carrierMode: 'COLD_CHAIN_COURIER',
    now: hoursAgo(3),
  })
  dispatchedColdShipment.dispatch('CRYO-00606', hoursAgo(1))
  await shipmentRepository.save(dispatchedColdShipment)
  await eventBus.publishAll(dispatchedColdShipment.pullDomainEvents())

  // 7. Cancelled shipment (shows terminal cancellation history)
  const cancelledShipment = Shipment.create({
    id: 'shp-demo-can-07',
    trackingNumber: TrackingNumber.create('LOG-2026-CAN707'),
    originBinId: 'bin-a02',
    originBinCode: 'BAY-A02',
    cargoSummary: {
      cargoId: 'cargo-hist-07',
      cargoKind: 'PARCEL',
      sku: 'SKU-PNU-14',
      label: 'Pneumatic Manifold Spare Set',
      handlingClass: 'STANDARD',
      weightKg: 19.5,
      volumeM3: 0.14,
      itemCount: 1,
    },
    destination: 'Milan Precision Works, IT',
    carrierMode: 'STANDARD_GROUND',
    now: hoursAgo(8),
  })
  cancelledShipment.cancel('Order consolidated into scheduled weekly freight run', hoursAgo(7))
  await shipmentRepository.save(cancelledShipment)
  await eventBus.publishAll(cancelledShipment.pullDomainEvents())
}
