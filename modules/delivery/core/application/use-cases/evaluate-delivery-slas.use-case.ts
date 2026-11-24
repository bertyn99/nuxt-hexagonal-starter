import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import type { SlaEvaluationView } from '../dtos/delivery.dtos'
import type { ShipmentRepositoryPort } from '../ports/outbound/shipment-repository.port'

export class EvaluateDeliverySlasUseCase implements UseCase<void, SlaEvaluationView> {
  readonly name = 'EvaluateDeliverySlasUseCase'
  readonly boundedContext = 'delivery'

  constructor(
    private readonly shipmentRepository: ShipmentRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<SlaEvaluationView> {
    const now = this.clock.now()
    const shipments = await this.shipmentRepository.findAll()

    let evaluatedCount = 0
    let newlyBreachedCount = 0
    let totalBreachedCount = 0
    const breachedTrackingNumbers: string[] = []

    for (const shipment of shipments) {
      if (!shipment.isTerminal) {
        evaluatedCount += 1
        const breachedNow = shipment.evaluateSla(now)
        if (breachedNow) {
          newlyBreachedCount += 1
          breachedTrackingNumbers.push(shipment.trackingNumber.value)
          await this.shipmentRepository.save(shipment)
          await this.eventBus.publishAll(shipment.pullDomainEvents())
        }
      }
      if (shipment.slaBreached) {
        totalBreachedCount += 1
      }
    }

    return {
      evaluatedAtIso: now.toISOString(),
      evaluatedCount,
      newlyBreachedCount,
      totalBreachedCount,
      breachedTrackingNumbers,
    }
  }
}
