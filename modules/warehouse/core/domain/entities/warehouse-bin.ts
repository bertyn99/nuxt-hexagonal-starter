import { AggregateRoot } from '../../../../hexagonal-kernel/core/domain/aggregate-root'
import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import {
  CargoAlreadyAllocatedError,
  CargoNotFoundInBinError,
  DuplicateCargoUnitError,
} from '../errors/warehouse.errors'
import {
  createBinThresholdReachedEvent,
  createCargoAllocatedEvent,
  createCargoReleasedEvent,
  createCargoStoredInBinEvent,
} from '../events/warehouse.events'
import { createStorageAllocationChain } from '../policies/storage-allocation-chain'
import type { StorageAllocationHandler } from '../policies/storage-allocation-chain'
import { Volume } from '../value-objects/dimensions'
import { assertStorageZone } from '../value-objects/storage-zone'
import type { StorageZone } from '../value-objects/storage-zone'
import { Weight } from '../value-objects/weight'
import { rehydrateCargoUnit } from './cargo-unit'
import type { CargoUnit, CargoUnitSnapshot } from './cargo-unit'

export type StoredCargoStatus = 'AVAILABLE' | 'ALLOCATED'

export interface StoredCargoEntry {
  readonly unit: CargoUnit
  readonly status: StoredCargoStatus
  readonly allocatedShipmentId: string | null
  readonly storedAt: string
}

export interface StoredCargoEntrySnapshot {
  readonly unit: CargoUnitSnapshot
  readonly status: StoredCargoStatus
  readonly allocatedShipmentId: string | null
  readonly storedAt: string
}

export interface WarehouseBinProps {
  readonly id: string
  readonly code: string
  readonly zone: StorageZone
  readonly maxWeight: Weight
  readonly maxVolume: Volume
  readonly storedEntries: StoredCargoEntry[]
}

export const BIN_UTILIZATION_THRESHOLD_PERCENT = 85

export class WarehouseBin extends AggregateRoot<string> {
  readonly code: string
  readonly zone: StorageZone
  readonly maxWeight: Weight
  readonly maxVolume: Volume
  private readonly entries: StoredCargoEntry[]
  private readonly allocationChain: StorageAllocationHandler

  private constructor(props: WarehouseBinProps) {
    super(props.id)
    this.code = props.code
    this.zone = props.zone
    this.maxWeight = props.maxWeight
    this.maxVolume = props.maxVolume
    this.entries = [...props.storedEntries]
    this.allocationChain = createStorageAllocationChain()
  }

  /**
   * Factory Method for creating a brand-new WarehouseBin with invariant validation.
   */
  static create(params: {
    id: string
    code: string
    zone: StorageZone
    maxWeight: Weight
    maxVolume: Volume
  }): WarehouseBin {
    const code = params.code.trim().toUpperCase()
    if (!code) {
      throw new ValidationDomainError('INVALID_BIN_CODE', 'Warehouse bin code cannot be empty.')
    }
    if (params.maxWeight.grams <= 0) {
      throw new ValidationDomainError(
        'INVALID_BIN_CAPACITY',
        'Warehouse bin maxWeight must be > 0.',
      )
    }
    if (params.maxVolume.cubicCentimeters <= 0) {
      throw new ValidationDomainError(
        'INVALID_BIN_CAPACITY',
        'Warehouse bin maxVolume must be > 0.',
      )
    }
    return new WarehouseBin({
      id: params.id.trim(),
      code,
      zone: assertStorageZone(params.zone),
      maxWeight: params.maxWeight,
      maxVolume: params.maxVolume,
      storedEntries: [],
    })
  }

  /**
   * Factory Method for reconstituting a WarehouseBin from persistence without emitting creation events.
   */
  static rehydrate(params: {
    id: string
    code: string
    zone: StorageZone
    maxWeightKg: number
    maxVolumeM3: number
    storedEntries: readonly StoredCargoEntrySnapshot[]
  }): WarehouseBin {
    return new WarehouseBin({
      id: params.id,
      code: params.code,
      zone: assertStorageZone(params.zone),
      maxWeight: Weight.fromKilograms(params.maxWeightKg),
      maxVolume: Volume.fromCubicMeters(params.maxVolumeM3),
      storedEntries: params.storedEntries.map(entry => ({
        unit: rehydrateCargoUnit(entry.unit),
        status: entry.status,
        allocatedShipmentId: entry.allocatedShipmentId,
        storedAt: entry.storedAt,
      })),
    })
  }

  get storedEntries(): readonly StoredCargoEntry[] {
    return this.entries
  }

  get usedWeight(): Weight {
    return this.entries.reduce((total, entry) => total.add(entry.unit.getWeight()), Weight.zero())
  }

  get usedVolume(): Volume {
    return this.entries.reduce((total, entry) => total.add(entry.unit.getVolume()), Volume.zero())
  }

  get weightUtilizationPercent(): number {
    return Math.min(100, Math.round((this.usedWeight.grams / this.maxWeight.grams) * 100))
  }

  get volumeUtilizationPercent(): number {
    return Math.min(
      100,
      Math.round((this.usedVolume.cubicCentimeters / this.maxVolume.cubicCentimeters) * 100),
    )
  }

