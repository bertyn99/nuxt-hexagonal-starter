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

  // 1. Primary Ambient Bay (moderate load, keeps room for E2E & manual demo cargo)
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
  bayA01.storeCargo(
    Parcel.create({
      id: 'cargo-opt-02',
      sku: 'SKU-LID-32',
      label: 'Solid-State Lidar Rig',
      weight: Weight.fromKilograms(16.0),
      dimensions: Dimensions.fromCentimeters(60, 45, 35),
      handlingClass: 'FRAGILE',
    }),
    now,
  )
  bayA01.storeCargo(
    Parcel.create({
      id: 'cargo-hist-04',
      sku: 'SKU-AVN-18',
      label: 'Avionics Flight Telemetry Unit',
      weight: Weight.fromKilograms(11.8),
      dimensions: Dimensions.fromCentimeters(48, 36, 38),
      handlingClass: 'FRAGILE',
    }),
    now,
  )
  bayA01.allocateCargo('cargo-hist-04', 'shp-demo-pnd-04', now)
  bayA01.pullDomainEvents()

  // 2. Heavy Ambient Bay (~87% weight utilization -> showcases Near Capacity warning)
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
  bayA02.storeCargo(
    Pallet.create({
      id: 'cargo-plt-02',
      sku: 'PLT-IND-400',
      label: 'Industrial Drive & Servo Pallet',
      tareWeight: Weight.fromKilograms(18),
      children: [
        Parcel.create({
          id: 'cargo-plt-02-a',
          sku: 'SKU-ACT-09',
          label: 'Brushless Servo Actuators (x8)',
          weight: Weight.fromKilograms(94),
          dimensions: Dimensions.fromCentimeters(100, 75, 55),
          handlingClass: 'STANDARD',
        }),
        Parcel.create({
          id: 'cargo-plt-02-b',
          sku: 'SKU-PLC-04',
          label: 'DIN-Rail PLC Controller Rack',
          weight: Weight.fromKilograms(68),
          dimensions: Dimensions.fromCentimeters(90, 70, 45),
          handlingClass: 'FRAGILE',
        }),
        Parcel.create({
          id: 'cargo-plt-02-c',
          sku: 'SKU-HAR-77',
          label: 'Shielded Busbar Harnesses',
          weight: Weight.fromKilograms(52),
          dimensions: Dimensions.fromCentimeters(85, 60, 40),
          handlingClass: 'STANDARD',
        }),
      ],
    }),
    now,
  )
  bayA02.storeCargo(
    Parcel.create({
      id: 'cargo-pdu-03',
      sku: 'SKU-PDU-20',
      label: 'High-Density 3-Phase Rack PDU',
      weight: Weight.fromKilograms(31),
      dimensions: Dimensions.fromCentimeters(120, 35, 25),
      handlingClass: 'STANDARD',
    }),
    now,
  )
  bayA02.storeCargo(
    Parcel.create({
      id: 'cargo-hist-05',
      sku: 'SKU-ROB-08',
      label: '6-Axis Robotic Wrist Actuator',
      weight: Weight.fromKilograms(28.0),
      dimensions: Dimensions.fromCentimeters(65, 58, 50),
      handlingClass: 'STANDARD',
    }),
    now,
  )
  bayA02.allocateCargo('cargo-hist-05', 'shp-demo-att-05', now)
  bayA02.pullDomainEvents()

  // 3. Ambient Overflow Bay (empty -> showcases clean empty-bin state & quick intake target)
  const bayA03 = WarehouseBin.create({
    id: 'bin-a03',
    code: 'BAY-A03',
    zone: 'AMBIENT',
    maxWeight: Weight.fromKilograms(250),
    maxVolume: Volume.fromCubicMeters(2.0),
  })
  bayA03.pullDomainEvents()

  // 4. Primary Cold-Chain Bay
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
  bayC01.storeCargo(
    Pallet.create({
      id: 'cargo-plt-03',
      sku: 'PLT-CRYO-88',
      label: 'Cryo Bioreactor Cold-Pack Pallet',
      tareWeight: Weight.fromKilograms(14),
      children: [
        Parcel.create({
          id: 'cargo-plt-03-a',
          sku: 'SKU-ENZ-11',
          label: 'Lyophilized Enzyme Vials',
          weight: Weight.fromKilograms(38),
          dimensions: Dimensions.fromCentimeters(80, 60, 50),
          handlingClass: 'COLD_CHAIN',
        }),
        Parcel.create({
          id: 'cargo-plt-03-b',
          sku: 'SKU-PCM-24',
          label: 'Phase-Change Gel Buffers',
          weight: Weight.fromKilograms(46),
          dimensions: Dimensions.fromCentimeters(80, 60, 40),
          handlingClass: 'STANDARD',
        }),
      ],
    }),
    now,
  )
  bayC01.pullDomainEvents()

  // 5. Secondary Cold-Chain Vault
  const bayC02 = WarehouseBin.create({
    id: 'bin-c02',
    code: 'BAY-C02',
    zone: 'COLD_CHAIN',
    maxWeight: Weight.fromKilograms(300),
    maxVolume: Volume.fromCubicMeters(2.5),
  })
  bayC02.storeCargo(
    Parcel.create({
      id: 'cargo-bio-03',
      sku: 'SKU-CRYO-07',
      label: 'Cryogenic Cell-Line Dewar',
      weight: Weight.fromKilograms(29.5),
      dimensions: Dimensions.fromCentimeters(65, 65, 75),
      handlingClass: 'COLD_CHAIN',
    }),
    now,
  )
  bayC02.storeCargo(
    Parcel.create({
      id: 'cargo-hist-06',
      sku: 'SKU-LAB-61',
      label: 'Cryo Tissue Assay Kit',
      weight: Weight.fromKilograms(8.6),
      dimensions: Dimensions.fromCentimeters(40, 36, 36),
      handlingClass: 'COLD_CHAIN',
    }),
    now,
  )
  bayC02.allocateCargo('cargo-hist-06', 'shp-demo-dsp-06', now)
  bayC02.pullDomainEvents()

  // 6. Hazmat Containment Bay
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
  bayH01.storeCargo(
    Parcel.create({
      id: 'cargo-haz-02',
      sku: 'SKU-GAS-CAL',
      label: 'Pressurized Calibration Gas Cylinders',
      weight: Weight.fromKilograms(54),
      dimensions: Dimensions.fromCentimeters(95, 45, 45),
      handlingClass: 'HAZMAT',
    }),
    now,
  )
  bayH01.pullDomainEvents()

  await Promise.all([
    binRepository.save(bayA01),
    binRepository.save(bayA02),
    binRepository.save(bayA03),
    binRepository.save(bayC01),
    binRepository.save(bayC02),
    binRepository.save(bayH01),
  ])
}
