import type { HandlingClass } from '../../modules/hexagonal-kernel/core/domain/handling-class'
import {
  Dimensions,
  Pallet,
  Parcel,
  Volume,
  WarehouseBin,
  Weight,
} from '../../modules/warehouse/core/domain'
import type { CargoUnit, StorageZone } from '../../modules/warehouse/core/domain'
import { Shipment, TrackingNumber } from '../../modules/delivery/core/domain'
import type { CargoSummary, CarrierMode } from '../../modules/delivery/core/domain'

let builderSeq = 0
function nextId(prefix: string): string {
  builderSeq += 1
  return `${prefix}-${builderSeq}`
}

/**
 * Builder Pattern (Test Fixture): readable, low-noise Parcel builder.
 */
export class ParcelBuilder {
  private id = nextId('prc')
  private sku = 'SKU-TEST-01'
  private label = 'Test Parcel'
  private weightKg = 10
  private lengthCm = 40
  private widthCm = 30
  private heightCm = 25
  private handlingClass: HandlingClass = 'STANDARD'

  withId(id: string): this {
    this.id = id
    return this
  }

  withSku(sku: string): this {
    this.sku = sku
    return this
  }

  withLabel(label: string): this {
    this.label = label
    return this
  }

  withWeightKg(weightKg: number): this {
    this.weightKg = weightKg
    return this
  }

  withDimensionsCm(lengthCm: number, widthCm: number, heightCm: number): this {
    this.lengthCm = lengthCm
    this.widthCm = widthCm
    this.heightCm = heightCm
    return this
  }

  withHandlingClass(handlingClass: HandlingClass): this {
    this.handlingClass = handlingClass
    return this
  }

  build(): Parcel {
    return Parcel.create({
      id: this.id,
      sku: this.sku,
      label: this.label,
      weight: Weight.fromKilograms(this.weightKg),
      dimensions: Dimensions.fromCentimeters(this.lengthCm, this.widthCm, this.heightCm),
      handlingClass: this.handlingClass,
    })
  }
}

/**
 * Builder Pattern (Test Fixture): readable WarehouseBin builder.
 */
export class WarehouseBinBuilder {
  private id = nextId('bin')
  private code = `BAY-T${builderSeq.toString().padStart(2, '0')}`
  private zone: StorageZone = 'AMBIENT'
  private maxWeightKg = 200
  private maxVolumeM3 = 2.0
  private initialCargo: CargoUnit[] = []
  private now = new Date('2026-11-24T10:00:00.000Z')

  withId(id: string): this {
    this.id = id
    return this
  }

  withCode(code: string): this {
    this.code = code
    return this
  }

  withZone(zone: StorageZone): this {
    this.zone = zone
    return this
  }

  withCapacity(maxWeightKg: number, maxVolumeM3: number): this {
    this.maxWeightKg = maxWeightKg
    this.maxVolumeM3 = maxVolumeM3
    return this
  }

  withCargo(unit: CargoUnit): this {
    this.initialCargo.push(unit)
    return this
  }

  build(): WarehouseBin {
    const bin = WarehouseBin.create({
      id: this.id,
      code: this.code,
      zone: this.zone,
      maxWeight: Weight.fromKilograms(this.maxWeightKg),
      maxVolume: Volume.fromCubicMeters(this.maxVolumeM3),
    })
    for (const unit of this.initialCargo) {
      bin.storeCargo(unit, this.now)
    }
    bin.pullDomainEvents()
    return bin
  }
}

/**
 * Builder Pattern (Test Fixture): readable Shipment builder.
 */
export class ShipmentBuilder {
  private id = nextId('shp')
  private originBinId = 'bin-a01'
  private originBinCode = 'BAY-A01'
  private destination = 'Paris Distribution Hub, FR'
  private carrierMode: CarrierMode = 'STANDARD_GROUND'
  private now = new Date('2026-11-24T10:00:00.000Z')
  private trackingNumber?: TrackingNumber
  private cargoSummary: CargoSummary = {
    cargoId: nextId('cargo'),
    cargoKind: 'PARCEL',
    sku: 'SKU-SHP-01',
    label: 'Test Shipment Cargo',
    handlingClass: 'STANDARD',
    weightKg: 12,
    volumeM3: 0.08,
    itemCount: 1,
  }

  withId(id: string): this {
    this.id = id
    return this
  }

  withTrackingNumber(raw: string): this {
    this.trackingNumber = TrackingNumber.create(raw)
    return this
  }

  withCarrierMode(mode: CarrierMode): this {
    this.carrierMode = mode
    return this
  }

  withHandlingClass(handlingClass: HandlingClass): this {
    this.cargoSummary = { ...this.cargoSummary, handlingClass }
    return this
  }

  withDestination(destination: string): this {
    this.destination = destination
    return this
  }

  withNow(now: Date): this {
    this.now = now
    return this
  }

  withCargoId(cargoId: string): this {
    this.cargoSummary = { ...this.cargoSummary, cargoId }
    return this
  }

  build(): Shipment {
    return Shipment.create({
      id: this.id,
      originBinId: this.originBinId,
      originBinCode: this.originBinCode,
      cargoSummary: this.cargoSummary,
      destination: this.destination,
      carrierMode: this.carrierMode,
      now: this.now,
      trackingNumber: this.trackingNumber,
    })
  }
}

export function createSamplePallet(id = nextId('plt')): Pallet {
  const leaf1 = new ParcelBuilder().withWeightKg(20).withDimensionsCm(60, 50, 40).withHandlingClass('STANDARD').build()
  const leaf2 = new ParcelBuilder().withWeightKg(15).withDimensionsCm(50, 40, 30).withHandlingClass('HAZMAT').build()
  return Pallet.create({
    id,
    sku: 'PLT-SAMPLE-01',
    label: 'Mixed Hazmat Pallet',
    tareWeight: Weight.fromKilograms(10),
    children: [leaf1, leaf2],
  })
}