  get utilizationPercent(): number {
    return Math.max(this.weightUtilizationPercent, this.volumeUtilizationPercent)
  }

  findCargo(cargoId: string): StoredCargoEntry | undefined {
    return this.entries.find(entry => entry.unit.id === cargoId)
  }

  storeCargo(cargo: CargoUnit, occurredAt: Date): StoredCargoEntry {
    if (this.findCargo(cargo.id)) {
      throw new DuplicateCargoUnitError(cargo.id, this.code)
    }

    const previousUtilization = this.utilizationPercent

    // Run Chain of Responsibility: Zone -> Weight -> Volume
    this.allocationChain.validate({
      binCode: this.code,
      zone: this.zone,
      maxWeight: this.maxWeight,
      usedWeight: this.usedWeight,
      maxVolume: this.maxVolume,
      usedVolume: this.usedVolume,
      cargo,
    })

    const entry: StoredCargoEntry = {
      unit: cargo,
      status: 'AVAILABLE',
      allocatedShipmentId: null,
      storedAt: occurredAt.toISOString(),
    }
    this.entries.push(entry)

    this.recordEvent(
      createCargoStoredInBinEvent({
        binId: this.id,
        binCode: this.code,
        zone: this.zone,
        cargoId: cargo.id,
        cargoKind: cargo.kind,
        cargoLabel: cargo.label,
        handlingClass: cargo.getHandlingClass(),
        weightKg: cargo.getWeight().kilograms,
        volumeM3: cargo.getVolume().cubicMeters,
        occurredAt,
      }),
    )

    const currentUtilization = this.utilizationPercent
    if (
      previousUtilization < BIN_UTILIZATION_THRESHOLD_PERCENT &&
      currentUtilization >= BIN_UTILIZATION_THRESHOLD_PERCENT
    ) {
      this.recordEvent(
        createBinThresholdReachedEvent({
          binId: this.id,
          binCode: this.code,
          zone: this.zone,
          utilizationPercent: currentUtilization,
          occurredAt,
        }),
      )
    }

    return entry
  }

  allocateCargo(cargoId: string, shipmentId: string, occurredAt: Date): StoredCargoEntry {
    const idx = this.entries.findIndex(entry => entry.unit.id === cargoId)
    if (idx === -1) {
      throw new CargoNotFoundInBinError(cargoId, this.id)
    }

    const existing = this.entries[idx]!
    if (existing.status === 'ALLOCATED') {
      throw new CargoAlreadyAllocatedError(cargoId, existing.allocatedShipmentId ?? undefined)
    }

    const updated: StoredCargoEntry = {
      ...existing,
      status: 'ALLOCATED',
      allocatedShipmentId: shipmentId,
    }
    this.entries[idx] = updated

    this.recordEvent(
      createCargoAllocatedEvent({
        binId: this.id,
        binCode: this.code,
        cargoId: existing.unit.id,
        cargoLabel: existing.unit.label,
        shipmentId,
        occurredAt,
      }),
    )

    return updated
  }

  releaseCargo(cargoId: string, occurredAt: Date): CargoUnit {
    const idx = this.entries.findIndex(entry => entry.unit.id === cargoId)
    if (idx === -1) {
      throw new CargoNotFoundInBinError(cargoId, this.id)
    }

    const [removed] = this.entries.splice(idx, 1)
    this.recordEvent(
      createCargoReleasedEvent({
        binId: this.id,
        binCode: this.code,
        cargoId: removed!.unit.id,
        cargoLabel: removed!.unit.label,
        occurredAt,
      }),
    )
    return removed!.unit
  }

  returnCargo(cargoId: string, occurredAt: Date): StoredCargoEntry {
    const idx = this.entries.findIndex(entry => entry.unit.id === cargoId)
    if (idx === -1) {
      throw new CargoNotFoundInBinError(cargoId, this.id)
    }

    const existing = this.entries[idx]!
    const updated: StoredCargoEntry = {
      ...existing,
      status: 'AVAILABLE',
      allocatedShipmentId: null,
    }
    this.entries[idx] = updated

    this.recordEvent(
      createCargoStoredInBinEvent({
        binId: this.id,
        binCode: this.code,
        zone: this.zone,
        cargoId: existing.unit.id,
        cargoKind: existing.unit.kind,
        cargoLabel: `${existing.unit.label} (Returned)`,
        handlingClass: existing.unit.getHandlingClass(),
        weightKg: existing.unit.getWeight().kilograms,
        volumeM3: existing.unit.getVolume().cubicMeters,
        occurredAt,
      }),
    )

    return updated
  }

  toSnapshot() {
    return {
      id: this.id,
      code: this.code,
      zone: this.zone,
      maxWeightKg: this.maxWeight.kilograms,
      maxVolumeM3: this.maxVolume.cubicMeters,
      storedEntries: this.entries.map(entry => ({
        unit: entry.unit.toSnapshot(),
        status: entry.status,
        allocatedShipmentId: entry.allocatedShipmentId,
        storedAt: entry.storedAt,
      })),
    }
  }
}
