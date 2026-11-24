import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { mapShipmentToView } from '../dtos/delivery.dtos'
import type { ShipmentView } from '../dtos/delivery.dtos'
import type {
  ShipmentFilter,
  ShipmentRepositoryPort,
} from '../ports/outbound/shipment-repository.port'

export class ListShipmentsQuery implements UseCase<ShipmentFilter | undefined, ShipmentView[]> {
  readonly name = 'ListShipmentsQuery'
  readonly boundedContext = 'delivery'

  constructor(
    private readonly shipmentRepository: ShipmentRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(filter?: ShipmentFilter): Promise<ShipmentView[]> {
    const now = this.clock.now()
    const shipments = await this.shipmentRepository.findAll(filter)
    return shipments.map(shipment => mapShipmentToView(shipment, now))
  }
}
