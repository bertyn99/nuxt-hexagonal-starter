import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import type { HandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'
import { CarrierHandlingNotSupportedError } from '../errors/delivery.errors'
import { Money } from '../value-objects/money'

export const CARRIER_MODES = ['STANDARD_GROUND', 'EXPRESS_AIR', 'COLD_CHAIN_COURIER'] as const
export type CarrierMode = (typeof CARRIER_MODES)[number]

export interface CarrierQuoteInput {
  readonly weightKg: number
  readonly volumeM3: number
  readonly handlingClass: HandlingClass
}

export interface CarrierQuoteResult {
  readonly carrierMode: CarrierMode
  readonly carrierLabel: string
  readonly cost: Money
  readonly estimatedHours: number
  readonly notes: string
}

/**
 * Strategy Pattern: swappable carrier pricing, handling eligibility, and ETA policies.
 */
export interface CarrierStrategy {
  readonly mode: CarrierMode
  readonly label: string
  readonly supportedHandlingClasses: readonly HandlingClass[]
  quote(input: CarrierQuoteInput): CarrierQuoteResult
}

export class StandardGroundStrategy implements CarrierStrategy {
  readonly mode: CarrierMode = 'STANDARD_GROUND'
  readonly label = 'Standard Ground Freight'
  readonly supportedHandlingClasses: readonly HandlingClass[] = ['STANDARD', 'FRAGILE', 'HAZMAT']

  quote(input: CarrierQuoteInput): CarrierQuoteResult {
    if (!this.supportedHandlingClasses.includes(input.handlingClass)) {
      throw new CarrierHandlingNotSupportedError(this.mode, input.handlingClass)
    }
    const baseCents = 1400
    const weightCents = Math.round(input.weightKg * 120)
    const volumeCents = Math.round(input.volumeM3 * 900)
    const surchargeCents =
      input.handlingClass === 'HAZMAT' ? 4500 : input.handlingClass === 'FRAGILE' ? 1200 : 0

    return {
      carrierMode: this.mode,
      carrierLabel: this.label,
      cost: Money.fromCents(baseCents + weightCents + volumeCents + surchargeCents, 'EUR'),
      estimatedHours: input.handlingClass === 'HAZMAT' ? 48 : 36,
      notes:
        input.handlingClass === 'HAZMAT'
          ? 'ADR-certified ground freight with hazmat surcharge'
          : 'Economical regional ground network',
    }
  }
}

export class ExpressAirStrategy implements CarrierStrategy {
  readonly mode: CarrierMode = 'EXPRESS_AIR'
  readonly label = 'Express Air Priority'
  // Air freight forbids HAZMAT and unrefrigerated COLD_CHAIN
  readonly supportedHandlingClasses: readonly HandlingClass[] = ['STANDARD', 'FRAGILE']

  quote(input: CarrierQuoteInput): CarrierQuoteResult {
    if (!this.supportedHandlingClasses.includes(input.handlingClass)) {
      throw new CarrierHandlingNotSupportedError(this.mode, input.handlingClass)
    }
    const baseCents = 3800
    const weightCents = Math.round(input.weightKg * 340)
    const volumeCents = Math.round(input.volumeM3 * 2200)
    const fragileSurcharge = input.handlingClass === 'FRAGILE' ? 1800 : 0

    return {
      carrierMode: this.mode,
      carrierLabel: this.label,
      cost: Money.fromCents(baseCents + weightCents + volumeCents + fragileSurcharge, 'EUR'),
      estimatedHours: 12,
      notes: 'Next-flight priority air linehaul with 12h SLA',
    }
  }
}

export class ColdChainCourierStrategy implements CarrierStrategy {
  readonly mode: CarrierMode = 'COLD_CHAIN_COURIER'
  readonly label = 'Cold-Chain Thermal Courier'
  readonly supportedHandlingClasses: readonly HandlingClass[] = [
    'COLD_CHAIN',
    'FRAGILE',
    'STANDARD',
  ]

  quote(input: CarrierQuoteInput): CarrierQuoteResult {
    if (!this.supportedHandlingClasses.includes(input.handlingClass)) {
      throw new CarrierHandlingNotSupportedError(this.mode, input.handlingClass)
    }
    const baseCents = 5200
    const weightCents = Math.round(input.weightKg * 260)
    const volumeCents = Math.round(input.volumeM3 * 2500)
    const cryoSurcharge = input.handlingClass === 'COLD_CHAIN' ? 2500 : 0

    return {
      carrierMode: this.mode,
      carrierLabel: this.label,
      cost: Money.fromCents(baseCents + weightCents + volumeCents + cryoSurcharge, 'EUR'),
      estimatedHours: 18,
      notes: 'Active -20°C monitored thermal fleet with continuous telemetry',
    }
  }
}

export function resolveCarrierStrategy(mode: string): CarrierStrategy {
  switch (mode) {
    case 'STANDARD_GROUND':
      return new StandardGroundStrategy()
    case 'EXPRESS_AIR':
      return new ExpressAirStrategy()
    case 'COLD_CHAIN_COURIER':
      return new ColdChainCourierStrategy()
    default:
      throw new ValidationDomainError(
        'INVALID_CARRIER_MODE',
        `Unknown carrier strategy "${mode}". Expected one of: ${CARRIER_MODES.join(', ')}.`,
        { mode },
      )
  }
}
