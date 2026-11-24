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
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)
  const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000)
  const twentySixHoursAgo = new Date(now.getTime() - 26 * 60 * 60 * 1000)

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
    now: tenHoursAgo,
  })
  expressShipment.dispatch('AIR-00101', new Date(tenHoursAgo.getTime() + 60 * 60 * 1000))
  expressShipment.advanceTransit(new Date(tenHoursAgo.getTime() + 4 * 60 * 60 * 1000), 'Paris CDG Hub')
  expressShipment.advanceTransit(new Date(tenHoursAgo.getTime() + 8 * 60 * 60 * 1000), 'Lyon Courier Van #14')
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
    now: fourHoursAgo,
  })
  coldShipment.dispatch('CRYO-00202', new Date(fourHoursAgo.getTime() + 45 * 60 * 1000))
  coldShipment.advanceTransit(new Date(fourHoursAgo.getTime() + 2 * 60 * 60 * 1000), 'Alpine Thermal Relay')
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
    now: twentySixHoursAgo,
  })
  deliveredShipment.dispatch('GRD-00303', new Date(twentySixHoursAgo.getTime() + 2 * 60 * 60 * 1000))
  deliveredShipment.advanceTransit(new Date(twentySixHoursAgo.getTime() + 10 * 60 * 60 * 1000), 'Strasbourg Freight Terminal')
  deliveredShipment.advanceTransit(new Date(twentySixHoursAgo.getTime() + 20 * 60 * 60 * 1000), 'Stuttgart Final Mile')
  deliveredShipment.markDelivered(new Date(twentySixHoursAgo.getTime() + 23 * 60 * 60 * 1000), 'Signed by Dock Supervisor M. Weber')
  await shipmentRepository.save(deliveredShipment)
  await eventBus.publishAll(deliveredShipment.pullDomainEvents())
}
