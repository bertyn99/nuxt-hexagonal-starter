import type { HandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'
import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { DeliveryWindow, resolveCarrierStrategy } from '../../domain'
import type { CarrierMode } from '../../domain'
import type { DeliveryQuoteView } from '../dtos/delivery.dtos'

export interface QuoteShipmentInput {
  readonly carrierMode: CarrierMode
  readonly weightKg: number
  readonly volumeM3: number
  readonly handlingClass: HandlingClass
}

export class QuoteShipmentQuery implements UseCase<QuoteShipmentInput, DeliveryQuoteView> {
  readonly name = 'QuoteShipmentQuery'
  readonly boundedContext = 'delivery'

  constructor(private readonly clock: ClockPort) {}

  async execute(input: QuoteShipmentInput): Promise<DeliveryQuoteView> {
    const strategy = resolveCarrierStrategy(input.carrierMode)
    const quote = strategy.quote({
      weightKg: input.weightKg,
      volumeM3: input.volumeM3,
      handlingClass: input.handlingClass,
    })
    const window = DeliveryWindow.fromStartAndHours(this.clock.now(), quote.estimatedHours)

    return {
      carrierMode: quote.carrierMode,
      carrierLabel: quote.carrierLabel,
      costCents: quote.cost.amountCents,
      costFormatted: quote.cost.format(),
      currency: quote.cost.currency,
      estimatedHours: quote.estimatedHours,
      promisedByIso: window.promisedByIso,
      notes: quote.notes,
    }
  }
}
