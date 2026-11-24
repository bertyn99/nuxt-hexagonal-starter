import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import { ValueObject } from '../../../../hexagonal-kernel/core/domain/value-object'

interface WeightProps extends Record<string, unknown> {
  readonly grams: number
}

export class Weight extends ValueObject<WeightProps> {
  private constructor(grams: number) {
    super({ grams })
  }

  static zero(): Weight {
    return new Weight(0)
  }

  static fromGrams(grams: number): Weight {
    if (!Number.isFinite(grams) || grams < 0) {
      throw new ValidationDomainError(
        'INVALID_WEIGHT',
        'Weight in grams must be a non-negative finite number.',
        { grams },
      )
    }
    return new Weight(Math.round(grams))
  }

  static fromKilograms(kg: number): Weight {
    if (!Number.isFinite(kg) || kg < 0) {
      throw new ValidationDomainError(
        'INVALID_WEIGHT',
        'Weight in kilograms must be a non-negative finite number.',
        { kg },
      )
    }
    return new Weight(Math.round(kg * 1000))
  }

  get grams(): number {
    return this.props.grams
  }

  get kilograms(): number {
    return Number((this.props.grams / 1000).toFixed(3))
  }

  add(other: Weight): Weight {
    return new Weight(this.props.grams + other.props.grams)
  }

  subtract(other: Weight): Weight {
    const diff = this.props.grams - other.props.grams
    if (diff < 0) {
      throw new ValidationDomainError(
        'NEGATIVE_WEIGHT_RESULT',
        'Resulting weight cannot be negative.',
        {
          leftGrams: this.props.grams,
          rightGrams: other.props.grams,
        },
      )
    }
    return new Weight(diff)
  }

  isGreaterThan(other: Weight): boolean {
    return this.props.grams > other.props.grams
  }
}
