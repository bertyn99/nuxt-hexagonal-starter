import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { ShipmentNotFoundError } from '../../domain'
import { mapShipmentToView } from '../dtos/delivery.dtos'
import type { ShipmentView } from '../dtos/delivery.dtos'
import type { ShipmentRepositoryPort } from '../ports/outbound/shipment-repository.port'

export interface AdvanceShipmentTransitInput {
  readonly shipmentId: string
  readonly locationNote?: string
}

export class AdvanceShipmentTransitUseCase implements UseCase<AdvanceShipmentTransitInput, ShipmentView> {
  readonly name = 'AdvanceShipmentTransitUseCase'
  readonly boundedContext = 'delivery'

  constructor(
    private readonly shipmentRepository: ShipmentRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: AdvanceShipmentTransitInput): Promise<ShipmentView> {
    const shipment = await this.shipmentRepository.findById(input.shipmentId)
    if (!shipment) {
      throw new ShipmentNotFoundError(input.shipmentId)
    }

    const now = this.clock.now()
    shipment.advanceTransit(now, input.locationNote)
    await this.shipmentRepository.save(shipment)
    await this.eventBus.publishAll(shipment.pullDomainEvents())

    return mapShipmentToView(shipment, now)
  }
}
