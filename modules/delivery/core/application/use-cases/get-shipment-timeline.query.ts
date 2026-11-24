import type { AuditLogPort } from '../../../../hexagonal-kernel/core/application/ports/audit-log.port'
import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { ShipmentNotFoundError } from '../../domain'
import { mapShipmentToView } from '../dtos/delivery.dtos'
import type { ShipmentTimelineView } from '../dtos/delivery.dtos'
import type { ShipmentRepositoryPort } from '../ports/outbound/shipment-repository.port'

export interface GetShipmentTimelineInput {
  readonly shipmentId: string
}

export class GetShipmentTimelineQuery implements UseCase<GetShipmentTimelineInput, ShipmentTimelineView> {
  readonly name = 'GetShipmentTimelineQuery'
  readonly boundedContext = 'delivery'

  constructor(
    private readonly shipmentRepository: ShipmentRepositoryPort,
    private readonly auditLog: AuditLogPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: GetShipmentTimelineInput): Promise<ShipmentTimelineView> {
    const shipment = await this.shipmentRepository.findById(input.shipmentId)
    if (!shipment) {
      throw new ShipmentNotFoundError(input.shipmentId)
    }

    const events = await this.auditLog.listByAggregate(shipment.id)
    return {
      shipment: mapShipmentToView(shipment, this.clock.now()),
      events,
    }
  }
}
