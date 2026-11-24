import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import { ValueObject } from '../../../../hexagonal-kernel/core/domain/value-object'

const TRACKING_PATTERN = /^LOG-\d{4}-[A-Z0-9]{6}$/

interface TrackingNumberProps extends Record<string, unknown> {
  readonly value: string
}

let trackingSeq = 1000

export class TrackingNumber extends ValueObject<TrackingNumberProps> {
  private constructor(value: string) {
    super({ value })
  }

  static create(raw: string): TrackingNumber {
    const normalized = raw.trim().toUpperCase()
    if (!TRACKING_PATTERN.test(normalized)) {
      throw new ValidationDomainError(
        'INVALID_TRACKING_NUMBER',
        `Tracking number "${raw}" does not match required format LOG-YYYY-XXXXXX.`,
        { raw },
      )
    }
    return new TrackingNumber(normalized)
  }

  static generate(now: Date): TrackingNumber {
    trackingSeq += 1
    const year = now.getUTCFullYear()
    const suffix = `${now.getTime().toString(36).slice(-3)}${trackingSeq.toString(36).slice(-3)}`
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, 'X')
      .padStart(6, '0')
      .slice(-6)
    return new TrackingNumber(`LOG-${year}-${suffix}`)
  }

  get value(): string {
    return this.props.value
  }
}
