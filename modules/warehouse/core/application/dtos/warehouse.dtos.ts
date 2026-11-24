import type { HandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'
import type { CargoUnitSnapshot, WarehouseBin } from '../../domain'
import type { StoredCargoStatus } from '../../domain/entities/warehouse-bin'
import type { StorageZone } from '../../domain/value-objects/storage-zone'

export interface StoredCargoView {
  readonly cargoId: string
  readonly kind: 'PARCEL' | 'PALLET'
  readonly sku: string
  readonly label: string
  readonly handlingClass: HandlingClass
  readonly weightKg: number
  readonly volumeM3: number
  readonly itemCount: number
  readonly status: StoredCargoStatus
  readonly allocatedShipmentId: string | null
  readonly storedAt: string
  readonly snapshot: CargoUnitSnapshot
}

export interface WarehouseBinView {
  readonly id: string
  readonly code: string
  readonly zone: StorageZone
  readonly maxWeightKg: number
  readonly usedWeightKg: number
  readonly weightUtilizationPercent: number
  readonly maxVolumeM3: number
  readonly usedVolumeM3: number
  readonly volumeUtilizationPercent: number
  readonly utilizationPercent: number
  readonly cargoCount: number
  readonly storedCargo: StoredCargoView[]
}

export interface ZoneUtilizationView {
  readonly zone: StorageZone
  readonly binCount: number
  readonly usedWeightKg: number
  readonly maxWeightKg: number
  readonly usedVolumeM3: number
  readonly maxVolumeM3: number
  readonly utilizationPercent: number
  readonly availableCargoCount: number
  readonly allocatedCargoCount: number
}

export interface WarehouseUtilizationView {
  readonly totalBins: number
  readonly totalCargoUnits: number
  readonly availableCargoUnits: number
  readonly allocatedCargoUnits: number
  readonly overallUtilizationPercent: number
  readonly binsNearCapacity: number
  readonly byZone: ZoneUtilizationView[]
}

export function mapWarehouseBinToView(bin: WarehouseBin): WarehouseBinView {
  return {
    id: bin.id,
    code: bin.code,
    zone: bin.zone,
    maxWeightKg: bin.maxWeight.kilograms,
    usedWeightKg: bin.usedWeight.kilograms,
    weightUtilizationPercent: bin.weightUtilizationPercent,
    maxVolumeM3: bin.maxVolume.cubicMeters,
    usedVolumeM3: bin.usedVolume.cubicMeters,
    volumeUtilizationPercent: bin.volumeUtilizationPercent,
    utilizationPercent: bin.utilizationPercent,
    cargoCount: bin.storedEntries.length,
    storedCargo: bin.storedEntries.map(entry => ({
      cargoId: entry.unit.id,
      kind: entry.unit.kind,
      sku: entry.unit.sku,
      label: entry.unit.label,
      handlingClass: entry.unit.getHandlingClass(),
      weightKg: entry.unit.getWeight().kilograms,
      volumeM3: entry.unit.getVolume().cubicMeters,
      itemCount: entry.unit.getItemCount(),
      status: entry.status,
      allocatedShipmentId: entry.allocatedShipmentId,
      storedAt: entry.storedAt,
      snapshot: entry.unit.toSnapshot(),
    })),
  }
}
