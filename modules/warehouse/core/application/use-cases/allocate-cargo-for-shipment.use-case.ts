import type { HandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'
import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { CargoNotFoundInBinError } from '../../domain'
import type { WarehouseBinRepositoryPort } from '../ports/outbound/warehouse-bin-repository.port'

export interface AllocateCargoForShipmentInput {
  readonly cargoId: string
  readonly shipmentId: string
}

export interface AllocateCargoForShipmentOutput {
  readonly binId: string
  readonly binCode: string
  readonly cargoId: string
  readonly cargoKind: 'PARCEL' | 'PALLET'
  readonly sku: string
  readonly label: string
  readonly handlingClass: HandlingClass
  readonly weightKg: number
  readonly volumeM3: number
  readonly itemCount: number
}

export class AllocateCargoForShipmentUseCase implements UseCase<
  AllocateCargoForShipmentInput,
  AllocateCargoForShipmentOutput
> {
  readonly name = 'AllocateCargoForShipmentUseCase'
  readonly boundedContext = 'warehouse'

  constructor(
    private readonly binRepository: WarehouseBinRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: AllocateCargoForShipmentInput): Promise<AllocateCargoForShipmentOutput> {
    const bin = await this.binRepository.findByCargoId(input.cargoId)
    if (!bin) {
      throw new CargoNotFoundInBinError(input.cargoId)
    }

    const allocated = bin.allocateCargo(input.cargoId, input.shipmentId, this.clock.now())
    await this.binRepository.save(bin)
    await this.eventBus.publishAll(bin.pullDomainEvents())

    return {
      binId: bin.id,
      binCode: bin.code,
      cargoId: allocated.unit.id,
      cargoKind: allocated.unit.kind,
      sku: allocated.unit.sku,
      label: allocated.unit.label,
      handlingClass: allocated.unit.getHandlingClass(),
      weightKg: allocated.unit.getWeight().kilograms,
      volumeM3: allocated.unit.getVolume().cubicMeters,
      itemCount: allocated.unit.getItemCount(),
    }
  }
}
