import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { ShipmentNotFoundError } from '../../domain'
import { mapShipmentToView } from '../dtos/delivery.dtos'
import type { ShipmentView } from '../dtos/delivery.dtos'
import type { ShipmentRepositoryPort } from '../ports/outbound/shipment-repository.port'

export interface CancelShipmentInput {
  readonly shipmentId: string
  readonly reason?: string
}

export class CancelShipmentUseCase implements UseCase<CancelShipmentInput, ShipmentView> {
  readonly name = 'CancelShipmentUseCase'
  readonly boundedContext = 'delivery'

  constructor(
    private readonly shipmentRepository: ShipmentRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: CancelShipmentInput): Promise<ShipmentView> {
    const shipment = await this.shipmentRepository.findById(input.shipmentId)
    if (!shipment) {
      throw new ShipmentNotFoundError(input.shipmentId)
    }

    const now = this.clock.now()
    shipment.cancel(input.reason ?? 'Cancelled by dispatcher', now)
    await this.shipmentRepository.save(shipment)
    await this.eventBus.publishAll(shipment.pullDomainEvents())

    return mapShipmentToView(shipment, now)
  }
}
