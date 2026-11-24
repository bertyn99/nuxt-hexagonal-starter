import {
  BinCapacityExceededError,
  IncompatibleStorageZoneError,
} from '../errors/warehouse.errors'
import type { CargoUnit } from '../entities/cargo-unit'
import { isHandlingCompatibleWithZone } from '../value-objects/storage-zone'
import type { StorageZone } from '../value-objects/storage-zone'
import type { Volume } from '../value-objects/dimensions'
import type { Weight } from '../value-objects/weight'

export interface StorageAllocationContext {
  readonly binCode: string
  readonly zone: StorageZone
  readonly maxWeight: Weight
  readonly usedWeight: Weight
  readonly maxVolume: Volume
  readonly usedVolume: Volume
  readonly cargo: CargoUnit
}

export interface StorageAllocationHandler {
  setNext(handler: StorageAllocationHandler): StorageAllocationHandler
  validate(context: StorageAllocationContext): void
}

abstract class BaseStorageAllocationHandler implements StorageAllocationHandler {
  private nextHandler: StorageAllocationHandler | null = null

  setNext(handler: StorageAllocationHandler): StorageAllocationHandler {
    this.nextHandler = handler
    return handler
  }

  validate(context: StorageAllocationContext): void {
    this.check(context)
    this.nextHandler?.validate(context)
  }

  protected abstract check(context: StorageAllocationContext): void
}

export class ZoneCompatibilityHandler extends BaseStorageAllocationHandler {
  protected check(context: StorageAllocationContext): void {
    const handlingClass = context.cargo.getHandlingClass()
    if (!isHandlingCompatibleWithZone(context.zone, handlingClass)) {
      throw new IncompatibleStorageZoneError(context.binCode, context.zone, handlingClass)
    }
  }
}

export class WeightCapacityHandler extends BaseStorageAllocationHandler {
  protected check(context: StorageAllocationContext): void {
    const requestedWeight = context.cargo.getWeight()
    const projectedWeight = context.usedWeight.add(requestedWeight)
    if (projectedWeight.isGreaterThan(context.maxWeight)) {
      const availableKg = context.maxWeight.subtract(context.usedWeight).kilograms
      throw new BinCapacityExceededError(
        context.binCode,
        'weight',
        requestedWeight.kilograms,
        availableKg,
        'kg',
      )
    }
  }
}

export class VolumeCapacityHandler extends BaseStorageAllocationHandler {
  protected check(context: StorageAllocationContext): void {
    const requestedVolume = context.cargo.getVolume()
    const projectedVolume = context.usedVolume.add(requestedVolume)
    if (projectedVolume.isGreaterThan(context.maxVolume)) {
      const availableM3 = context.maxVolume.subtract(context.usedVolume).cubicMeters
      throw new BinCapacityExceededError(
        context.binCode,
        'volume',
        requestedVolume.cubicMeters,
        availableM3,
        'm3',
      )
    }
  }
}

/**
 * Chain of Responsibility: Zone Compatibility -> Weight Capacity -> Volume Capacity
 */
export function createStorageAllocationChain(): StorageAllocationHandler {
  const zoneHandler = new ZoneCompatibilityHandler()
  const weightHandler = new WeightCapacityHandler()
  const volumeHandler = new VolumeCapacityHandler()
  zoneHandler.setNext(weightHandler).setNext(volumeHandler)
  return zoneHandler
}
