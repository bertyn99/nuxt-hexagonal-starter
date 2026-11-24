import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import { ValueObject } from '../../../../hexagonal-kernel/core/domain/value-object'

interface MoneyProps extends Record<string, unknown> {
  readonly amountCents: number
  readonly currency: string
}

export class Money extends ValueObject<MoneyProps> {
  private constructor(amountCents: number, currency: string) {
    super({ amountCents, currency })
  }

  static fromCents(amountCents: number, currency = 'EUR'): Money {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new ValidationDomainError(
        'INVALID_MONEY_AMOUNT',
        'Money amountCents must be a non-negative integer.',
        { amountCents, currency },
      )
    }
    const normalizedCurrency = currency.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new ValidationDomainError(
        'INVALID_CURRENCY_CODE',
        `Currency "${currency}" must be a 3-letter ISO code (e.g., EUR, USD).`,
        { currency },
      )
    }
    return new Money(amountCents, normalizedCurrency)
  }

  static fromMajor(amount: number, currency = 'EUR'): Money {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ValidationDomainError('INVALID_MONEY_AMOUNT', 'Money amount must be non-negative.', { amount })
    }
    return Money.fromCents(Math.round(amount * 100), currency)
  }

  get amountCents(): number {
    return this.props.amountCents
  }

  get currency(): string {
    return this.props.currency
  }

  get majorAmount(): number {
    return Number((this.props.amountCents / 100).toFixed(2))
  }

  add(other: Money): Money {
    if (this.props.currency !== other.props.currency) {
      throw new ValidationDomainError(
        'CURRENCY_MISMATCH',
        `Cannot add ${other.props.currency} to ${this.props.currency}.`,
      )
    }
    return new Money(this.props.amountCents + other.props.amountCents, this.props.currency)
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor) || factor < 0) {
      throw new ValidationDomainError('INVALID_MULTIPLIER', 'Money multiplier must be a non-negative finite number.')
    }
    return new Money(Math.round(this.props.amountCents * factor), this.props.currency)
  }

  format(): string {
    const symbol = this.props.currency === 'EUR' ? '€' : this.props.currency === 'USD' ? '$' : `${this.props.currency} `
    return `${symbol}${(this.props.amountCents / 100).toFixed(2)}`
  }
}
