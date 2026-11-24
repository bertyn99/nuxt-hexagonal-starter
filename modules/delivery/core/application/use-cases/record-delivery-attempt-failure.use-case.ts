import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { ShipmentNotFoundError } from '../../domain'
import type { DeliveryExceptionResolution } from '../../domain'
import { mapShipmentToView } from '../dtos/delivery.dtos'
import type { ShipmentView } from '../dtos/delivery.dtos'
import type { ShipmentRepositoryPort } from '../ports/outbound/shipment-repository.port'

export interface RecordDeliveryAttemptFailureInput {
  readonly shipmentId: string
  readonly reason: string
}

export interface RecordDeliveryAttemptFailureOutput {
  readonly shipment: ShipmentView
  readonly resolution: DeliveryExceptionResolution
}

export class RecordDeliveryAttemptFailureUseCase
implements UseCase<RecordDeliveryAttemptFailureInput, RecordDeliveryAttemptFailureOutput> {
  readonly name = 'RecordDeliveryAttemptFailureUseCase'
  readonly boundedContext = 'delivery'

  constructor(
    private readonly shipmentRepository: ShipmentRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: RecordDeliveryAttemptFailureInput): Promise<RecordDeliveryAttemptFailureOutput> {
    const shipment = await this.shipmentRepository.findById(input.shipmentId)
    if (!shipment) {
      throw new ShipmentNotFoundError(input.shipmentId)
    }

    const now = this.clock.now()
    const resolution = shipment.recordFailedAttempt(input.reason, now)
    await this.shipmentRepository.save(shipment)
    await this.eventBus.publishAll(shipment.pullDomainEvents())

    return {
      shipment: mapShipmentToView(shipment, now),
      resolution,
    }
  }
}
