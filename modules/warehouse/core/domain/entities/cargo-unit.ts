import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import {
  assertHandlingClass,
  strictestHandlingClass,
} from '../../../../hexagonal-kernel/core/domain/handling-class'
import type { HandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'
import { Dimensions, Volume } from '../value-objects/dimensions'
import { Weight } from '../value-objects/weight'

export interface ParcelSnapshot {
  readonly kind: 'PARCEL'
  readonly id: string
  readonly sku: string
  readonly label: string
  readonly weightKg: number
  readonly dimensionsCm: {
    readonly lengthCm: number
    readonly widthCm: number
    readonly heightCm: number
  }
  readonly volumeM3: number
  readonly handlingClass: HandlingClass
}

export interface PalletSnapshot {
  readonly kind: 'PALLET'
  readonly id: string
  readonly sku: string
  readonly label: string
  readonly tareWeightKg: number
  readonly weightKg: number
  readonly volumeM3: number
  readonly handlingClass: HandlingClass
  readonly children: readonly CargoUnitSnapshot[]
}

export type CargoUnitSnapshot = ParcelSnapshot | PalletSnapshot

/**
 * Composite Pattern: uniform contract for both leaf Parcel and composite Pallet.
 */
export interface CargoUnit {
  readonly id: string
  readonly kind: 'PARCEL' | 'PALLET'
  readonly sku: string
  readonly label: string
  getWeight(): Weight
  getVolume(): Volume
  getHandlingClass(): HandlingClass
  getItemCount(): number
  toSnapshot(): CargoUnitSnapshot
}

export class Parcel implements CargoUnit {
  readonly kind = 'PARCEL' as const
  readonly id: string
  readonly sku: string
  readonly label: string
  readonly weight: Weight
  readonly dimensions: Dimensions
  readonly handlingClass: HandlingClass

  private constructor(params: {
    id: string
    sku: string
    label: string
    weight: Weight
    dimensions: Dimensions
    handlingClass: HandlingClass
  }) {
    this.id = params.id
    this.sku = params.sku
    this.label = params.label
    this.weight = params.weight
    this.dimensions = params.dimensions
    this.handlingClass = params.handlingClass
  }

  static create(params: {
    id: string
    sku: string
    label: string
    weight: Weight
    dimensions: Dimensions
    handlingClass: HandlingClass
  }): Parcel {
    if (!params.id.trim()) {
      throw new ValidationDomainError('INVALID_CARGO_ID', 'Parcel id cannot be empty.')
    }
    if (!params.sku.trim()) {
      throw new ValidationDomainError('INVALID_CARGO_SKU', 'Parcel SKU cannot be empty.')
    }
    if (!params.label.trim()) {
      throw new ValidationDomainError('INVALID_CARGO_LABEL', 'Parcel label cannot be empty.')
    }
    if (params.weight.grams <= 0) {
      throw new ValidationDomainError('INVALID_PARCEL_WEIGHT', 'Parcel weight must be greater than zero.')
    }
    return new Parcel({
      ...params,
      id: params.id.trim(),
      sku: params.sku.trim(),
      label: params.label.trim(),
      handlingClass: assertHandlingClass(params.handlingClass),
    })
  }

  getWeight(): Weight {
    return this.weight
  }

  getVolume(): Volume {
    return this.dimensions.toVolume()
  }

  getHandlingClass(): HandlingClass {
    return this.handlingClass
  }

  getItemCount(): number {
    return 1
  }

  toSnapshot(): ParcelSnapshot {
    return {
      kind: 'PARCEL',
      id: this.id,
      sku: this.sku,
      label: this.label,
      weightKg: this.weight.kilograms,
      dimensionsCm: {
        lengthCm: this.dimensions.lengthCm,
        widthCm: this.dimensions.widthCm,
        heightCm: this.dimensions.heightCm,
      },
      volumeM3: this.getVolume().cubicMeters,
      handlingClass: this.handlingClass,
    }
  }
}

export class Pallet implements CargoUnit {
  readonly kind = 'PALLET' as const
  readonly id: string
  readonly sku: string
  readonly label: string
  readonly tareWeight: Weight
  private readonly children: readonly CargoUnit[]

  private constructor(params: {
    id: string
    sku: string
    label: string
    tareWeight: Weight
    children: readonly CargoUnit[]
  }) {
    this.id = params.id
    this.sku = params.sku
    this.label = params.label
    this.tareWeight = params.tareWeight
    this.children = Object.freeze([...params.children])
  }

  static create(params: {
    id: string
    sku: string
    label: string
    children: readonly CargoUnit[]
    tareWeight?: Weight
  }): Pallet {
    if (!params.id.trim()) {
      throw new ValidationDomainError('INVALID_CARGO_ID', 'Pallet id cannot be empty.')
    }
    if (!params.sku.trim()) {
      throw new ValidationDomainError('INVALID_CARGO_SKU', 'Pallet SKU cannot be empty.')
    }
    if (!params.label.trim()) {
      throw new ValidationDomainError('INVALID_CARGO_LABEL', 'Pallet label cannot be empty.')
    }
    if (params.children.length === 0) {
      throw new ValidationDomainError('EMPTY_PALLET', 'Pallet must contain at least one cargo unit.')
    }
    return new Pallet({
      id: params.id.trim(),
      sku: params.sku.trim(),
      label: params.label.trim(),
      tareWeight: params.tareWeight ?? Weight.zero(),
      children: params.children,
    })
  }

  getChildren(): readonly CargoUnit[] {
    return this.children
  }

  getWeight(): Weight {
    return this.children.reduce(
      (total, child) => total.add(child.getWeight()),
      this.tareWeight,
    )
  }

  getVolume(): Volume {
    return this.children.reduce(
      (total, child) => total.add(child.getVolume()),
      Volume.zero(),
    )
  }

  getHandlingClass(): HandlingClass {
    return strictestHandlingClass(this.children.map(child => child.getHandlingClass()))
  }

  getItemCount(): number {
    return this.children.reduce((sum, child) => sum + child.getItemCount(), 0)
  }

  toSnapshot(): PalletSnapshot {
    return {
      kind: 'PALLET',
      id: this.id,
      sku: this.sku,
      label: this.label,
      tareWeightKg: this.tareWeight.kilograms,
      weightKg: this.getWeight().kilograms,
      volumeM3: this.getVolume().cubicMeters,
      handlingClass: this.getHandlingClass(),
      children: this.children.map(child => child.toSnapshot()),
    }
  }
}

export function rehydrateCargoUnit(snapshot: CargoUnitSnapshot): CargoUnit {
  if (snapshot.kind === 'PARCEL') {
    return Parcel.create({
      id: snapshot.id,
      sku: snapshot.sku,
      label: snapshot.label,
      weight: Weight.fromKilograms(snapshot.weightKg),
      dimensions: Dimensions.fromCentimeters(
        snapshot.dimensionsCm.lengthCm,
        snapshot.dimensionsCm.widthCm,
        snapshot.dimensionsCm.heightCm,
      ),
      handlingClass: assertHandlingClass(snapshot.handlingClass),
    })
  }

  return Pallet.create({
    id: snapshot.id,
    sku: snapshot.sku,
    label: snapshot.label,
    tareWeight: Weight.fromKilograms(snapshot.tareWeightKg),
    children: snapshot.children.map(rehydrateCargoUnit),
  })
}
