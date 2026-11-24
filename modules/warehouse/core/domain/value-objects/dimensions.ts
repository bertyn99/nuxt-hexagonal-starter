import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import { ValueObject } from '../../../../hexagonal-kernel/core/domain/value-object'

interface VolumeProps extends Record<string, unknown> {
  readonly cubicCentimeters: number
}

export class Volume extends ValueObject<VolumeProps> {
  private constructor(cubicCentimeters: number) {
    super({ cubicCentimeters })
  }

  static zero(): Volume {
    return new Volume(0)
  }

  static fromCubicMeters(m3: number): Volume {
    if (!Number.isFinite(m3) || m3 < 0) {
      throw new ValidationDomainError(
        'INVALID_VOLUME',
        'Volume in m3 must be a non-negative finite number.',
        { m3 },
      )
    }
    return new Volume(Math.round(m3 * 1_000_000))
  }

  static fromCubicCentimeters(cm3: number): Volume {
    if (!Number.isFinite(cm3) || cm3 < 0) {
      throw new ValidationDomainError(
        'INVALID_VOLUME',
        'Volume in cm3 must be a non-negative finite number.',
        { cm3 },
      )
    }
    return new Volume(Math.round(cm3))
  }

  get cubicCentimeters(): number {
    return this.props.cubicCentimeters
  }

  get cubicMeters(): number {
    return Number((this.props.cubicCentimeters / 1_000_000).toFixed(4))
  }

  add(other: Volume): Volume {
    return new Volume(this.props.cubicCentimeters + other.props.cubicCentimeters)
  }

  subtract(other: Volume): Volume {
    const diff = this.props.cubicCentimeters - other.props.cubicCentimeters
    if (diff < 0) {
      throw new ValidationDomainError(
        'NEGATIVE_VOLUME_RESULT',
        'Resulting volume cannot be negative.',
      )
    }
    return new Volume(diff)
  }

  isGreaterThan(other: Volume): boolean {
    return this.props.cubicCentimeters > other.props.cubicCentimeters
  }
}

interface DimensionsProps extends Record<string, unknown> {
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
}

export class Dimensions extends ValueObject<DimensionsProps> {
  private constructor(props: DimensionsProps) {
    super(props)
  }

  static fromCentimeters(lengthCm: number, widthCm: number, heightCm: number): Dimensions {
    if (
      !Number.isFinite(lengthCm) ||
      lengthCm <= 0 ||
      !Number.isFinite(widthCm) ||
      widthCm <= 0 ||
      !Number.isFinite(heightCm) ||
      heightCm <= 0
    ) {
      throw new ValidationDomainError(
        'INVALID_DIMENSIONS',
        'Dimensions (length, width, height in cm) must all be positive finite numbers.',
        { lengthCm, widthCm, heightCm },
      )
    }
    return new Dimensions({
      lengthCm: Math.round(lengthCm * 100) / 100,
      widthCm: Math.round(widthCm * 100) / 100,
      heightCm: Math.round(heightCm * 100) / 100,
    })
  }

  get lengthCm(): number {
    return this.props.lengthCm
  }

  get widthCm(): number {
    return this.props.widthCm
  }

  get heightCm(): number {
    return this.props.heightCm
  }

  toVolume(): Volume {
    return Volume.fromCubicCentimeters(
      this.props.lengthCm * this.props.widthCm * this.props.heightCm,
    )
  }
}
