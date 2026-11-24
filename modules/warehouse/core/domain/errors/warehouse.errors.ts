import { DomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import type { DomainErrorStatusHint } from '../../../../hexagonal-kernel/core/domain/domain-error'

export class IncompatibleStorageZoneError extends DomainError {
  readonly code = 'INCOMPATIBLE_STORAGE_ZONE'
  readonly statusHint: DomainErrorStatusHint = 'conflict'

  constructor(binCode: string, binZone: string, handlingClass: string) {
    super(
      `Cargo with handling class "${handlingClass}" cannot be stored in bin "${binCode}" (zone: ${binZone}).`,
      { binCode, binZone, handlingClass },
    )
  }
}

export class BinCapacityExceededError extends DomainError {
  readonly code = 'BIN_CAPACITY_EXCEEDED'
  readonly statusHint: DomainErrorStatusHint = 'conflict'

  constructor(
    binCode: string,
    dimension: 'weight' | 'volume',
    requested: number,
    available: number,
    unit: string,
  ) {
    super(
      `Bin "${binCode}" ${dimension} capacity exceeded: requested ${requested}${unit}, available ${available}${unit}.`,
      { binCode, dimension, requested, available, unit },
    )
  }
}

export class CargoNotFoundInBinError extends DomainError {
  readonly code = 'CARGO_NOT_FOUND_IN_BIN'
  readonly statusHint: DomainErrorStatusHint = 'not_found'

  constructor(cargoId: string, binId?: string) {
    super(
      binId
        ? `Cargo unit "${cargoId}" was not found in bin "${binId}".`
        : `Cargo unit "${cargoId}" was not found in any warehouse bin.`,
      { cargoId, binId },
    )
  }
}

export class CargoAlreadyAllocatedError extends DomainError {
  readonly code = 'CARGO_ALREADY_ALLOCATED'
  readonly statusHint: DomainErrorStatusHint = 'conflict'

  constructor(cargoId: string, shipmentId?: string) {
    super(
      shipmentId
        ? `Cargo unit "${cargoId}" is already allocated to shipment "${shipmentId}".`
        : `Cargo unit "${cargoId}" is already allocated to another shipment.`,
      { cargoId, shipmentId },
    )
  }
}

export class WarehouseBinNotFoundError extends DomainError {
  readonly code = 'WAREHOUSE_BIN_NOT_FOUND'
  readonly statusHint: DomainErrorStatusHint = 'not_found'

  constructor(binId: string) {
    super(`Warehouse bin "${binId}" does not exist.`, { binId })
  }
}

export class DuplicateCargoUnitError extends DomainError {
  readonly code = 'DUPLICATE_CARGO_UNIT'
  readonly statusHint: DomainErrorStatusHint = 'conflict'

  constructor(cargoId: string, binCode: string) {
    super(`Cargo unit "${cargoId}" is already stored in bin "${binCode}".`, { cargoId, binCode })
  }
}
