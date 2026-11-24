import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { ShipmentNotFoundError } from '../../domain'
import { mapShipmentToView } from '../dtos/delivery.dtos'
import type { ShipmentView } from '../dtos/delivery.dtos'
import type { CarrierGatewayPort } from '../ports/outbound/carrier-gateway.port'
import type { ShipmentRepositoryPort } from '../ports/outbound/shipment-repository.port'

export interface DispatchShipmentInput {
  readonly shipmentId: string
}

export class DispatchShipmentUseCase implements UseCase<DispatchShipmentInput, ShipmentView> {
  readonly name = 'DispatchShipmentUseCase'
  readonly boundedContext = 'delivery'

  constructor(
    private readonly shipmentRepository: ShipmentRepositoryPort,
    private readonly carrierGateway: CarrierGatewayPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: DispatchShipmentInput): Promise<ShipmentView> {
    const shipment = await this.shipmentRepository.findById(input.shipmentId)
    if (!shipment) {
      throw new ShipmentNotFoundError(input.shipmentId)
    }

    const receipt = await this.carrierGateway.dispatchShipment({
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber.value,
      carrierMode: shipment.carrierMode,
      destination: shipment.destination,
      weightKg: shipment.cargoSummary.weightKg,
    })

    const now = this.clock.now()
    shipment.dispatch(receipt.carrierReference, now)
    await this.shipmentRepository.save(shipment)
    await this.eventBus.publishAll(shipment.pullDomainEvents())

    return mapShipmentToView(shipment, now)
  }
}
