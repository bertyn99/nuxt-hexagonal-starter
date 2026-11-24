import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import { ValueObject } from '../../../../hexagonal-kernel/core/domain/value-object'

interface DeliveryWindowProps extends Record<string, unknown> {
  readonly promisedByIso: string
  readonly estimatedHours: number
}

export class DeliveryWindow extends ValueObject<DeliveryWindowProps> {
  private constructor(promisedByIso: string, estimatedHours: number) {
    super({ promisedByIso, estimatedHours })
  }

  static fromStartAndHours(start: Date, estimatedHours: number): DeliveryWindow {
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) {
      throw new ValidationDomainError(
        'INVALID_DELIVERY_WINDOW',
        'Estimated hours must be positive.',
        { estimatedHours },
      )
    }
    const deadline = new Date(start.getTime() + estimatedHours * 60 * 60 * 1000)
    return new DeliveryWindow(deadline.toISOString(), estimatedHours)
  }

  static fromIso(promisedByIso: string, estimatedHours: number): DeliveryWindow {
    const parsed = new Date(promisedByIso)
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationDomainError(
        'INVALID_DELIVERY_WINDOW',
        `Invalid promisedBy ISO date "${promisedByIso}".`,
      )
    }
    return new DeliveryWindow(parsed.toISOString(), estimatedHours)
  }

  get promisedByIso(): string {
    return this.props.promisedByIso
  }

  get estimatedHours(): number {
    return this.props.estimatedHours
  }

  promisedByDate(): Date {
    return new Date(this.props.promisedByIso)
  }

  isBreached(now: Date): boolean {
    return now.getTime() > this.promisedByDate().getTime()
  }

  remainingHours(now: Date): number {
    const diffMs = this.promisedByDate().getTime() - now.getTime()
    return Number((diffMs / (60 * 60 * 1000)).toFixed(2))
  }
}
