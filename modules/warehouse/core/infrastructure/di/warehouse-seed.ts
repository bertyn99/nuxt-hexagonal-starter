import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { WarehouseBinRepositoryPort } from '../../application/ports/outbound/warehouse-bin-repository.port'
import { Dimensions, Pallet, Parcel, Volume, WarehouseBin, Weight } from '../../domain'

export async function seedWarehouseBinsIfEmpty(
  binRepository: WarehouseBinRepositoryPort,
  clock: ClockPort,
): Promise<void> {
  const existing = await binRepository.findAll()
  if (existing.length > 0) {
    return
  }

  const now = clock.now()

  const bayA01 = WarehouseBin.create({
    id: 'bin-a01',
    code: 'BAY-A01',
    zone: 'AMBIENT',
    maxWeight: Weight.fromKilograms(500),
    maxVolume: Volume.fromCubicMeters(4.0),
  })
  bayA01.storeCargo(
    Parcel.create({
      id: 'cargo-elec-01',
      sku: 'SKU-SRV-440',
      label: 'Rack Server Chassis (2U)',
      weight: Weight.fromKilograms(24.5),
      dimensions: Dimensions.fromCentimeters(75, 50, 18),
      handlingClass: 'FRAGILE',
    }),
    now,
  )
  bayA01.storeCargo(
    Pallet.create({
      id: 'cargo-plt-01',
      sku: 'PLT-RET-900',
      label: 'Retail Electronics Pallet',
      tareWeight: Weight.fromKilograms(15),
      children: [
        Parcel.create({
          id: 'cargo-plt-01-a',
          sku: 'SKU-MON-27',
          label: '27" Studio Monitors (x6)',
          weight: Weight.fromKilograms(48),
          dimensions: Dimensions.fromCentimeters(110, 80, 60),
          handlingClass: 'FRAGILE',
        }),
        Parcel.create({
          id: 'cargo-plt-01-b',
          sku: 'SKU-CAB-100',
          label: 'USB-C Dock Bulk Carton',
          weight: Weight.fromKilograms(32),
          dimensions: Dimensions.fromCentimeters(90, 60, 45),
          handlingClass: 'STANDARD',
        }),
      ],
    }),
    now,
  )
  bayA01.pullDomainEvents()

  const bayA02 = WarehouseBin.create({
    id: 'bin-a02',
    code: 'BAY-A02',
    zone: 'AMBIENT',
    maxWeight: Weight.fromKilograms(350),
    maxVolume: Volume.fromCubicMeters(3.0),
  })
  bayA02.storeCargo(
    Parcel.create({
      id: 'cargo-ind-02',
      sku: 'SKU-PMP-12',
      label: 'Hydraulic Valve Assembly',
      weight: Weight.fromKilograms(42),
      dimensions: Dimensions.fromCentimeters(65, 55, 40),
      handlingClass: 'STANDARD',
    }),
    now,
  )
  bayA02.pullDomainEvents()

  const bayC01 = WarehouseBin.create({
    id: 'bin-c01',
    code: 'BAY-C01',
    zone: 'COLD_CHAIN',
    maxWeight: Weight.fromKilograms(400),
    maxVolume: Volume.fromCubicMeters(3.5),
  })
  bayC01.storeCargo(
    Parcel.create({
      id: 'cargo-bio-01',
      sku: 'SKU-BIO-VAX',
      label: 'mRNA Biologics Thermal Crate (-20C)',
      weight: Weight.fromKilograms(18.5),
      dimensions: Dimensions.fromCentimeters(60, 45, 45),
      handlingClass: 'COLD_CHAIN',
    }),
    now,
  )
  bayC01.storeCargo(
    Parcel.create({
      id: 'cargo-bio-02',
      sku: 'SKU-BIO-DIAG',
      label: 'Clinical Diagnostic Reagents',
      weight: Weight.fromKilograms(12.0),
      dimensions: Dimensions.fromCentimeters(50, 40, 35),
      handlingClass: 'COLD_CHAIN',
    }),
    now,
  )
  bayC01.pullDomainEvents()

  const bayH01 = WarehouseBin.create({
    id: 'bin-h01',
    code: 'BAY-H01',
    zone: 'HAZMAT',
    maxWeight: Weight.fromKilograms(300),
    maxVolume: Volume.fromCubicMeters(2.5),
  })
  bayH01.storeCargo(
    Parcel.create({
      id: 'cargo-haz-01',
      sku: 'SKU-BAT-LI9',
      label: 'Class 9 Lithium-Ion Cell Pack',
      weight: Weight.fromKilograms(36),
      dimensions: Dimensions.fromCentimeters(70, 50, 40),
      handlingClass: 'HAZMAT',
    }),
    now,
  )
  bayH01.pullDomainEvents()

  await Promise.all([
    binRepository.save(bayA01),
    binRepository.save(bayA02),
    binRepository.save(bayC01),
    binRepository.save(bayH01),
  ])
}
